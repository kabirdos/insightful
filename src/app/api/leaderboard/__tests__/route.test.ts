/**
 * Privacy regression tests for GET /api/leaderboard.
 *
 * Codex review on the token-attribution work surfaced that the leaderboard
 * route resolved linesAdded / linesRemoved directly from harnessData and
 * the scalar columns without honoring `hiddenHarnessSections`. The detail
 * route (PR #113) and list-feed routes (PR #115) already strip hidden
 * sections; this guards that the leaderboard does too, specifically for
 * the "gitPatterns" section which gates line-count exposure.
 *
 * Follows the mocked-Prisma pattern from
 * src/app/api/insights/[username]/[slug]/__tests__/route.test.ts.
 */
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

// ── Mock the Prisma client ──────────────────────────────────────────

vi.mock("@/lib/db", () => ({
  prisma: {
    insightReport: {
      findMany: vi.fn(),
    },
  },
}));

// ── Imports after mocks ─────────────────────────────────────────────

import { prisma } from "@/lib/db";
import { GET as getLeaderboard } from "../route";

const mockPrisma = prisma as unknown as {
  insightReport: { findMany: Mock };
};

// ── Helpers ─────────────────────────────────────────────────────────

/**
 * A full-shape HarnessData fixture with a nonzero gitPatterns.linesAdded
 * string. stripHiddenHarnessData spreads every known key, so the fixture
 * has to carry the full shape or the filter throws before assertions run.
 */
function buildHarnessDataFixture(linesAddedString: string) {
  return {
    stats: { lifetimeTokens: 1_000_000 },
    autonomy: {} as unknown,
    featurePills: [],
    toolUsage: {},
    skillInventory: [],
    hookDefinitions: [],
    hookFrequency: {},
    plugins: [],
    harnessFiles: [],
    fileOpStyle: {} as unknown,
    agentDispatch: null,
    cliTools: {},
    languages: {},
    models: {},
    permissionModes: {},
    mcpServers: {},
    gitPatterns: {
      prCount: 42,
      commitCount: 100,
      linesAdded: linesAddedString,
      branchPrefixes: {},
    },
    versions: [],
    writeupSections: [],
    workflowData: null,
    integrityHash: "test-hash",
    skillVersion: null,
  };
}

function buildReportRow(opts: {
  username: string;
  hiddenHarnessSections: string[];
  harnessLinesAddedString: string;
  scalarLinesAdded: number | null;
  scalarLinesRemoved: number | null;
}) {
  return {
    publishedAt: new Date("2026-04-01T00:00:00.000Z"),
    totalTokens: 500_000,
    durationHours: 10,
    sessionCount: 20,
    linesAdded: opts.scalarLinesAdded,
    linesRemoved: opts.scalarLinesRemoved,
    dayCount: 7,
    harnessData: buildHarnessDataFixture(opts.harnessLinesAddedString),
    hiddenHarnessSections: opts.hiddenHarnessSections,
    author: {
      username: opts.username,
      displayName: opts.username,
      avatarUrl: null,
    },
  };
}

function getRequest(url: string): Request {
  return new Request(url, { method: "GET" });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/leaderboard — hiddenHarnessSections privacy", () => {
  it("zeroes linesAdded/linesRemoved for rows that hid gitPatterns, and preserves them for others", async () => {
    const hiddenRow = buildReportRow({
      username: "hider",
      hiddenHarnessSections: ["gitPatterns"],
      // Nonzero harness string — the pre-fix bug would surface this parsed
      // as ~44000 through resolveLinesAdded.
      harnessLinesAddedString: "44.0K",
      // Also seed scalar columns so we cover the demo/seeded-report path
      // where resolveLinesAdded prefers the scalar. The fix must zero
      // BOTH sources when gitPatterns is hidden.
      scalarLinesAdded: 12345,
      scalarLinesRemoved: 678,
    });
    const visibleRow = buildReportRow({
      username: "sharer",
      hiddenHarnessSections: [],
      harnessLinesAddedString: "10.0K",
      scalarLinesAdded: null,
      scalarLinesRemoved: null,
    });

    mockPrisma.insightReport.findMany.mockResolvedValue([
      hiddenRow,
      visibleRow,
    ]);

    const response = await getLeaderboard(
      getRequest("http://localhost/api/leaderboard"),
    );
    expect(response.status).toBe(200);
    const body = await response.json();

    const byUser: Record<
      string,
      { linesAdded: number | null; linesRemoved: number | null }
    > = {};
    for (const row of body.data) {
      byUser[row.username] = {
        linesAdded: row.linesAdded,
        linesRemoved: row.linesRemoved,
      };
    }

    // Privacy contract: hider's line counts must be zeroed out even
    // though both harnessData.gitPatterns.linesAdded AND the scalar
    // column carried real values.
    expect(byUser.hider.linesAdded).toBe(0);
    expect(byUser.hider.linesRemoved).toBe(0);

    // Non-regression: sharer (no hidden sections) still sees the
    // parsed harness value ("10.0K" → 10_000).
    expect(byUser.sharer.linesAdded).toBe(10_000);
  });

  it("treats a null hiddenHarnessSections (legacy rows) as nothing hidden", async () => {
    // Older rows may have hiddenHarnessSections === null rather than [].
    // The fix must not throw and must not accidentally treat null as
    // "everything hidden".
    const legacyRow = {
      ...buildReportRow({
        username: "legacy",
        hiddenHarnessSections: [],
        harnessLinesAddedString: "5.0K",
        scalarLinesAdded: null,
        scalarLinesRemoved: null,
      }),
      hiddenHarnessSections: null as unknown as string[],
    };

    mockPrisma.insightReport.findMany.mockResolvedValue([legacyRow]);

    const response = await getLeaderboard(
      getRequest("http://localhost/api/leaderboard"),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data[0].linesAdded).toBe(5_000);
  });
});
