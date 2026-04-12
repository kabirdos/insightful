"use client";

import { useEffect, useRef } from "react";
import type {
  HarnessAgentDispatch,
  HarnessWorkflowData,
} from "@/types/insights";
import { useMermaid } from "@/hooks/useMermaid";
import {
  safeSequenceLabel,
  safeSkillKeyLabel,
} from "@/lib/privacy-safe-workflow";

interface WorkflowDiagramProps {
  workflowData: HarnessWorkflowData;
  agentDispatch?: HarnessAgentDispatch | null;
  authorHandle?: string;
}

export function parseSkillSource(skill: string): {
  plugin: string;
  shortName: string;
} {
  const colonIdx = skill.indexOf(":");
  if (colonIdx === -1) {
    return { plugin: "custom", shortName: skill };
  }
  return {
    plugin: skill.slice(0, colonIdx),
    shortName: skill.slice(colonIdx + 1),
  };
}

const PLUGIN_COLORS: Record<
  string,
  { fill: string; stroke: string; text: string }
> = {
  superpowers: { fill: "#dbeafe", stroke: "#3b82f6", text: "#1e40af" },
  "compound-engineering": {
    fill: "#f3e8ff",
    stroke: "#8b5cf6",
    text: "#6b21a8",
  },
  "pr-review-toolkit": { fill: "#fef3c7", stroke: "#f59e0b", text: "#92400e" },
  "commit-commands": { fill: "#dcfce7", stroke: "#22c55e", text: "#166534" },
  "code-review": { fill: "#fce7f3", stroke: "#ec4899", text: "#9d174d" },
  anthropics: { fill: "#cffafe", stroke: "#06b6d4", text: "#155e75" },
  custom: { fill: "#f1f5f9", stroke: "#94a3b8", text: "#334155" },
};

function getPluginColor(plugin: string) {
  return PLUGIN_COLORS[plugin] || PLUGIN_COLORS.custom;
}

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return `${n}`;
}

function topEntries(
  data: Record<string, number>,
  limit: number,
): Array<[string, number]> {
  return Object.entries(data)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
}

function strongestWorkflowPattern(
  workflowPatterns: HarnessWorkflowData["workflowPatterns"],
): { sequence: string[]; count: number } | null {
  if (workflowPatterns.length === 0) return null;
  const strongest = [...workflowPatterns].sort((a, b) => b.count - a.count)[0];
  if (!strongest) return null;
  // Return the raw sequence so callers can sanitize per-skill via
  // safeSequenceLabel(). Returning a pre-joined `label` was the leak
  // path codex flagged: it baked custom skill paths/URLs/ticket IDs
  // into the public copy.
  return {
    sequence: strongest.sequence,
    count: strongest.count,
  };
}

function buildWorkflowInsights(
  workflowData: HarnessWorkflowData,
  agentDispatch?: HarnessAgentDispatch | null,
): Array<{ title: string; body: string }> {
  const insights: Array<{ title: string; body: string }> = [];
  const topSkills = topEntries(workflowData.skillInvocations, 2);
  const strongestPattern = strongestWorkflowPattern(
    workflowData.workflowPatterns,
  );
  // Deliberately NOT using workflowData.agentDispatches — those keys
  // are raw descriptions that leak customer/repo/path identifiers in
  // legacy reports. The curated agentDispatch.types is the privacy-safe
  // categorization (see PR #4 removal).
  const topAgentTypes = topEntries(agentDispatch?.types ?? {}, 2);

  if (strongestPattern) {
    // Sanitize each skill in the sequence so custom-skill paths/URLs/
    // file paths don't leak into the public writeup.
    const safeLabel = safeSequenceLabel(strongestPattern.sequence);
    insights.push({
      title: "Strongest Repeatable Path",
      body: `${safeLabel} is the clearest recurring chain in this report, repeating ${strongestPattern.count} times.`,
    });
  }

  if (topSkills.length > 0) {
    const [primary, secondary] = topSkills;
    const primaryLabel = safeSkillKeyLabel(primary[0]);
    const secondaryLabel = secondary ? safeSkillKeyLabel(secondary[0]) : null;
    insights.push({
      title: "Most Invoked Skills",
      body: secondary
        ? `${primaryLabel} leads at ${primary[1]} uses, followed by ${secondaryLabel} at ${secondary[1]}.`
        : `${primaryLabel} is the dominant skill in this report with ${primary[1]} uses.`,
    });
  }

  if (workflowData.phaseStats.exploreBeforeImplPct > 0) {
    insights.push({
      title: "Exploration Before Execution",
      body: `${workflowData.phaseStats.exploreBeforeImplPct}% of phased sessions explored before implementing, which suggests a planning-first development loop.`,
    });
  }

  if (workflowData.phaseStats.testBeforeShipPct > 0) {
    insights.push({
      title: "Shipping Discipline",
      body: `${workflowData.phaseStats.testBeforeShipPct}% of phased sessions tested before shipping, indicating a deliberate validation step before close-out.`,
    });
  }

  if ((agentDispatch?.totalAgents ?? 0) > 0) {
    const typeSummary =
      topAgentTypes.length > 0
        ? ` Most runs use ${topAgentTypes
            .map(([label, count]) => `${label} (${count})`)
            .join(" and ")} agents.`
        : "";
    insights.push({
      title: "Agent-Oriented Workflow",
      body: `${agentDispatch?.totalAgents ?? 0} agents were dispatched in this report, with ${agentDispatch?.backgroundPct ?? 0}% running in the background.${typeSummary}`,
    });
  }

  return insights.slice(0, 4);
}

export interface BuildWorkflowDiagramOptions {
  /** Flowchart layout direction. `"LR"` for desktop, `"TD"` for narrow. */
  direction?: "LR" | "TD";
  /** Font size (px) for the skill short-name line in each node label. */
  nameSize?: number;
  /** Font size (px) for the plugin + "N× used" meta lines in each node label. */
  metaSize?: number;
}

export function buildWorkflowDiagram(
  workflowData: HarnessWorkflowData,
  options: BuildWorkflowDiagramOptions = {},
): string {
  const { skillInvocations, workflowPatterns } = workflowData;
  const { direction = "LR", nameSize = 24, metaSize = 18 } = options;

  // Only render skills that actually participate in a workflow pattern.
  // This drops isolated nodes (skills used without transitioning to/from
  // anything else) which would otherwise clutter the graph without adding
  // information — the current-use counts for those are still surfaced in
  // the pill row above the diagram. Falls back to all skills when no
  // patterns exist at all, so a very sparse report still shows something.
  const patternSkillSet = new Set<string>();
  for (const pattern of workflowPatterns) {
    for (const skill of pattern.sequence) patternSkillSet.add(skill);
  }
  const allSkills = Object.keys(skillInvocations);
  const skills =
    patternSkillSet.size > 0
      ? allSkills.filter((s) => patternSkillSet.has(s))
      : allSkills;

  if (skills.length === 0) return "";

  const lines: string[] = [`flowchart ${direction}`];

  for (const skill of skills) {
    const count = skillInvocations[skill] ?? 0;
    const id = skill.replace(/[^a-zA-Z0-9]/g, "_");
    const { plugin, shortName } = parseSkillSource(skill);
    const safeName = shortName.replace(/"/g, "'");
    // Three stacked lines, each with its own explicit inline font-size so
    // Mermaid's theme defaults can't shrink them. htmlLabels render these
    // as raw HTML inside a foreignObject, which means:
    //   - `<span style=...>` wins against any CSS cascade
    //   - securityLevel must be "loose" (see useMermaid.ts) or the style
    //     attribute gets stripped by DOMPurify
    const label =
      `<span style='font-size:${nameSize}px;font-weight:700;line-height:1.15;display:block'>${safeName}</span>` +
      `<span style='font-size:${metaSize}px;font-weight:500;opacity:0.72;line-height:1.1;display:block;margin-top:4px'>${plugin}</span>` +
      `<span style='font-size:${metaSize + 1}px;font-weight:700;line-height:1.1;display:block;margin-top:3px'>${count}× used</span>`;
    lines.push(`    ${id}["${label}"]`);
  }

  const renderedSkills = new Set(skills);
  const edgeCounts: Record<string, number> = {};
  for (const pattern of workflowPatterns) {
    const seq = pattern.sequence;
    for (let i = 0; i < seq.length - 1; i++) {
      const from = seq[i];
      const to = seq[i + 1];
      if (from && to && renderedSkills.has(from) && renderedSkills.has(to)) {
        const key = `${from}|||${to}`;
        edgeCounts[key] = (edgeCounts[key] || 0) + pattern.count;
      }
    }
  }

  const sortedEdges = Object.entries(edgeCounts).sort((a, b) => b[1] - a[1]);
  for (const [key, count] of sortedEdges) {
    const [from, to] = key.split("|||");
    if (!from || !to) continue;
    const fromId = from.replace(/[^a-zA-Z0-9]/g, "_");
    const toId = to.replace(/[^a-zA-Z0-9]/g, "_");
    if (count > 1) {
      lines.push(`    ${fromId} -->|${count}x| ${toId}`);
    } else {
      lines.push(`    ${fromId} --> ${toId}`);
    }
  }

  for (const skill of skills) {
    const id = skill.replace(/[^a-zA-Z0-9]/g, "_");
    const { plugin } = parseSkillSource(skill);
    const color = getPluginColor(plugin);
    lines.push(
      `    style ${id} fill:${color.fill},stroke:${color.stroke},color:${color.text},stroke-width:2px`,
    );
  }

  return lines.join("\n");
}

/**
 * Force the rendered Mermaid SVG to fill 100% of its container width.
 *
 * Mermaid's `useMaxWidth: true` only sets `max-width:100%`, leaving the
 * intrinsic `width` at the natural layout size. For a flowchart with a
 * handful of nodes that means lots of wasted whitespace on wide screens
 * and a tendency to center rather than stretch. Stripping the hardcoded
 * `width`/`height` attributes and forcing `width="100%"` + `height: auto`
 * makes the graph actually fill the card edge-to-edge at any breakpoint.
 */
function stretchSvgToFullWidth(container: HTMLDivElement) {
  const svg = container.querySelector("svg");
  if (!svg) return;
  svg.removeAttribute("width");
  svg.removeAttribute("height");
  svg.setAttribute("width", "100%");
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
  svg.style.width = "100%";
  svg.style.maxWidth = "100%";
  svg.style.height = "auto";
  svg.style.display = "block";
}

export default function WorkflowDiagram({
  workflowData,
  agentDispatch,
  authorHandle,
}: WorkflowDiagramProps) {
  const name = authorHandle ? `@${authorHandle}` : "This developer";
  const desktopRef = useRef<HTMLDivElement>(null);
  const mobileRef = useRef<HTMLDivElement>(null);
  const renderIdRef = useRef(0);
  const hasSkillData = Object.keys(workflowData.skillInvocations).length > 0;
  const { ready, error, render } = useMermaid({ shouldLoad: hasSkillData });

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;

    // Render two separate diagrams so the desktop and mobile variants can
    // use different flowchart directions and font sizes. We can't reliably
    // switch direction with CSS alone — Mermaid bakes layout into the SVG
    // at render time, so the breakpoint lives in the JSX (hidden / block
    // classes) and each variant renders into its own container ref.
    const desktopDiagram = buildWorkflowDiagram(workflowData, {
      direction: "LR",
      nameSize: 24,
      metaSize: 18,
    });
    const mobileDiagram = buildWorkflowDiagram(workflowData, {
      direction: "TD",
      nameSize: 20,
      metaSize: 15,
    });

    const renderInto = async (
      container: HTMLDivElement | null,
      diagram: string,
      idSuffix: string,
    ) => {
      if (!container || !diagram) return;
      const id = `mermaid-workflow-${++renderIdRef.current}-${idSuffix}`;
      const svg = await render(id, diagram);
      if (!svg || cancelled || !container) return;
      container.innerHTML = svg;
      stretchSvgToFullWidth(container);
    };

    renderInto(desktopRef.current, desktopDiagram, "desktop");
    renderInto(mobileRef.current, mobileDiagram, "mobile");

    return () => {
      cancelled = true;
    };
  }, [ready, workflowData, render]);

  if (error || !hasSkillData) return null;

  const { phaseStats, phaseDistribution } = workflowData;
  const topSkillPills = topEntries(workflowData.skillInvocations, 6);
  const topSkill = topEntries(workflowData.skillInvocations, 1)[0];
  const strongestPattern = strongestWorkflowPattern(
    workflowData.workflowPatterns,
  );
  // NOTE: workflowData.agentDispatches is intentionally not read —
  // raw description keys leak customer/repo/path identifiers in
  // legacy reports. Only the curated agentDispatch.types is rendered.
  const dispatchTypeEntries = topEntries(agentDispatch?.types ?? {}, 4);
  const dispatchModelEntries = topEntries(agentDispatch?.models ?? {}, 4);
  const workflowInsights = buildWorkflowInsights(workflowData, agentDispatch);
  const hasPhaseData = Object.keys(phaseDistribution).length > 0;
  const hasDispatchSummary = (agentDispatch?.totalAgents ?? 0) > 0;

  const pluginsPresent = Array.from(
    new Set(
      Object.keys(workflowData.skillInvocations).map(
        (s) => parseSkillSource(s).plugin,
      ),
    ),
  );

  return (
    <div className="mb-6 space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900/50">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-[15px] font-bold text-slate-900 dark:text-slate-100">
              {name}&apos;s Skill Workflow
            </h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              The skills this report chains together most often, rendered as a
              repeatable workflow instead of a flat list.
            </p>
          </div>
          <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
            {Object.values(workflowData.skillInvocations).reduce(
              (a, b) => a + b,
              0,
            )}{" "}
            skill invocations
          </div>
        </div>

        {topSkillPills.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-2">
            {topSkillPills.map(([skill, count]) => {
              const { plugin } = parseSkillSource(skill);
              const color = getPluginColor(plugin);
              const safeName = safeSkillKeyLabel(skill);
              return (
                <span
                  key={skill}
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
                  style={{
                    backgroundColor: color.fill,
                    color: color.text,
                    border: `1px solid ${color.stroke}`,
                  }}
                >
                  <span>{safeName}</span>
                  <span className="opacity-80">{count}x</span>
                </span>
              );
            })}
          </div>
        )}

        {/* Desktop variant: flowchart LR, big fonts. Hidden below sm breakpoint. */}
        <div
          ref={desktopRef}
          className="workflow-diagram-container workflow-diagram-container--desktop hidden min-h-[320px] items-center justify-center rounded-lg border border-slate-100 bg-slate-50/70 px-4 py-5 sm:flex dark:border-slate-800 dark:bg-slate-950/30"
        >
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
        </div>

        {/* Mobile variant: flowchart TD (top-down) so nodes stack naturally
            on narrow viewports. Smaller label sizes because each node gets
            the full 375px rather than sharing it horizontally. */}
        <div
          ref={mobileRef}
          className="workflow-diagram-container workflow-diagram-container--mobile flex min-h-[320px] items-center justify-center rounded-lg border border-slate-100 bg-slate-50/70 px-3 py-4 sm:hidden dark:border-slate-800 dark:bg-slate-950/30"
        >
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
        </div>

        {(pluginsPresent.length > 1 || topSkill || strongestPattern) && (
          <div className="mt-4 space-y-3 border-t border-slate-100 pt-4 dark:border-slate-800">
            {pluginsPresent.length > 1 && (
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="text-slate-500 dark:text-slate-400">
                  Source:
                </span>
                {pluginsPresent.map((plugin) => {
                  const color = PLUGIN_COLORS[plugin] || PLUGIN_COLORS.custom;
                  return (
                    <span
                      key={plugin}
                      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-medium"
                      style={{
                        backgroundColor: color.fill,
                        color: color.text,
                        border: `1px solid ${color.stroke}`,
                      }}
                    >
                      {plugin}
                    </span>
                  );
                })}
              </div>
            )}
            <div className="flex flex-wrap gap-2.5">
              {topSkill && (
                <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
                  <strong className="text-slate-900 dark:text-slate-100">
                    {safeSkillKeyLabel(topSkill[0])}
                  </strong>{" "}
                  most invoked ({topSkill[1]}x)
                </div>
              )}
              {strongestPattern && (
                <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
                  <strong className="text-slate-900 dark:text-slate-100">
                    {safeSequenceLabel(strongestPattern.sequence)}
                  </strong>{" "}
                  strongest pattern ({strongestPattern.count}x)
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900/50">
          <div className="mb-4">
            <h3 className="text-[15px] font-bold text-slate-900 dark:text-slate-100">
              What {name} Delegates to Agents
            </h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              The parallel work this report hands off, or the orchestration
              footprint when task-level descriptions are intentionally omitted.
            </p>
          </div>

          {hasDispatchSummary ? (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 dark:border-slate-700 dark:bg-slate-800/60">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    Total Agents
                  </div>
                  <div className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-100">
                    {formatCount(agentDispatch?.totalAgents ?? 0)}
                  </div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 dark:border-slate-700 dark:bg-slate-800/60">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    Background
                  </div>
                  <div className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-100">
                    {agentDispatch?.backgroundPct ?? 0}%
                  </div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 dark:border-slate-700 dark:bg-slate-800/60">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    Custom Agents
                  </div>
                  <div className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-100">
                    {agentDispatch?.customAgents.length ?? 0}
                  </div>
                </div>
              </div>

              {dispatchTypeEntries.length > 0 && (
                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Agent Types
                  </div>
                  <div className="space-y-2">
                    {dispatchTypeEntries.map(([label, count]) => (
                      <div
                        key={label}
                        className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300"
                      >
                        <span className="font-medium">{label}</span>
                        <span className="font-mono text-slate-400">
                          {count}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {dispatchModelEntries.length > 0 && (
                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Model Tiering
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {dispatchModelEntries.map(([label, count]) => (
                      <span
                        key={label}
                        className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300"
                      >
                        {label} ({count})
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {agentDispatch?.customAgents.length ? (
                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Custom Agents
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {agentDispatch.customAgents.slice(0, 6).map((label) => (
                      <span
                        key={label}
                        className="rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-xs text-violet-700 dark:border-violet-700 dark:bg-violet-950/30 dark:text-violet-300"
                      >
                        {label}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-400">
              No delegation data was captured in this report.
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900/50">
          <div className="mb-4">
            <h3 className="text-[15px] font-bold text-slate-900 dark:text-slate-100">
              Workflow Insight
            </h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              What this workflow reveals about development style, sequencing,
              and shipping posture.
            </p>
          </div>

          <div className="space-y-3">
            {workflowInsights.map((insight) => (
              <div
                key={insight.title}
                className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/60"
              >
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {insight.title}
                </div>
                <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                  {insight.body}
                </p>
              </div>
            ))}

            {hasPhaseData && (
              <div className="grid gap-3 pt-1 sm:grid-cols-2">
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/60">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    Explore Before Build
                  </div>
                  <div className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">
                    {phaseStats.exploreBeforeImplPct}%
                  </div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/60">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    Test Before Ship
                  </div>
                  <div className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">
                    {phaseStats.testBeforeShipPct}%
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
