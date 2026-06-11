"use client";

import type { HarnessData } from "@/types/insights";
import {
  deriveSignaturePatterns,
  type SignaturePattern,
} from "@/lib/signature-patterns";

interface SignaturePatternsProps {
  harnessData?: HarnessData | null;
}

function VerifiedBadge({ tone = "light" }: { tone?: "light" | "dark" }) {
  if (tone === "dark") {
    return (
      <span className="shrink-0 rounded-full border border-green-400/30 bg-green-400/15 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-green-300">
        ✓ Verified
      </span>
    );
  }
  return (
    <span className="shrink-0 rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-green-700 dark:border-green-800 dark:bg-green-900/30 dark:text-green-400">
      Verified
    </span>
  );
}

/** The mono "▸ a · b · c" evidence line shared by both card styles. */
function ProofLine({
  proof,
  dark = false,
}: {
  proof: string[];
  dark?: boolean;
}) {
  if (proof.length === 0) return null;
  return (
    <div
      className={
        dark
          ? "mt-3 flex flex-wrap gap-x-1.5 gap-y-1 border-t border-white/10 pt-3 font-mono text-[11px] leading-relaxed text-slate-400"
          : "mt-3 rounded-lg bg-slate-50 px-3 py-2 font-mono text-[11px] leading-relaxed text-slate-500 dark:bg-slate-800/60 dark:text-slate-400"
      }
    >
      <span aria-hidden="true">▸</span>{" "}
      {proof.map((chip, i) => (
        <span key={i}>
          {i > 0 && (
            <span className="text-slate-300 dark:text-slate-600"> · </span>
          )}
          {chip}
        </span>
      ))}
    </div>
  );
}

function LeadCard({ pattern }: { pattern: SignaturePattern }) {
  return (
    <div className="rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 p-6 text-white">
      <div className="flex items-center justify-between gap-3">
        <div className="text-2xl font-extrabold">{pattern.headline}</div>
        <VerifiedBadge tone="dark" />
      </div>
      <div className="mt-1 text-sm text-slate-300">
        {pattern.characterization}
      </div>
      <ProofLine proof={pattern.proof} dark />
    </div>
  );
}

function GridCard({ pattern }: { pattern: SignaturePattern }) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900/50">
      <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-blue-500 to-violet-500" />
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-bold text-slate-900 dark:text-slate-100">
          {pattern.headline}
        </h3>
        <VerifiedBadge />
      </div>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
        {pattern.characterization}
      </p>
      <ProofLine proof={pattern.proof} />
    </div>
  );
}

/**
 * "Signature patterns" — leads the Dashboard with 3–5 verified characterizations
 * of how this person works (autonomy, sub-agent orchestration, explore-first
 * discipline, Claude+Codex, skill authorship), each derived from real harness
 * data (see src/lib/signature-patterns.ts). Renders nothing when no pattern
 * clears its evidence threshold, so older/sparse reports are unaffected.
 */
export default function SignaturePatterns({
  harnessData,
}: SignaturePatternsProps) {
  const patterns = deriveSignaturePatterns(harnessData);
  if (patterns.length === 0) return null;

  const lead = patterns.find((p) => p.emphasis === "lead");
  const rest = patterns.filter((p) => p.emphasis !== "lead");

  return (
    <section className="mb-6 space-y-4">
      <div className="flex items-baseline gap-3 border-b border-slate-200 pb-2 dark:border-slate-700">
        <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          Signature patterns
        </h2>
        <span className="font-mono text-xs text-slate-400">
          how they work · drawn from real data
        </span>
      </div>

      {lead && <LeadCard pattern={lead} />}

      {rest.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {rest.map((p) => (
            <GridCard key={p.id} pattern={p} />
          ))}
        </div>
      )}
    </section>
  );
}
