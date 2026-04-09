"use client";

import { useEffect, useRef } from "react";
import type { HarnessWorkflowData } from "@/types/insights";
import { useMermaid } from "@/hooks/useMermaid";

interface WorkflowDiagramProps {
  workflowData: HarnessWorkflowData;
  authorHandle?: string;
}

/**
 * Parse a skill identifier into its plugin source and short name.
 * Skills are in the form "plugin-name:skill-name" or just "skill-name" (custom).
 */
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

// Mermaid fill/stroke colors per plugin source
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

/**
 * Build a Mermaid flowchart from skill invocations and workflow patterns.
 * Nodes are skill names with invocation counts, color-coded by plugin source.
 * Edges show common transitions between skills.
 */
export function buildWorkflowDiagram(
  workflowData: HarnessWorkflowData,
): string {
  const { skillInvocations, workflowPatterns } = workflowData;

  const skills = Object.keys(skillInvocations);
  if (skills.length === 0) return "";

  const lines: string[] = ["flowchart TD"];

  // Define nodes with plugin source in label
  for (const [skill, count] of Object.entries(skillInvocations)) {
    const id = skill.replace(/[^a-zA-Z0-9]/g, "_");
    const { plugin, shortName } = parseSkillSource(skill);
    // Escape quotes in labels and use the short name
    const safeName = shortName.replace(/"/g, "'");
    const label = `${safeName}<br/><span style='font-size:9px;opacity:0.7'>${plugin}</span><br/>${count}×`;
    lines.push(`    ${id}["${label}"]`);
  }

  // Build edge counts from workflow patterns
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

  // Add edges sorted by count
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

  // Apply color styles per node based on plugin source
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
  authorHandle,
}: WorkflowDiagramProps) {
  const name = authorHandle ? `@${authorHandle}` : "This developer";
  const containerRef = useRef<HTMLDivElement>(null);
  const renderIdRef = useRef(0);
  const hasSkillData = Object.keys(workflowData.skillInvocations).length > 0;
  const { ready, error, render } = useMermaid({ shouldLoad: hasSkillData });

  // Render diagram when mermaid is ready
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

  // Build mobile fallback list from skill invocations
  const sortedSkills = Object.entries(workflowData.skillInvocations)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  const sortedDispatches = Object.entries(agentDispatches)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const hasPhaseData = Object.keys(phaseDistribution).length > 0;

  // Unique plugin sources present
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

      {/* Mermaid diagram container — hidden on mobile */}
      <div
        ref={containerRef}
        className="hidden sm:flex min-h-[200px] items-center justify-center overflow-x-auto [&_svg]:max-w-full"
      >
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
      </div>

      {/* Mobile fallback — ordered list of skills with plugin source */}
      <div className="block sm:hidden">
        <ol className="list-decimal list-inside space-y-1 text-sm text-slate-600 dark:text-slate-400">
          {sortedSkills.map(([name, count]) => {
            const { plugin, shortName } = parseSkillSource(name);
            return (
              <li key={name}>
                <span className="font-mono text-xs">{shortName}</span>{" "}
                <span className="text-[10px] text-slate-400">[{plugin}]</span>{" "}
                <span className="text-slate-400">({count}x)</span>
              </li>
            );
          })}
        </ol>
      </div>

      {/* Plugin source legend */}
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

      {/* Supplementary info */}
      <div className="mt-3 space-y-3 border-t border-slate-100 pt-3 dark:border-slate-800">
        {/* Agent dispatches */}
        {sortedDispatches.length > 0 && (
          <div>
            <div className="mb-1 text-xs font-medium text-slate-500 dark:text-slate-400">
              What {name} delegates to agents
            </div>
            <div className="space-y-0.5">
              {sortedDispatches.map(([desc, count]) => (
                <div
                  key={desc}
                  className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400"
                >
                  <span className="truncate font-mono">{desc}</span>
                  <span className="ml-2 shrink-0 text-slate-400">{count}x</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Phase stats */}
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
