"use client";

import { useEffect, useRef } from "react";
import type { HarnessWorkflowData } from "@/types/insights";
import { useMermaid } from "@/hooks/useMermaid";

interface WorkflowDiagramProps {
  workflowData: HarnessWorkflowData;
}

// Phase display names and colors
const PHASE_META: Record<string, { label: string; color: string }> = {
  exploration: { label: "Exploration", color: "#3b82f6" },
  implementation: { label: "Implementation", color: "#22c55e" },
  testing: { label: "Testing", color: "#f59e0b" },
  shipping: { label: "Shipping", color: "#8b5cf6" },
  orchestration: { label: "Orchestration", color: "#06b6d4" },
  other: { label: "Other", color: "#94a3b8" },
};

export function buildStateDiagram(workflowData: HarnessWorkflowData): string {
  const { phaseTransitions, phaseDistribution } = workflowData;

  // Only include phases that have data
  const activePhases = Object.keys(phaseDistribution).filter(
    (p) => phaseDistribution[p] > 0,
  );

  if (activePhases.length === 0) return "";

  const lines: string[] = ["stateDiagram-v2"];

  // Define states with display names
  for (const phase of activePhases) {
    const meta = PHASE_META[phase] || { label: phase, color: "#94a3b8" };
    lines.push(`    ${phase} : ${meta.label} (${phaseDistribution[phase]}%)`);
  }

  // Add transitions with counts
  const totalTransitions = Object.values(phaseTransitions).reduce(
    (a, b) => a + b,
    0,
  );

  if (totalTransitions > 0) {
    // Sort transitions by count descending, show top 10
    const sorted = Object.entries(phaseTransitions)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    for (const [key, count] of sorted) {
      const [from, to] = key.split("->");
      if (
        from &&
        to &&
        activePhases.includes(from) &&
        activePhases.includes(to)
      ) {
        const pct = Math.round((count / totalTransitions) * 100);
        lines.push(`    ${from} --> ${to} : ${pct}%`);
      }
    }
  }

  // Add start state pointing to most common phase
  // Use .toSorted() to avoid mutating activePhases during render
  const topPhase = [...activePhases].sort(
    (a, b) => (phaseDistribution[b] || 0) - (phaseDistribution[a] || 0),
  )[0];
  if (topPhase) {
    lines.push(`    [*] --> ${topPhase}`);
  }

  return lines.join("\n");
}

export default function WorkflowDiagram({
  workflowData,
}: WorkflowDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const hasData = Object.keys(workflowData.phaseDistribution).length > 0;
  const { ready, error, render } = useMermaid({ shouldLoad: hasData });

  // Render diagram when mermaid is ready
  useEffect(() => {
    if (!ready || !containerRef.current) return;

    const diagram = buildStateDiagram(workflowData);
    if (!diagram) return;

    const id = `mermaid-state-${Date.now()}`;
    render(id, diagram).then((svg) => {
      if (svg && containerRef.current) {
        containerRef.current.innerHTML = svg;
      }
    });
  }, [ready, workflowData, render]);

  if (error || !hasData) return null;

  const { phaseStats } = workflowData;

  // Build mobile fallback list from phase transitions
  const sortedTransitions = Object.entries(workflowData.phaseTransitions)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  return (
    <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900/50">
      <div className="mb-3 flex items-center gap-2">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
          Workflow Phases
        </h3>
        <span className="text-xs text-slate-400">
          {phaseStats.totalSessionsWithPhases} sessions analyzed
        </span>
      </div>

      {/* Mermaid diagram container — hidden on mobile */}
      <div
        ref={containerRef}
        className="hidden sm:flex min-h-[200px] items-center justify-center overflow-x-auto [&_svg]:max-w-full"
      >
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
      </div>

      {/* Mobile fallback — simple list of phase transitions */}
      <div className="block sm:hidden">
        <ol className="list-decimal list-inside space-y-1 text-sm text-slate-600 dark:text-slate-400">
          {sortedTransitions.map(([key, count]) => (
            <li key={key}>
              <span className="font-mono text-xs">{key}</span>{" "}
              <span className="text-slate-400">({count})</span>
            </li>
          ))}
        </ol>
      </div>

      {/* Phase stats summary */}
      <div className="mt-3 flex flex-wrap gap-4 border-t border-slate-100 pt-3 dark:border-slate-800">
        <div className="text-xs text-slate-500 dark:text-slate-400">
          <span className="font-semibold text-slate-700 dark:text-slate-300">
            {phaseStats.exploreBeforeImplPct}%
          </span>{" "}
          explore before implementing
        </div>
        <div className="text-xs text-slate-500 dark:text-slate-400">
          <span className="font-semibold text-slate-700 dark:text-slate-300">
            {phaseStats.testBeforeShipPct}%
          </span>{" "}
          test before shipping
        </div>
      </div>
    </div>
  );
}
