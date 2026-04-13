// Pure function that derives safe-to-show profile setup suggestions from a
// (privacy-filtered) HarnessData blob. Never returns paths or other
// evidence — only labels. See docs/plans/2026-04-13-profile-setup-fields.md §7.

import type { HarnessData } from "@/types/insights";
import type { DerivedSetupFields } from "@/types/profile";

const PACKAGE_MANAGER_KEYS = new Set([
  "pnpm",
  "npm",
  "yarn",
  "bun",
  "uv",
  "pip",
  "poetry",
  "cargo",
  "go",
  "mise",
  "asdf",
]);

const MCP_TOP_N = 8;

function pickMaxKey<T>(
  record: Record<string, T> | undefined | null,
  score: (value: T) => number,
): string | undefined {
  if (!record) return undefined;
  let best: string | undefined;
  let bestScore = -Infinity;
  for (const [key, value] of Object.entries(record)) {
    const s = score(value);
    if (s > bestScore) {
      bestScore = s;
      best = key;
    }
  }
  return bestScore > 0 ? best : undefined;
}

function derivePrimaryModel(harness: HarnessData): string | undefined {
  // Prefer active-token share (input+output) from perModelTokens. Cache
  // traffic is deliberately excluded because cached context inflates the
  // "primary" signal toward whichever model inherited the long cache.
  if (harness.perModelTokens) {
    const fromTokens = pickMaxKey(
      harness.perModelTokens,
      (v) => (v?.input ?? 0) + (v?.output ?? 0),
    );
    if (fromTokens) return fromTokens;
  }
  return pickMaxKey(harness.models, (count) => count);
}

function deriveMcpServers(harness: HarnessData): string[] | undefined {
  const entries = Object.entries(harness.mcpServers ?? {});
  if (entries.length === 0) return undefined;
  const sorted = entries
    .sort((a, b) => b[1] - a[1])
    .slice(0, MCP_TOP_N)
    .map(([key]) => key);
  return sorted.length > 0 ? sorted : undefined;
}

function derivePackageManager(harness: HarnessData): string | undefined {
  const entries = Object.entries(harness.cliTools ?? {}).filter(([key]) =>
    PACKAGE_MANAGER_KEYS.has(key.toLowerCase()),
  );
  if (entries.length === 0) return undefined;
  entries.sort((a, b) => b[1] - a[1]);
  return entries[0][0];
}

// ── OS heuristic ────────────────────────────────────────────────────────
// Returns ONLY a label. Never echoes, logs, or serializes the matched path
// or source string. The callers rely on this invariant — test coverage in
// profile-setup-derive.test.ts enforces it.

function classifyOsFromString(str: string): string | undefined {
  if (str.includes("/Users/")) return "macOS";
  if (str.includes("/home/")) return "Linux";
  if (/[A-Za-z]:\\/.test(str)) return "Windows";
  if (str.includes("\\\\wsl$")) return "WSL (Windows)";
  if (/-darwin(?:\b|$)/i.test(str)) return "macOS";
  if (/-linux(?:\b|$)/i.test(str)) return "Linux";
  if (/-windows(?:\b|$)/i.test(str)) return "Windows";
  return undefined;
}

function deriveOs(harness: HarnessData): string | undefined {
  const sources: string[] = [];
  if (Array.isArray(harness.harnessFiles))
    sources.push(...harness.harnessFiles);
  if (Array.isArray(harness.versions)) sources.push(...harness.versions);
  for (const s of sources) {
    if (typeof s !== "string") continue;
    const label = classifyOsFromString(s);
    if (label) return label;
  }
  return undefined;
}

/**
 * Derive suggestions purely from data found in the harness blob. The
 * helper is intentionally data-only — a "Claude Code" primaryAgent default
 * is the endpoint's responsibility, decided after status classification, so
 * an empty harness can honestly return `{}` and produce a `no-suggestions`
 * state upstream.
 */
export function deriveSetupFromHarness(
  harness: HarnessData,
): DerivedSetupFields {
  const out: DerivedSetupFields = {};

  const primaryModel = derivePrimaryModel(harness);
  if (primaryModel) out.primaryModel = primaryModel;

  const mcpServers = deriveMcpServers(harness);
  if (mcpServers) out.mcpServers = mcpServers;

  const packageManager = derivePackageManager(harness);
  if (packageManager) out.packageManager = packageManager;

  const os = deriveOs(harness);
  if (os) out.os = os;

  return out;
}
