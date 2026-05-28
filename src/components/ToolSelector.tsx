"use client";

import { Bot, Code2 } from "lucide-react";
import clsx from "clsx";
import type { ComponentType } from "react";
import type { HarnessToolKey } from "@/types/insights";

interface ToolSelectorProps {
  tools: HarnessToolKey[];
  active: HarnessToolKey;
  onChange: (tool: HarnessToolKey) => void;
}

const TOOL_LABELS: Record<HarnessToolKey, string> = {
  "claude-code": "Claude Code",
  codex: "Codex",
};

const TOOL_META: Record<HarnessToolKey, string> = {
  "claude-code": "Harness report",
  codex: "Local CLI profile",
};

const TOOL_ICONS: Record<
  HarnessToolKey,
  ComponentType<{ className?: string }>
> = {
  "claude-code": Bot,
  codex: Code2,
};

export default function ToolSelector({
  tools,
  active,
  onChange,
}: ToolSelectorProps) {
  if (tools.length <= 1) return null;

  return (
    <div
      role="tablist"
      aria-label="Tool profile"
      className="mb-6 grid gap-2 rounded-lg border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-900/50 sm:grid-cols-2"
    >
      {tools.map((tool) => {
        const Icon = TOOL_ICONS[tool];
        const selected = active === tool;
        return (
          <button
            key={tool}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(tool)}
            className={clsx(
              "flex min-h-16 items-center gap-3 rounded-md px-3 py-2 text-left transition-colors",
              selected
                ? "bg-slate-900 text-white shadow-sm dark:bg-slate-100 dark:text-slate-950"
                : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800",
            )}
          >
            <span
              className={clsx(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-md",
                selected
                  ? "bg-white/15 dark:bg-slate-950/10"
                  : "bg-slate-100 dark:bg-slate-800",
              )}
            >
              <Icon className="h-5 w-5" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold leading-tight">
                {TOOL_LABELS[tool]}
              </span>
              <span
                className={clsx(
                  "mt-0.5 block text-xs",
                  selected
                    ? "text-white/70 dark:text-slate-700"
                    : "text-slate-400 dark:text-slate-500",
                )}
              >
                {TOOL_META[tool]}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
