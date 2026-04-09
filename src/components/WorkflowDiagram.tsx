"use client";

import { useEffect, useRef } from "react";
import type { HarnessAgentDispatch, HarnessWorkflowData } from "@/types/insights";
import { useMermaid } from "@/hooks/useMermaid";

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
): { label: string; count: number } | null {
  if (workflowPatterns.length === 0) return null;
  const strongest = [...workflowPatterns].sort((a, b) => b.count - a.count)[0];
  if (!strongest) return null;
  return {
    label: strongest.sequence.join(" -> "),
    count: strongest.count,
  };
}

function buildWorkflowInsights(
  workflowData: HarnessWorkflowData,
  agentDispatch?: HarnessAgentDispatch | null,
): Array<{ title: string; body: string }> {
  const insights: Array<{ title: string; body: string }> = [];
  const topSkills = topEntries(workflowData.skillInvocations, 2);
  const strongestPattern = strongestWorkflowPattern(workflowData.workflowPatterns);
  const agentDispatches = topEntries(workflowData.agentDispatches, 3);
  const topAgentTypes = topEntries(agentDispatch?.types ?? {}, 2);

  if (strongestPattern) {
    insights.push({
      title: "Strongest Repeatable Path",
      body: `${strongestPattern.label} is the clearest recurring chain in this report, repeating ${strongestPattern.count} times.`,
    });
  }

  if (topSkills.length > 0) {
    const [primary, secondary] = topSkills;
    insights.push({
      title: "Most Invoked Skills",
      body: secondary
        ? `${primary[0]} leads at ${primary[1]} uses, followed by ${secondary[0]} at ${secondary[1]}.`
        : `${primary[0]} is the dominant skill in this report with ${primary[1]} uses.`,
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

  if (agentDispatches.length > 0) {
    insights.push({
      title: "Delegation Pattern",
      body: `Agent handoffs cluster around ${agentDispatches
        .map(([label]) => label)
        .slice(0, 2)
        .join(" and ")}, showing repeated delegation of parallelizable work.`,
    });
  } else if ((agentDispatch?.totalAgents ?? 0) > 0) {
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

  const { phaseStats, phaseDistribution, agentDispatches } = workflowData;
  const sortedSkills = topEntries(workflowData.skillInvocations, 10);
  const topSkillPills = topEntries(workflowData.skillInvocations, 6);
  const topSkill = topEntries(workflowData.skillInvocations, 1)[0];
  const strongestPattern = strongestWorkflowPattern(workflowData.workflowPatterns);
  const sortedDispatches = topEntries(agentDispatches, 8);
  const dispatchTypeEntries = topEntries(agentDispatch?.types ?? {}, 4);
  const dispatchModelEntries = topEntries(agentDispatch?.models ?? {}, 4);
  const workflowInsights = buildWorkflowInsights(workflowData, agentDispatch);
  const hasPhaseData = Object.keys(phaseDistribution).length > 0;
  const hasDispatchDetails = sortedDispatches.length > 0;
  const hasDispatchSummary = (agentDispatch?.totalAgents ?? 0) > 0;

  const pluginsPresent = Array.from(
    new Set(
      Object.keys(workflowData.skillInvocations).map(
        (s) => parseSkillSource(s).plugin,
      ),
    ),
  );

  return (
    <div className="mb-6 grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,1fr)]">
      <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900/50 xl:row-span-2">
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
              const { plugin, shortName } = parseSkillSource(skill);
              const color = getPluginColor(plugin);
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
                  <span>{shortName}</span>
                  <span className="opacity-80">{count}x</span>
                </span>
              );
            })}
          </div>
        )}

        <div
          ref={containerRef}
          className="hidden min-h-[240px] items-center justify-center overflow-x-auto rounded-lg border border-slate-100 bg-slate-50/70 px-2 py-4 sm:flex dark:border-slate-800 dark:bg-slate-950/30 [&_svg]:max-w-full"
        >
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
        </div>

        <div className="block sm:hidden">
          <ol className="space-y-2">
            {sortedSkills.map(([skillName, count]) => {
              const { plugin, shortName } = parseSkillSource(skillName);
              const color = getPluginColor(plugin);
              return (
                <li
                  key={skillName}
                  className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800/50"
                >
                  <div className="min-w-0">
                    <div className="truncate font-mono text-xs text-slate-700 dark:text-slate-300">
                      {shortName}
                    </div>
                    <div
                      className="mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold"
                      style={{
                        backgroundColor: color.fill,
                        color: color.text,
                        border: `1px solid ${color.stroke}`,
                      }}
                    >
                      {plugin}
                    </div>
                  </div>
                  <span className="ml-3 shrink-0 text-xs text-slate-400">
                    {count}x
                  </span>
                </li>
              );
            })}
          </ol>
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
                    {parseSkillSource(topSkill[0]).shortName}
                  </strong>{" "}
                  most invoked ({topSkill[1]}x)
                </div>
              )}
              {strongestPattern && (
                <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
                  <strong className="text-slate-900 dark:text-slate-100">
                    {strongestPattern.label}
                  </strong>{" "}
                  strongest pattern ({strongestPattern.count}x)
                </div>
              )}
            </div>
          </div>
        )}
      </div>

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

        {hasDispatchDetails ? (
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
            {sortedDispatches.map(([desc, count]) => (
              <div
                key={desc}
                className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-800/60"
              >
                <span className="min-w-0 text-xs font-medium text-slate-600 dark:text-slate-300">
                  {desc}
                </span>
                <span className="shrink-0 font-mono text-[11px] text-slate-400">
                  {count}x
                </span>
              </div>
            ))}
          </div>
        ) : hasDispatchSummary ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-3">
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
                      <span className="font-mono text-slate-400">{count}</span>
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
            What this workflow reveals about development style, sequencing, and
            shipping posture.
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
  );
}
