"use client";

import type { HarnessFeaturePill } from "@/types/insights";

interface PermissionModeDisplayProps {
  permissionModes: Record<string, number>;
  featurePills: HarnessFeaturePill[];
}

export default function PermissionModeDisplay({
  permissionModes,
  featurePills,
}: PermissionModeDisplayProps) {
  const modeEntries = Object.entries(permissionModes).sort(
    (a, b) => b[1] - a[1],
  );
  const safetyPills = featurePills.filter(
    (p) =>
      p.name.toLowerCase().includes("safety") ||
      p.name.toLowerCase().includes("hook") ||
      p.name.toLowerCase().includes("permission") ||
      p.name.toLowerCase().includes("auto") ||
      p.active,
  );

  if (modeEntries.length === 0 && safetyPills.length === 0) return null;

  return (
    <div className="mb-6 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900/50">
      <h3 className="mb-4 text-[15px] font-bold text-slate-900 dark:text-slate-100">
        Permission Mode & Safety Posture
      </h3>
      <div className="grid gap-6 sm:grid-cols-2">
        {/* Permission mode bars */}
        {modeEntries.length > 0 && (
          <div>
            <div className="mb-2.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Default Permission Mode
            </div>
            <div className="flex flex-col gap-1.5">
              {modeEntries.map(([mode, pct]) => (
                <div key={mode} className="flex items-center gap-2">
                  <span className="w-20 text-right text-xs font-medium text-slate-500 dark:text-slate-400">
                    {mode}
                  </span>
                  <div className="h-4 flex-1 overflow-hidden rounded bg-slate-100 dark:bg-slate-800">
                    <div
                      className="h-full rounded bg-blue-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-9 text-right text-[11px] text-slate-500 dark:text-slate-400">
                    {pct}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Safety posture indicators */}
        {safetyPills.length > 0 && (
          <div>
            <div className="mb-2.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Safety & Feature Flags
            </div>
            <div className="flex flex-wrap gap-2">
              {safetyPills.map((pill) => (
                <span
                  key={pill.name}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    pill.active
                      ? "border border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950/30 dark:text-green-400"
                      : "border border-slate-200 bg-slate-50 text-slate-400 dark:border-slate-700 dark:bg-slate-800/50"
                  }`}
                >
                  {pill.name}
                  {pill.value && ` (${pill.value})`}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
