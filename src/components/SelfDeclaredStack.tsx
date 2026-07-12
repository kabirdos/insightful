"use client";

import type { SelfDeclared, SelfDeclaredFields } from "@/types/insights";

interface SelfDeclaredStackProps {
  selfDeclared?: SelfDeclared | null;
}

/**
 * Ordered label map for the declared stack rows. `identity` is intentionally
 * excluded — it's rendered separately as a one-line quote/subtitle. This fixed
 * map is the single source of truth for which declared fields can render, so a
 * hostile/unknown key in the stored data never surfaces.
 */
const STACK_ROWS: ReadonlyArray<{
  key: Exclude<keyof SelfDeclaredFields, "identity">;
  label: string;
}> = [
  { key: "voice", label: "Voice" },
  { key: "editor", label: "Editor" },
  { key: "terminal", label: "Terminal" },
  { key: "mic", label: "Mic" },
  { key: "remote", label: "Remote" },
];

function formatDeclaredAt(iso: string): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * "My Stack" — the author's self-declared setup (voice / editor / terminal /
 * mic / remote posture + a one-line identity). Deliberately styled distinctly
 * from the harness-verified stat cards (dashed border, muted amber tint, an
 * explicit "Self-declared" badge + caveat) so it can NEVER be mistaken for
 * extracted data. Every value is untrusted free text — rendered as text only
 * (React escapes it); no HTML injection. Returns null when absent or empty.
 */
export default function SelfDeclaredStack({
  selfDeclared,
}: SelfDeclaredStackProps) {
  const fields = selfDeclared?.fields;
  if (!fields) return null;

  const identity =
    typeof fields.identity === "string" && fields.identity.length > 0
      ? fields.identity
      : null;
  const rows = STACK_ROWS.filter(
    ({ key }) => typeof fields[key] === "string" && fields[key]!.length > 0,
  );
  if (!identity && rows.length === 0) return null;

  const declaredAt = formatDeclaredAt(selfDeclared?.declaredAt ?? "");

  return (
    <div className="mb-6 rounded-xl border border-dashed border-amber-300/80 bg-amber-50/40 p-6 dark:border-amber-700/50 dark:bg-amber-950/15">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[15px] font-bold text-slate-900 dark:text-slate-100">
          My Stack
        </h3>
        <span className="inline-flex items-center rounded-full border border-amber-400/70 bg-amber-100/70 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-800 dark:border-amber-600/50 dark:bg-amber-900/30 dark:text-amber-300">
          Self-declared
        </span>
      </div>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        Self-reported by the author — not verified by the harness.
      </p>

      {identity && (
        <p className="mt-4 border-l-2 border-amber-300 pl-3 text-sm italic break-words text-slate-700 dark:border-amber-700 dark:text-slate-300">
          &ldquo;{identity}&rdquo;
        </p>
      )}

      {rows.length > 0 && (
        <dl className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2">
          {rows.map(({ key, label }) => (
            <div key={key} className="flex items-baseline gap-2">
              <dt className="w-16 shrink-0 text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                {label}
              </dt>
              <dd className="min-w-0 break-words text-sm text-slate-800 dark:text-slate-200">
                {fields[key]}
              </dd>
            </div>
          ))}
        </dl>
      )}

      {declaredAt && (
        <p className="mt-4 text-[11px] text-slate-400 dark:text-slate-500">
          Declared {declaredAt}
        </p>
      )}
    </div>
  );
}
