"use client";

import {
  TOKEN_SECTION_NOTE,
  TOKEN_SECTION_TITLE,
  TOKEN_SECTION_WINDOW,
} from "@/lib/token-attribution";

/**
 * Grouped "Where tokens went (last 30 days)" card. Presentational shell only —
 * the caller decides visibility (via hasVisibleTokenBreakdown) and supplies the
 * four donuts as children, each gated / toggle-wrapped per that render site.
 */
export default function WhereTokensWent({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mb-6 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900/50">
      <h3 className="text-[15px] font-bold text-slate-900 dark:text-slate-100">
        {TOKEN_SECTION_TITLE}{" "}
        <span className="font-medium text-slate-400">
          ({TOKEN_SECTION_WINDOW})
        </span>
      </h3>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        {TOKEN_SECTION_NOTE}
      </p>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">{children}</div>
    </div>
  );
}
