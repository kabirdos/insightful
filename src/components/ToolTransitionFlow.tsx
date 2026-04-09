"use client";

import { useEffect, useRef } from "react";
import type { HarnessWorkflowData } from "@/types/insights";
import { useMermaid } from "@/hooks/useMermaid";

interface ToolTransitionFlowProps {
  workflowData: HarnessWorkflowData;
}

export function buildFlowDiagram(
  toolTransitions: Record<string, number>,
): string {
  const entries = Object.entries(toolTransitions)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12); // top 12 transitions

  if (entries.length === 0) return "";

  const totalTransitions = entries.reduce((sum, [, count]) => sum + count, 0);
  const lines: string[] = ["flowchart LR"];

  // Collect unique tools
  const tools = new Set<string>();
  for (const [key] of entries) {
    const [from, to] = key.split("->");
    if (from) tools.add(from);
    if (to) tools.add(to);
  }

  // Define tool nodes with rounded boxes
  for (const tool of tools) {
    lines.push(`    ${tool.replace(/[^a-zA-Z0-9]/g, "_")}(${tool})`);
  }

  // Add edges with percentage labels
  for (const [key, count] of entries) {
    const [from, to] = key.split("->");
    if (!from || !to) continue;
    const fromId = from.replace(/[^a-zA-Z0-9]/g, "_");
    const toId = to.replace(/[^a-zA-Z0-9]/g, "_");
    const pct = Math.round((count / totalTransitions) * 100);
    // Use thicker lines for more common transitions
    if (pct >= 15) {
      lines.push(`    ${fromId} ==>|${pct}%| ${toId}`);
    } else if (pct >= 5) {
      lines.push(`    ${fromId} -->|${pct}%| ${toId}`);
    } else {
      lines.push(`    ${fromId} -.->|${pct}%| ${toId}`);
    }
  }

  return lines.join("\n");
}

export default function ToolTransitionFlow({
  workflowData,
}: ToolTransitionFlowProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const renderIdRef = useRef(0);
  const hasData = Object.keys(workflowData.toolTransitions).length > 0;
  const { ready, error, render } = useMermaid({ shouldLoad: hasData });

  useEffect(() => {
    if (!ready || !containerRef.current) return;
    let cancelled = false;

    const diagram = buildFlowDiagram(workflowData.toolTransitions);
    if (!diagram) return;

    const id = `mermaid-flow-${++renderIdRef.current}`;
    render(id, diagram).then((svg) => {
      if (svg && !cancelled && containerRef.current) {
        containerRef.current.innerHTML = svg;
      }
    });

    return () => {
      cancelled = true;
    };
  }, [ready, workflowData, render]);

  if (error || !hasData) return null;

  const totalTransitions = Object.values(workflowData.toolTransitions).reduce(
    (a, b) => a + b,
    0,
  );

  // Mobile fallback data
  const sortedTransitions = Object.entries(workflowData.toolTransitions)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  return (
    <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900/50">
      <div className="mb-3 flex items-center gap-2">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
          Tool Transition Flow
        </h3>
        <span className="text-xs text-slate-400">
          {totalTransitions.toLocaleString()} transitions
        </span>
      </div>

      {/* Mermaid diagram — hidden on mobile */}
      <div
        ref={containerRef}
        className="hidden sm:flex min-h-[180px] items-center justify-center overflow-x-auto [&_svg]:max-w-full"
      >
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-teal-500 border-t-transparent" />
      </div>

      {/* Mobile fallback — simple list of tool transitions */}
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
    </div>
  );
}
