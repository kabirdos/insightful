"use client";

import type { HarnessFileOpStyle } from "@/types/insights";

interface FileOpStyleBarProps {
  fileOpStyle: HarnessFileOpStyle;
}

const SEGMENTS: {
  key: keyof Pick<HarnessFileOpStyle, "readPct" | "editPct" | "writePct">;
  label: string;
  bg: string;
  legendBg: string;
}[] = [
  {
    key: "readPct",
    label: "Read",
    bg: "bg-blue-500",
    legendBg: "bg-blue-500",
  },
  {
    key: "editPct",
    label: "Edit",
    bg: "bg-blue-400",
    legendBg: "bg-blue-400",
  },
  {
    key: "writePct",
    label: "Write",
    bg: "bg-blue-300",
    legendBg: "bg-blue-300",
  },
];

export default function FileOpStyleBar({ fileOpStyle }: FileOpStyleBarProps) {
  if (!fileOpStyle.style) return null;

  const searchPct = Math.max(
    0,
    100 - fileOpStyle.readPct - fileOpStyle.editPct - fileOpStyle.writePct,
  );

  return (
    <div className="flex flex-col justify-center">
      <div className="mb-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
        File Operations
      </div>

      <div className="mb-2 grid gap-1.5 text-[11px] sm:grid-cols-2">
        {SEGMENTS.map((seg) => {
          const pct = fileOpStyle[seg.key];
          if (pct <= 0) return null;
          return (
            <div
              key={`stat-${seg.key}`}
              className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 dark:border-slate-700 dark:bg-slate-800/50"
            >
              <div className="flex items-center gap-1.5">
                <span className={`h-2.5 w-2.5 rounded-full ${seg.legendBg}`} />
                <span className="text-slate-600 dark:text-slate-300">
                  {seg.label}
                </span>
              </div>
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {pct}%
              </span>
            </div>
          );
        })}
        {searchPct > 0 && (
          <div className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 dark:border-slate-700 dark:bg-slate-800/50">
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-blue-100 dark:bg-blue-900/40" />
              <span className="text-slate-600 dark:text-slate-300">Search</span>
            </div>
            <span className="font-semibold text-slate-900 dark:text-slate-100">
              {searchPct}%
            </span>
          </div>
        )}
      </div>

      {/* Stacked bar */}
      <div className="flex h-4 overflow-hidden rounded-md">
        {SEGMENTS.map((seg) => {
          const pct = fileOpStyle[seg.key];
          if (pct <= 0) return null;
          return (
            <div
              key={seg.key}
              className={seg.bg}
              style={{ width: `${pct}%` }}
            />
          );
        })}
        {searchPct > 0 && (
          <div
            className="bg-blue-100 dark:bg-blue-900/40"
            style={{ width: `${searchPct}%` }}
          />
        )}
      </div>
      {/* Style insight */}
      <div className="mt-2.5 text-xs italic text-slate-500 dark:text-slate-400">
        {fileOpStyle.style}
      </div>
    </div>
  );
}
