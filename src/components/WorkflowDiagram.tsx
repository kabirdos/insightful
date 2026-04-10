"use client";

import { useEffect, useRef } from "react";
import type {
  HarnessAgentDispatch,
  HarnessSkillEntry,
  HarnessWorkflowData,
} from "@/types/insights";
import { useMermaid } from "@/hooks/useMermaid";
import {
  getSafeCommandHighlights,
  getSafeSkillHighlights,
  safeSequenceLabel,
  safeSkillKeyLabel,
} from "@/lib/privacy-safe-workflow";

interface WorkflowDiagramProps {
  workflowData: HarnessWorkflowData;
  agentDispatch?: HarnessAgentDispatch | null;
  skillInventory?: HarnessSkillEntry[];
  cliTools?: Record<string, number>;
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
  return {
    sequence: strongest.sequence,
    count: strongest.count,
  };
}

function buildWorkflowInsights(
  workflowData: HarnessWorkflowData,
  agentDispatch?: HarnessAgentDispatch | null,
  safeSkills: string[] = [],
  safeCommands: string[] = [],
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

  if (safeSkills.length > 0) {
    insights.push({
      title: "Skills In Rotation",
      body: `The public workflow can still show useful skill context without raw task text, led here by ${safeSkills.slice(0, 3).join(", ")}.`,
    });
  }

  if (safeCommands.length > 0) {
    insights.push({
      title: "Command Surface",
      body: `The shell layer around this workflow stays readable through safe command shapes like ${safeCommands.slice(0, 3).join(", ")}.`,
    });
  }

  return insights.slice(0, 4);
}

export function buildWorkflowDiagram(
  workflowData: HarnessWorkflowData,
): string {
  const { skillInvocations, workflowPatterns } = workflowData;

  const skills = Object.keys(skillInvocations);
  if (skills.length === 0) return "";

  const lines: string[] = ["flowchart TD"];

  for (const [skill, count] of Object.entries(skillInvocations)) {
    const id = skill.replace(/[^a-zA-Z0-9]/g, "_");
    const { plugin, shortName } = parseSkillSource(skill);
    const safeName = shortName.replace(/"/g, "'");
    const label = `${safeName}<br/><span style='font-size:9px;opacity:0.7'>${plugin}</span><br/>${count}×`;
    lines.push(`    ${id}["${label}"]`);
  }

  const edgeCounts: Record<string, number> = {};
  for (const pattern of workflowPatterns) {
    const seq = pattern.sequence;
    for (let i = 0; i < seq.length - 1; i++) {
      const from = seq[i];
      const to = seq[i + 1];
      if (from && to) {
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
      `    style ${id} fill:${color.fill},stroke:${color.stroke},color:${color.text}`,
    );
  }

  return lines.join("\n");
}

export default function WorkflowDiagram({
  workflowData,
  agentDispatch,
  skillInventory = [],
  cliTools = {},
  authorHandle,
}: WorkflowDiagramProps) {
  const name = authorHandle ? `@${authorHandle}` : "This developer";
  const containerRef = useRef<HTMLDivElement>(null);
  const renderIdRef = useRef(0);
  const hasSkillData = Object.keys(workflowData.skillInvocations).length > 0;
  const { ready, error, render } = useMermaid({ shouldLoad: hasSkillData });

  useEffect(() => {
    if (!ready || !containerRef.current) return;
    let cancelled = false;

    const diagram = buildWorkflowDiagram(workflowData);
    if (!diagram) return;

    const id = `mermaid-workflow-${++renderIdRef.current}`;
    render(id, diagram).then((svg) => {
      if (svg && !cancelled && containerRef.current) {
        containerRef.current.innerHTML = svg;
      }
    });

    return () => {
      cancelled = true;
    };
  }, [ready, workflowData, render]);

  if (error || !hasSkillData) return null;

  const { phaseStats, phaseDistribution } = workflowData;
  const sortedSkills = topEntries(workflowData.skillInvocations, 10);
  // NOTE: workflowData.agentDispatches is intentionally not read —
  // raw description keys leak customer/repo/path identifiers in
  // legacy reports. Only the curated agentDispatch.types is rendered.
  const dispatchTypeEntries = topEntries(agentDispatch?.types ?? {}, 4);
  const dispatchModelEntries = topEntries(agentDispatch?.models ?? {}, 4);
  const safeSkills = getSafeSkillHighlights(skillInventory, 5);
  const safeCommands = getSafeCommandHighlights(cliTools, 5);
  const workflowInsights = buildWorkflowInsights(
    workflowData,
    agentDispatch,
    safeSkills,
    safeCommands,
  );
  const hasPhaseData = Object.keys(phaseDistribution).length > 0;
  const hasDispatchSummary = (agentDispatch?.totalAgents ?? 0) > 0;
  const strongestPattern = strongestWorkflowPattern(
    workflowData.workflowPatterns,
  );
  const topSkill = topEntries(workflowData.skillInvocations, 1)[0];

  const pluginsPresent = Array.from(
    new Set(
      Object.keys(workflowData.skillInvocations).map(
        (s) => parseSkillSource(s).plugin,
      ),
    ),
  );

  return (
    <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900/50">
      <div className="mb-3 flex items-center gap-2">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
          {name}&apos;s Skill Workflow
        </h3>
        <span className="text-xs text-slate-400">
          {Object.values(workflowData.skillInvocations).reduce(
            (a, b) => a + b,
            0,
          )}{" "}
          skill invocations
        </span>
      </div>

      <div
        ref={containerRef}
        className="hidden sm:flex min-h-[200px] items-center justify-center overflow-x-auto [&_svg]:max-w-full"
      >
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
      </div>

      <div className="block sm:hidden">
        <ol className="list-decimal list-inside space-y-1 text-sm text-slate-600 dark:text-slate-400">
          {sortedSkills.map(([skillKey, count]) => {
            const { plugin } = parseSkillSource(skillKey);
            // Route custom skills through the risky-pattern check so
            // identifiers like "POC-1234" or paths don't leak.
            const safeName = safeSkillKeyLabel(skillKey);
            return (
              <li key={skillKey}>
                <span className="font-mono text-xs">{safeName}</span>{" "}
                <span className="text-[10px] text-slate-400">[{plugin}]</span>{" "}
                <span className="text-slate-400">({count}x)</span>
              </li>
            );
          })}
        </ol>
      </div>

      {pluginsPresent.length > 1 && (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-500 dark:text-slate-400">Source:</span>
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

      {(topSkill || strongestPattern) && (
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          {topSkill && (
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
              Most used: {safeSkillKeyLabel(topSkill[0])} ({topSkill[1]}x)
            </span>
          )}
          {strongestPattern && (
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
              Strongest path: {safeSequenceLabel(strongestPattern.sequence)} (
              {strongestPattern.count}x)
            </span>
          )}
        </div>
      )}

      <div className="mt-3 space-y-3 border-t border-slate-100 pt-3 dark:border-slate-800">
        {/* Raw agent-dispatch descriptions can contain customer/repo/path
            identifiers (see PR #4 which removed them from the extractor).
            Any legacy reports that still have agentDispatches populated are
            deliberately NOT rendered — we only show the curated
            agentDispatch.types summary below. */}

        {hasDispatchSummary && (
          <div className="space-y-3">
            <div className="mb-1 text-xs font-medium text-slate-500 dark:text-slate-400">
              What {name} delegates to agents
            </div>

            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
                {formatCount(agentDispatch?.totalAgents ?? 0)} agents total
              </span>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
                {agentDispatch?.backgroundPct ?? 0}% in background
              </span>
            </div>

            {dispatchTypeEntries.length > 0 && (
              <div>
                <div className="mb-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                  Agent Types
                </div>
                <div className="flex flex-wrap gap-2">
                  {dispatchTypeEntries.map(([label, count]) => (
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

            {dispatchModelEntries.length > 0 && (
              <div>
                <div className="mb-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                  Models
                </div>
                <div className="flex flex-wrap gap-2">
                  {dispatchModelEntries.map(([label, count]) => (
                    <span
                      key={label}
                      className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 font-mono text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300"
                    >
                      {label} ({count})
                    </span>
                  ))}
                </div>
              </div>
            )}

            {(safeSkills.length > 0 || safeCommands.length > 0) && (
              <div className="grid gap-3 sm:grid-cols-2">
                {safeSkills.length > 0 && (
                  <div>
                    <div className="mb-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                      Relevant Skills
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {safeSkills.map((label) => (
                        <span
                          key={label}
                          className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs text-blue-700 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-300"
                        >
                          {label}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {safeCommands.length > 0 && (
                  <div>
                    <div className="mb-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                      Relevant Commands
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {safeCommands.map((label) => (
                        <span
                          key={label}
                          className="rounded-full border border-teal-200 bg-teal-50 px-2.5 py-1 font-mono text-xs text-teal-700 dark:border-teal-800 dark:bg-teal-950/30 dark:text-teal-300"
                        >
                          {label}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {workflowInsights.length > 0 && (
          <div>
            <div className="mb-2 text-xs font-medium text-slate-500 dark:text-slate-400">
              Workflow Insight
            </div>
            <div className="space-y-2">
              {workflowInsights.map((insight) => (
                <div
                  key={insight.title}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800/50"
                >
                  <div className="font-semibold text-slate-700 dark:text-slate-200">
                    {insight.title}
                  </div>
                  <p className="mt-1 leading-relaxed text-slate-600 dark:text-slate-400">
                    {insight.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {hasPhaseData && (
          <div className="flex flex-wrap gap-4">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {phaseStats.exploreBeforeImplPct}%
              </span>{" "}
              explores before implementing
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {phaseStats.testBeforeShipPct}%
              </span>{" "}
              tests before shipping
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
