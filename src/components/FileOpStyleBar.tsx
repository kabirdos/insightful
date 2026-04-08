"use client";

import type { HarnessFileOpStyle } from "@/types/insights";

interface FileOpStyleBarProps {
  fileOpStyle: HarnessFileOpStyle;
}

const SEGMENTS: {
  key: keyof Pick<HarnessFileOpStyle, "readPct" | "editPct" | "writePct">;
  label: string;
  shortLabel: string;
  bg: string;
  textColor: string;
  legendBg: string;
}[] = [
  {
    key: "readPct",
    label: "Read",
    shortLabel: "Read",
    bg: "bg-blue-500",
    textColor: "text-white",
    legendBg: "bg-blue-500",
  },
  {
    key: "editPct",
    label: "Edit",
    shortLabel: "Edit",
    bg: "bg-blue-400",
    textColor: "text-white",
    legendBg: "bg-blue-400",
  },
  {
    key: "writePct",
    label: "Write",
    shortLabel: "Wr",
    bg: "bg-blue-300",
    textColor: "text-blue-900 dark:text-blue-100",
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
      {/* Stacked bar */}
      <div className="flex h-7 overflow-hidden rounded-md">
        {SEGMENTS.map((seg) => {
          const pct = fileOpStyle[seg.key];
          if (pct <= 0) return null;
          return (
            <div
              key={seg.key}
              className={`flex items-center justify-center text-[10px] font-semibold ${seg.bg} ${seg.textColor}`}
              style={{ width: `${pct}%` }}
            >
              {pct >= 10
                ? `${seg.label} ${pct}%`
                : pct >= 5
                  ? `${seg.shortLabel}`
                  : ""}
            </div>
          );
        })}
        {searchPct > 0 && (
          <div
            className="flex items-center justify-center bg-blue-100 text-[10px] font-semibold text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
            style={{ width: `${searchPct}%` }}
          >
            {searchPct >= 5 ? `${searchPct}%` : ""}
          </div>
        )}
      </div>
      {/* Legend */}
      <div className="mt-1.5 flex flex-wrap gap-3">
        {SEGMENTS.map((seg) => {
          if (fileOpStyle[seg.key] <= 0) return null;
          return (
            <div key={seg.key} className="flex items-center gap-1">
              <div className={`h-2 w-2 rounded-sm ${seg.legendBg}`} />
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                {seg.label}
              </span>
            </div>
          );
        })}
        {searchPct > 0 && (
          <div className="flex items-center gap-1">
            <div className="h-2 w-2 rounded-sm bg-blue-100 dark:bg-blue-900/40" />
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              Search
            </span>
          </div>
        )}
      </div>
      {/* Style insight */}
      <div className="mt-2.5 text-xs italic text-slate-500 dark:text-slate-400">
        {fileOpStyle.style}
      </div>
    </div>
  );
}
