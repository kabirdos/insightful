import type { HarnessData } from "@/types/insights";

/**
 * A "signature pattern" — one verified characterization of how someone works,
 * derived from the already-persisted, already-scrubbed `harnessData`. Each is a
 * headline ("Orchestrates 304 sub-agents") + a one-line characterization + a
 * proof line of the verified numbers behind it. See B3 in
 * docs/brainstorms/2026-06-04-share-how-you-work-generalization-requirements.md
 * and docs/plans/2026-06-10-001-feat-signature-patterns-plan.md.
 *
 * Derived server-side at render time (not stored), so it lights up for every
 * existing report without a re-run and makes zero `harnessData` shape change.
 */
export interface SignaturePattern {
  id: "autonomy" | "subagents" | "explore-first" | "dual-engine" | "authorship";
  headline: string;
  characterization: string;
  /** Verified proof chips, rendered as "▸ a · b · c". Each chip is only present
   *  when its underlying value is real (no silent zeros — see issue #29). */
  proof: string[];
  /** "lead" → the prominent dark card; undefined → the standard grid card. */
  emphasis?: "lead";
}

function nf(n: number): string {
  return n.toLocaleString();
}

/** Collapse a model id ("claude-opus-4-6", "gpt-5.5") to its family. */
function modelFamily(id: string): string | null {
  const s = id.toLowerCase();
  if (s.includes("opus")) return "opus";
  if (s.includes("sonnet")) return "sonnet";
  if (s.includes("haiku")) return "haiku";
  if (s.includes("gpt") || s.includes("codex") || s.includes("o3"))
    return "gpt";
  return null;
}

/** "sonnet 69 / opus 18" from a model→count map, families ordered by count. */
function modelTierChip(models: Record<string, number>): string | null {
  const byFamily: Record<string, number> = {};
  for (const [id, count] of Object.entries(models)) {
    const fam = modelFamily(id);
    if (fam) byFamily[fam] = (byFamily[fam] ?? 0) + count;
  }
  const entries = Object.entries(byFamily).sort((a, b) => b[1] - a[1]);
  if (entries.length < 2) return null; // a single family isn't "tiering"
  return entries.map(([fam, c]) => `${fam} ${c}`).join(" / ");
}

function topEntry(
  rec: Record<string, number>,
): { name: string; count: number } | null {
  let best: { name: string; count: number } | null = null;
  for (const [name, count] of Object.entries(rec)) {
    if (!best || count > best.count) best = { name, count };
  }
  return best;
}

function autonomyPattern(h: HarnessData): SignaturePattern | null {
  const a = h.autonomy;
  if (!a || !a.label || a.userMessages <= 0) return null;

  const ratio = Math.round(a.assistantMessages / a.userMessages);
  const bypass = h.permissionModes?.bypassPermissions ?? 0;
  const permTotal = Object.values(h.permissionModes ?? {}).reduce(
    (s, n) => s + n,
    0,
  );
  const bypassPct =
    bypass > 0 && permTotal > 0 ? Math.round((bypass / permTotal) * 100) : 0;
  const errorRate = a.errorRate && a.errorRate !== "0%" ? a.errorRate : "";

  const proof: string[] = [];
  if (ratio > 0) proof.push(`1 : ${ratio} human:agent turns`);
  proof.push(`${nf(a.userMessages)} sent · ${nf(a.assistantMessages)} back`);
  if (bypassPct > 0) proof.push(`${bypassPct}% bypassPermissions`);
  if (errorRate) proof.push(`${errorRate} error rate`);

  const ratioClause =
    ratio > 0
      ? ` For every message sent, the agent sends about ${ratio} back`
      : "";
  const hookClause = bypassPct >= 50 ? ", auto-approving along the way." : ".";

  return {
    id: "autonomy",
    headline: a.label,
    characterization: `Sets work in motion, then steps away.${ratioClause}${ratioClause ? hookClause : ""}`,
    proof,
    emphasis: "lead",
  };
}

function subagentsPattern(h: HarnessData): SignaturePattern | null {
  const d = h.agentDispatch;
  if (!d || d.totalAgents < 5) return null;

  const proof: string[] = [`${nf(d.totalAgents)} agents`];
  if (d.backgroundPct > 0) proof.push(`${d.backgroundPct}% background`);
  const tier = modelTierChip(d.models ?? {});
  if (tier) proof.push(tier);
  const top = topEntry(d.types ?? {});
  if (top) proof.push(`top type: ${top.name} (${nf(top.count)})`);

  return {
    id: "subagents",
    headline: `Orchestrates ${nf(d.totalAgents)} sub-agents`,
    characterization: `Fans out work to subagents and synthesizes in the foreground${
      tier ? ", model-tiered to cut cost" : ""
    }.`,
    proof,
  };
}

function exploreFirstPattern(h: HarnessData): SignaturePattern | null {
  const ps = h.workflowData?.phaseStats;
  if (!ps || ps.totalSessionsWithPhases < 5 || ps.exploreBeforeImplPct < 50)
    return null;

  const lowTest = ps.testBeforeShipPct < 20;
  return {
    id: "explore-first",
    headline: `Explores before building — ${ps.exploreBeforeImplPct}%`,
    characterization: lowTest
      ? "Strong explore-first discipline — and an honest gap: testing before shipping is rarer. The data shows the real shape, warts and all."
      : "Strong explore-first discipline, with testing wired into the loop before shipping.",
    proof: [
      `exploreBeforeImpl ${ps.exploreBeforeImplPct}%`,
      `testBeforeShip ${ps.testBeforeShipPct}%`,
      `across ${nf(ps.totalSessionsWithPhases)} sessions`,
    ],
  };
}

function dualEnginePattern(h: HarnessData): SignaturePattern | null {
  const codexCalls = h.cliTools?.codex ?? 0;
  if (codexCalls <= 0) return null;

  const branchCodex = h.gitPatterns?.branchPrefixes?.codex ?? 0;
  const proof: string[] = [`codex called ${nf(codexCalls)}×`];
  if (branchCodex > 0) proof.push(`codex branch prefix ${nf(branchCodex)}×`);

  return {
    id: "dual-engine",
    headline: "Runs Claude + Codex",
    characterization:
      "Claude is the coding harness; Codex runs alongside — even called from inside Claude.",
    proof,
  };
}

function authorshipPattern(h: HarnessData): SignaturePattern | null {
  const authored = (h.skillInventory ?? [])
    .filter((s) => s.source === "custom" || s.source === "user")
    .map((s) => s.name);
  if (authored.length < 2) return null;

  const shown = authored.slice(0, 6);
  const more = authored.length - shown.length;
  const list =
    more > 0 ? `${shown.join(", ")} +${more} more` : shown.join(", ");

  return {
    id: "authorship",
    headline:
      authored.length >= 3
        ? "Builds the tools they use"
        : `Author of ${authored.length} skills`,
    characterization:
      "Several of the skills in this profile are self-authored, not just installed.",
    proof: [`authored: ${list}`],
  };
}

/**
 * Derive the ordered list of signature patterns for a report. Returns only the
 * patterns that clear their evidence threshold (data-driven per user), with the
 * autonomy pattern first as the lead card. Empty array when nothing qualifies —
 * callers should render no section in that case.
 */
export function deriveSignaturePatterns(
  harnessData: HarnessData | null | undefined,
): SignaturePattern[] {
  if (!harnessData) return [];
  const candidates = [
    autonomyPattern(harnessData),
    subagentsPattern(harnessData),
    exploreFirstPattern(harnessData),
    dualEnginePattern(harnessData),
    authorshipPattern(harnessData),
  ];
  return candidates
    .filter((p): p is SignaturePattern => p !== null)
    .slice(0, 5);
}
