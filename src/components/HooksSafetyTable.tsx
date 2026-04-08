"use client";

import type { HarnessHookDef } from "@/types/insights";

interface HooksSafetyTableProps {
  hookDefinitions: HarnessHookDef[];
}

export default function HooksSafetyTable({
  hookDefinitions,
}: HooksSafetyTableProps) {
  if (hookDefinitions.length === 0) return null;

  // Check if there's a safety gate hook
  const hasSafetyGate = hookDefinitions.some(
    (h) =>
      h.script.toLowerCase().includes("safety") ||
      h.event.toLowerCase().includes("pretooluse"),
  );

  return (
    <div className="mb-6 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900/50">
      <h3 className="mb-4 text-[15px] font-bold text-slate-900 dark:text-slate-100">
        Hooks & Safety
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700">
              <th className="pb-2 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Event
              </th>
              <th className="pb-2 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Matcher
              </th>
              <th className="pb-2 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Script
              </th>
            </tr>
          </thead>
          <tbody>
            {hookDefinitions.map((hook, i) => (
              <tr
                key={i}
                className="border-b border-slate-100 dark:border-slate-800"
              >
                <td className="py-2 pr-4 text-xs text-slate-600 dark:text-slate-400">
                  {hook.event}
                </td>
                <td className="py-2 pr-4">
                  <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                    {hook.matcher}
                  </code>
                </td>
                <td className="py-2">
                  <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                    {hook.script}
                  </code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {hasSafetyGate && (
        <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700 dark:bg-green-950/30 dark:text-green-400">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M8 1L2 4v4c0 3.3 2.6 6.4 6 7 3.4-.6 6-3.7 6-7V4L8 1z"
              fill="#22c55e"
            />
            <path d="M6.5 10.5l-2-2 1-1 1 1 3-3 1 1-4 4z" fill="#fff" />
          </svg>
          Custom Safety Gate
        </div>
      )}
    </div>
  );
}
