/**
 * Unit tests for src/lib/publish-report.ts — the server-side publish
 * used by the bearer direct-POST upload path (Unit 7 of the Wave 3b
 * plan). This closes the long-deferred "U7: server publish-report
 * test" gap.
 *
 * Behaviors locked here:
 *   - Draft flag + returned row shape.
 *   - Visibility default ("public") vs caller-supplied.
 *   - Denormalized stat column mapping from parsed.stats, including the
 *     null-stat edge case.
 *   - snake_case → camelCase section-key mapping (present vs absent).
 *   - Harness scalar denorm (Claude vs Codex vs non-harness), BigInt
 *     token coercion + rounding, and the null-token edge case.
 *   - Redaction wiring (applyRedactions runs for real).
 *   - Slug shape + auto-title fallback.
 *   - ReportGroupShare junction rows and ReportProject junction rows.
 *   - Transaction usage + array-column defaults.
 *
 * Prisma is mocked (no test DB). $transaction executes its callback
 * against the same mocked surface, and insightReport.create echoes its
 * input back so the returned row reflects the generated slug/authorId.
 * The pure helpers (applyRedactions, harness normalizers) run for real
 * so the mapping is exercised end-to-end.
 */
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    insightReport: { create: vi.fn() },
    project: { findMany: vi.fn() },
    reportProject: { createMany: vi.fn() },
    reportGroupShare: { createMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import { prisma } from "@/lib/db";
import { publishReport, type PublishReportArgs } from "../publish-report";
import type {
  InsightsData,
  ParsedInsightsReport,
  StoredHarnessData,
} from "@/types/insights";

const mockPrisma = prisma as unknown as {
  insightReport: { create: Mock };
  project: { findMany: Mock };
  reportProject: { createMany: Mock };
  reportGroupShare: { createMany: Mock };
  $transaction: Mock;
};

// ── Fixtures ────────────────────────────────────────────────────────

/** A structurally complete InsightsData with a distinct marker per section. */
function makeData(): InsightsData {
  return {
    project_areas: {
      areas: [{ name: "Acme", session_count: 3, description: "desc" }],
    },
    interaction_style: { narrative: "narr", key_pattern: "kp" },
    what_works: {
      intro: "intro",
      impressive_workflows: [{ title: "t", description: "d" }],
    },
    friction_analysis: { intro: "intro", categories: [] },
    suggestions: {
      claude_md_additions: [],
      features_to_try: [],
      usage_patterns: [],
    },
    on_the_horizon: { intro: "intro", opportunities: [] },
    fun_ending: { headline: "head", detail: "det" },
    at_a_glance: {
      whats_working: "w",
      whats_hindering: "h",
      quick_wins: "q",
      ambitious_workflows: "a",
    },
  };
}

function makeStats(
  overrides: Partial<ParsedInsightsReport["stats"]> = {},
): ParsedInsightsReport["stats"] {
  return {
    sessionCount: 42,
    analyzedCount: 40,
    messageCount: 512,
    hours: "12",
    commitCount: 7,
    dateRangeStart: "2026-06-01",
    dateRangeEnd: "2026-06-30",
    linesAdded: 2048,
    linesRemoved: 128,
    fileCount: 33,
    dayCount: 20,
    msgsPerDay: 25,
    ...overrides,
  };
}

function makeParsed(
  overrides: Partial<ParsedInsightsReport> = {},
): ParsedInsightsReport {
  return {
    stats: makeStats(),
    data: makeData(),
    detectedRedactions: [],
    ...overrides,
  };
}

function makeArgs(
  overrides: Partial<PublishReportArgs> = {},
): PublishReportArgs {
  return {
    userId: "user-1",
    username: "alice-smith",
    parsed: makeParsed(),
    redactions: [],
    projectIds: [],
    hiddenHarnessSections: [],
    isDraft: true,
    ...overrides,
  };
}

/** Minimal Claude Code harness payload (legacy shape). */
function claudeHarness(
  statsOverrides: Record<string, unknown> = {},
  autonomyLabel = "Highly Autonomous",
): StoredHarnessData {
  return {
    stats: {
      totalTokens: 4321,
      durationHours: 5.6,
      avgSessionMinutes: 42,
      prCount: 9,
      ...statsOverrides,
    },
    autonomy: { label: autonomyLabel },
    featurePills: [],
  } as unknown as StoredHarnessData;
}

/** Minimal Codex harness payload. */
function codexHarness(
  totalTokens: number | undefined = 2000,
): StoredHarnessData {
  return {
    tool: "codex",
    stats: { totalTokens, sessionCount: 12 },
  } as unknown as StoredHarnessData;
}

/** Grab the `data` argument of the single insightReport.create call. */
function createData(): Record<string, unknown> {
  return mockPrisma.insightReport.create.mock.calls[0][0].data;
}

beforeEach(() => {
  vi.clearAllMocks();
  // $transaction runs its callback against the same mocked surface.
  mockPrisma.$transaction.mockImplementation(
    async (cb: (tx: typeof mockPrisma) => Promise<unknown>) => cb(mockPrisma),
  );
  // create echoes the input so the returned row carries the generated
  // slug / authorId / isDraft the way the real client would.
  mockPrisma.insightReport.create.mockImplementation(
    async ({ data }: { data: Record<string, unknown> }) => ({
      id: "rpt-1",
      slug: data.slug,
      authorId: data.authorId,
      isDraft: data.isDraft,
    }),
  );
});

// ── Draft flag + return shape ───────────────────────────────────────

describe("publishReport — draft flag + return shape", () => {
  it("persists isDraft:true and returns the minimal created row", async () => {
    const result = await publishReport(makeArgs({ isDraft: true }));

    expect(createData().isDraft).toBe(true);
    expect(result).toEqual({
      id: "rpt-1",
      slug: expect.any(String),
      authorId: "user-1",
      isDraft: true,
    });
    // The create only projects the minimal fields the bearer path needs
    // to redirect; lock that select so a widening/narrowing is caught
    // (the mock can't honor `select` itself).
    expect(mockPrisma.insightReport.create.mock.calls[0][0].select).toEqual({
      id: true,
      slug: true,
      authorId: true,
      isDraft: true,
    });
  });

  it("persists isDraft:false when the caller publishes directly", async () => {
    await publishReport(makeArgs({ isDraft: false }));
    expect(createData().isDraft).toBe(false);
  });

  it("stamps authorId from the userId argument", async () => {
    await publishReport(makeArgs({ userId: "author-77" }));
    expect(createData().authorId).toBe("author-77");
  });
});

// ── Visibility ──────────────────────────────────────────────────────

describe("publishReport — visibility", () => {
  it("defaults to public when visibility is omitted", async () => {
    await publishReport(makeArgs());
    expect(createData().visibility).toBe("public");
  });

  it("honors a caller-supplied visibility", async () => {
    await publishReport(makeArgs({ visibility: "group" }));
    expect(createData().visibility).toBe("group");
  });
});

// ── Slug ────────────────────────────────────────────────────────────

describe("publishReport — slug", () => {
  it("generates a <YYYYMMDD>-<random> slug and returns it on the row", async () => {
    // Pin Math.random so the base36 suffix is deterministic (a raw 0
    // would otherwise yield an empty suffix — rare, but this removes the
    // flake and keeps the shape assertion strict).
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.123456789);
    let result;
    let slug: string;
    try {
      result = await publishReport(makeArgs());
      slug = createData().slug as string;
    } finally {
      randomSpy.mockRestore();
    }
    expect(slug).toMatch(/^\d{8}-[a-z0-9]{6}$/);
    // The returned row carries the same generated slug.
    expect(result.slug).toBe(slug);
  });
});

// ── Denormalized stat columns ───────────────────────────────────────

describe("publishReport — denormalized stat columns", () => {
  it("maps every stat field from parsed.stats onto the row", async () => {
    await publishReport(makeArgs());
    const data = createData();
    expect(data.sessionCount).toBe(42);
    expect(data.messageCount).toBe(512);
    expect(data.commitCount).toBe(7);
    expect(data.dateRangeStart).toBe("2026-06-01");
    expect(data.dateRangeEnd).toBe("2026-06-30");
    expect(data.linesAdded).toBe(2048);
    expect(data.linesRemoved).toBe(128);
    expect(data.fileCount).toBe(33);
    expect(data.dayCount).toBe(20);
    expect(data.msgsPerDay).toBe(25);
  });

  it("coerces missing/undefined stat fields to null (not undefined)", async () => {
    // A plain /insights report often lacks the enhanced stat fields.
    // Each column must land as an explicit null so the DB write is
    // deterministic rather than dropping the column.
    const sparseStats = {
      sessionCount: null,
      messageCount: null,
      commitCount: null,
      dateRangeStart: null,
      dateRangeEnd: null,
      linesAdded: undefined,
      linesRemoved: undefined,
      fileCount: undefined,
      dayCount: undefined,
      msgsPerDay: undefined,
    } as unknown as ParsedInsightsReport["stats"];

    await publishReport(
      makeArgs({
        // Supply an explicit title so the null dateRangeEnd doesn't pull
        // in the ambient current date.
        title: "Explicit Title",
        parsed: makeParsed({ stats: sparseStats }),
      }),
    );

    const data = createData();
    for (const key of [
      "sessionCount",
      "messageCount",
      "commitCount",
      "dateRangeStart",
      "dateRangeEnd",
      "linesAdded",
      "linesRemoved",
      "fileCount",
      "dayCount",
      "msgsPerDay",
    ]) {
      expect(data[key]).toBeNull();
    }
  });
});

// ── Section key mapping (snake_case → camelCase) ────────────────────

describe("publishReport — section key mapping", () => {
  it("maps each InsightsData section to its camelCase column", async () => {
    const parsed = makeParsed();
    await publishReport(makeArgs({ parsed }));
    const data = createData();
    // The mapping is the load-bearing part: what_works → impressiveWorkflows,
    // on_the_horizon → onTheHorizon, etc.
    expect(data.atAGlance).toEqual(parsed.data.at_a_glance);
    expect(data.interactionStyle).toEqual(parsed.data.interaction_style);
    expect(data.projectAreas).toEqual(parsed.data.project_areas);
    expect(data.impressiveWorkflows).toEqual(parsed.data.what_works);
    expect(data.frictionAnalysis).toEqual(parsed.data.friction_analysis);
    expect(data.suggestions).toEqual(parsed.data.suggestions);
    expect(data.onTheHorizon).toEqual(parsed.data.on_the_horizon);
    expect(data.funEnding).toEqual(parsed.data.fun_ending);
  });

  it("omits (undefined) sections that are absent from the parsed data", async () => {
    // A report missing some sections must leave those columns unset
    // rather than writing null over an optional Json column.
    const partial = {
      at_a_glance: { whats_working: "w" },
      interaction_style: { narrative: "n", key_pattern: "k" },
    } as unknown as InsightsData;

    await publishReport(makeArgs({ parsed: makeParsed({ data: partial }) }));
    const data = createData();
    expect(data.atAGlance).toEqual({ whats_working: "w" });
    // Absent sections resolve to undefined in the create payload.
    expect(data.projectAreas).toBeUndefined();
    expect(data.onTheHorizon).toBeUndefined();
    expect(data.funEnding).toBeUndefined();
  });
});

// ── Redaction wiring ────────────────────────────────────────────────

describe("publishReport — redaction wiring", () => {
  it("applies redactions before persisting the section columns", async () => {
    await publishReport(
      makeArgs({
        redactions: [
          {
            id: "r1",
            text: "Acme",
            type: "project_name",
            context: "Acme",
            sectionKey: "project_areas",
            action: "redact",
          },
        ],
      }),
    );

    const projectAreas = createData().projectAreas as {
      areas: Array<{ name: string; description: string }>;
    };
    // The project name is redacted and its description cleared (v2 rule).
    expect(projectAreas.areas[0].name).toBe("[redacted]");
    expect(projectAreas.areas[0].description).toBe("[redacted]");
  });
});

// ── Auto-title fallback ─────────────────────────────────────────────

describe("publishReport — title fallback", () => {
  it("uses a caller-supplied title verbatim", async () => {
    await publishReport(makeArgs({ title: "My Custom Title" }));
    expect(createData().title).toBe("My Custom Title");
  });

  it("builds a Claude Code Insights title from the username + date range", async () => {
    await publishReport(
      makeArgs({ parsed: makeParsed({ reportType: "insights" }) }),
    );
    // First name is the first dash/underscore segment of the username.
    expect(createData().title).toBe("alice's Claude Code Insights - Jun 2026");
  });

  it("builds an Insight Harness title for harness reports", async () => {
    await publishReport(
      makeArgs({ parsed: makeParsed({ reportType: "insight-harness" }) }),
    );
    expect(createData().title).toBe("alice's Insight Harness - Jun 2026");
  });
});

// ── Harness scalar denorm ───────────────────────────────────────────

describe("publishReport — harness scalar denorm", () => {
  it("derives Claude harness scalars, coercing tokens to BigInt and rounding hours", async () => {
    await publishReport(
      makeArgs({
        parsed: makeParsed({
          reportType: "insight-harness",
          harnessData: claudeHarness(),
        }),
      }),
    );
    const data = createData();
    expect(data.totalTokens).toBe(BigInt(4321));
    expect(data.durationHours).toBe(6); // 5.6 rounded
    expect(data.avgSessionMinutes).toBe(42);
    expect(data.prCount).toBe(9);
    expect(data.autonomyLabel).toBe("Highly Autonomous");
    // The normalized envelope is stored, not the raw legacy object.
    expect(data.harnessData).toMatchObject({
      primaryTool: "claude-code",
      tools: { "claude-code": { stats: { totalTokens: 4321 } } },
    });
  });

  it("rounds a fractional token count before the BigInt cast", async () => {
    await publishReport(
      makeArgs({
        parsed: makeParsed({
          reportType: "insight-harness",
          harnessData: claudeHarness({ totalTokens: 1000.6 }),
        }),
      }),
    );
    expect(createData().totalTokens).toBe(BigInt(1001));
  });

  it("nulls token/duration scalars when the harness lacks numeric stats", async () => {
    await publishReport(
      makeArgs({
        parsed: makeParsed({
          reportType: "insight-harness",
          harnessData: claudeHarness({
            totalTokens: undefined,
            durationHours: undefined,
            avgSessionMinutes: undefined,
            prCount: undefined,
          }),
        }),
      }),
    );
    const data = createData();
    expect(data.totalTokens).toBeNull();
    expect(data.durationHours).toBeNull();
    expect(data.avgSessionMinutes).toBeNull();
    expect(data.prCount).toBeNull();
  });

  it("derives token count from Codex stats and nulls Claude-only scalars", async () => {
    await publishReport(
      makeArgs({
        parsed: makeParsed({
          reportType: "insight-harness",
          harnessData: codexHarness(2000),
        }),
      }),
    );
    const data = createData();
    expect(data.totalTokens).toBe(BigInt(2000));
    // durationHours/avgSessionMinutes/prCount/autonomyLabel are Claude-only.
    expect(data.durationHours).toBeNull();
    expect(data.avgSessionMinutes).toBeNull();
    expect(data.prCount).toBeNull();
    expect(data.autonomyLabel).toBeNull();
    expect(data.harnessData).toMatchObject({
      primaryTool: "codex",
      tools: { codex: { tool: "codex", stats: { totalTokens: 2000 } } },
    });
  });

  it("leaves all harness scalars null and harnessData unset when no harnessData is present", async () => {
    // The scalars derive from harnessData presence, NOT from reportType.
    // Default parsed carries no harnessData → every harness column nulls
    // out and harnessData is left undefined.
    await publishReport(makeArgs());
    const data = createData();
    expect(data.totalTokens).toBeNull();
    expect(data.durationHours).toBeNull();
    expect(data.avgSessionMinutes).toBeNull();
    expect(data.prCount).toBeNull();
    expect(data.autonomyLabel).toBeNull();
    expect(data.harnessData).toBeUndefined();
  });
});

// ── Column defaults / passthrough ───────────────────────────────────

describe("publishReport — column defaults + passthrough", () => {
  it("defaults reportType to insights and detectedSkills to []", async () => {
    await publishReport(makeArgs());
    const data = createData();
    expect(data.reportType).toBe("insights");
    expect(data.detectedSkills).toEqual([]);
  });

  it("passes through reportType, detectedSkills, chartData, and hiddenHarnessSections", async () => {
    await publishReport(
      makeArgs({
        hiddenHarnessSections: ["skills", "hooks"],
        parsed: makeParsed({
          reportType: "insight-harness",
          detectedSkills: ["worktrees", "hooks"],
          chartData: { toolUsage: [{ label: "Read", value: 5 }] },
        }),
      }),
    );
    const data = createData();
    expect(data.reportType).toBe("insight-harness");
    expect(data.detectedSkills).toEqual(["worktrees", "hooks"]);
    expect(data.chartData).toEqual({
      toolUsage: [{ label: "Read", value: 5 }],
    });
    expect(data.hiddenHarnessSections).toEqual(["skills", "hooks"]);
  });
});

// ── Group-share junction rows ───────────────────────────────────────

describe("publishReport — group-share rows", () => {
  it("creates a ReportGroupShare row per groupId", async () => {
    await publishReport(
      makeArgs({ visibility: "group", groupIds: ["g1", "g2"] }),
    );
    expect(mockPrisma.reportGroupShare.createMany).toHaveBeenCalledWith({
      data: [
        { reportId: "rpt-1", groupId: "g1" },
        { reportId: "rpt-1", groupId: "g2" },
      ],
      skipDuplicates: true,
    });
  });

  it("does not touch reportGroupShare when groupIds is empty", async () => {
    await publishReport(makeArgs({ groupIds: [] }));
    expect(mockPrisma.reportGroupShare.createMany).not.toHaveBeenCalled();
  });

  it("does not touch reportGroupShare when groupIds is omitted", async () => {
    await publishReport(makeArgs());
    expect(mockPrisma.reportGroupShare.createMany).not.toHaveBeenCalled();
  });
});

// ── Project junction rows ───────────────────────────────────────────

describe("publishReport — project junction rows", () => {
  it("skips the project lookup entirely when projectIds is empty", async () => {
    await publishReport(makeArgs({ projectIds: [] }));
    expect(mockPrisma.project.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.reportProject.createMany).not.toHaveBeenCalled();
  });

  it("creates junction rows only for projects the user owns, with positions", async () => {
    // p3 is not owned by the user and must be filtered out.
    mockPrisma.project.findMany.mockResolvedValue([{ id: "p1" }, { id: "p2" }]);

    await publishReport(makeArgs({ projectIds: ["p1", "p2", "p3"] }));

    expect(mockPrisma.project.findMany).toHaveBeenCalledWith({
      where: { id: { in: ["p1", "p2", "p3"] }, userId: "user-1" },
      select: { id: true },
    });
    expect(mockPrisma.reportProject.createMany).toHaveBeenCalledWith({
      data: [
        { reportId: "rpt-1", projectId: "p1", position: 0 },
        { reportId: "rpt-1", projectId: "p2", position: 1 },
      ],
      skipDuplicates: true,
    });
  });

  it("does not create junction rows when none of the projectIds are owned", async () => {
    mockPrisma.project.findMany.mockResolvedValue([]);
    await publishReport(makeArgs({ projectIds: ["p1"] }));
    expect(mockPrisma.reportProject.createMany).not.toHaveBeenCalled();
  });
});

// ── Transaction ─────────────────────────────────────────────────────

describe("publishReport — transaction", () => {
  it("wraps the write in a single $transaction", async () => {
    await publishReport(makeArgs());
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mockPrisma.insightReport.create).toHaveBeenCalledTimes(1);
  });
});
