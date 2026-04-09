"use client";

import { useEffect, useRef } from "react";
import type { HarnessWorkflowData } from "@/types/insights";
import { useMermaid } from "@/hooks/useMermaid";

interface WorkflowDiagramProps {
  workflowData: HarnessWorkflowData;
  authorHandle?: string;
}

/**
 * Build a Mermaid flowchart from skill invocations and workflow patterns.
 * Nodes are skill names with invocation counts; edges show common transitions.
 */
export function buildWorkflowDiagram(
  workflowData: HarnessWorkflowData,
): string {
  const { skillInvocations, workflowPatterns } = workflowData;

  const skills = Object.keys(skillInvocations);
  if (skills.length === 0) return "";

  const lines: string[] = ["flowchart TD"];

  // Define nodes — sanitize IDs for mermaid
  for (const [skill, count] of Object.entries(skillInvocations)) {
    const id = skill.replace(/[^a-zA-Z0-9]/g, "_");
    const label = `${skill} (${count}\u00d7)`;
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

      {/* Mobile fallback — ordered list of skills */}
      <div className="block sm:hidden">
        <ol className="list-decimal list-inside space-y-1 text-sm text-slate-600 dark:text-slate-400">
          {sortedSkills.map(([name, count]) => (
            <li key={name}>
              <span className="font-mono text-xs">{name}</span>{" "}
              <span className="text-slate-400">({count}x)</span>
            </li>
          ))}
        </ol>
      </div>

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
