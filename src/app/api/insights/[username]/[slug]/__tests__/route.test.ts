/**
 * Visibility boundary tests for GET /api/insights/[username]/[slug].
 *
 * Regression guard for issue #108: the `includeHidden` query flag must
 * only be honored when the caller is the report's author. Non-owners
 * must never see hidden ReportProject rows or hidden harness sections,
 * regardless of what they pass in `?includeHidden`.
 *
 * Follows the mocked-Prisma + mocked-auth pattern established in
 * src/app/api/projects/__tests__/route.test.ts.
 */
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

// ── Mock the Prisma client ──────────────────────────────────────────

vi.mock("@/lib/db", () => ({
  prisma: {
    insightReport: {
      findFirst: vi.fn(),
    },
    reportProject: {
      findMany: vi.fn(),
    },
  },
}));

// ── Mock next-auth ──────────────────────────────────────────────────

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

// ── Imports after mocks ─────────────────────────────────────────────

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { GET as getInsight } from "../route";

const mockAuth = auth as unknown as Mock;
const mockPrisma = prisma as unknown as {
  insightReport: { findFirst: Mock };
  reportProject: { findMany: Mock };
};

// ── Helpers ─────────────────────────────────────────────────────────

function mockSession(userId: string | null) {
  if (userId === null) {
    mockAuth.mockResolvedValue(null);
  } else {
    mockAuth.mockResolvedValue({ user: { id: userId } });
  }
}

function paramsPromise<T>(value: T): Promise<T> {
  return Promise.resolve(value);
}

function getRequest(url: string): Request {
  return new Request(url, { method: "GET" });
}

/**
 * A full-shape HarnessData fixture. The harness filter
 * (stripHiddenHarnessData) unconditionally spreads every key it knows
 * about, so any missing field throws `X is not iterable` before the
 * privacy assertions we actually care about can run.
 *
 * "plugins" is populated so we can assert it disappears from the
 * non-owner response (hiddenHarnessSections contains "plugins").
 * "skillInventory" is populated so we can assert non-hidden sections
 * survive.
 */
function buildHarnessDataFixture() {
  return {
    stats: {} as unknown,
    autonomy: {} as unknown,
    featurePills: [],
    toolUsage: {},
    skillInventory: [{ name: "visible-skill" }],
    hookDefinitions: [],
    hookFrequency: {},
    plugins: [{ name: "hidden-plugin" }],
    harnessFiles: [],
    fileOpStyle: {} as unknown,
    agentDispatch: null,
    cliTools: {},
    languages: {},
    models: {},
    permissionModes: {},
    mcpServers: {},
    gitPatterns: {
      prCount: 0,
      commitCount: 0,
      linesAdded: "0",
      branchPrefixes: {},
    },
    versions: [],
    writeupSections: [],
    workflowData: null,
    integrityHash: "test-hash",
    skillVersion: null,
  };
}

/**
 * Build a report fixture the route's findFirst query would return.
 *
 * The route's Prisma query uses `reportProjects: { where: { hidden: false } }`,
 * so the top-level `reportProjects` we return from findFirst represents the
 * VISIBLE rows only. Hidden rows are fetched by a second findMany call below
 * and are only appended when the caller is the owner + includeHidden=true.
 *
 * Callers pass `authorId` to control ownership.
 */
function buildReportFixture(authorId: string) {
  return {
    id: "r1",
    slug: "s1",
    authorId,
    // v2 scalar fields the detail route's contract check expects
    chartData: null,
    detectedSkills: null,
    dayCount: null,
    linesAdded: null,
    linesRemoved: null,
    fileCount: null,
    // The privacy gate under test: non-owners must not see projects in
    // this list that were hidden, AND must not see hidden harness
    // sections even if they pass ?includeHidden=true. stripHiddenHarnessData
    // (src/lib/harness-section-visibility.ts) spreads every field on
    // HarnessData, so this fixture has to carry the full shape or the route
    // throws before the assertions run.
    harnessData: buildHarnessDataFixture(),
    hiddenHarnessSections: ["plugins"],
    author: {
      id: authorId,
      username: "u1",
      displayName: "U One",
      avatarUrl: null,
      bio: null,
    },
    // VISIBLE junction rows only — Prisma's `where: { hidden: false }`
    // already filtered hidden rows out.
    reportProjects: [
      {
        id: "rp-visible",
        reportId: "r1",
        projectId: "p-visible",
        hidden: false,
        position: 0,
        project: { id: "p-visible", name: "Visible Project" },
      },
    ],
    annotations: [],
    votes: [],
    highlights: [],
    _count: { comments: 0 },
  };
}

// The hidden junction row the second findMany would return for owners
// who pass ?includeHidden=true.
const HIDDEN_JUNCTION_ROW = {
  id: "rp-hidden",
  reportId: "r1",
  projectId: "p-hidden",
  hidden: true,
  position: 1,
  project: { id: "p-hidden", name: "Hidden Project" },
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Visibility boundary — non-owner ─────────────────────────────────

describe("GET /api/insights/[username]/[slug] — non-owner visibility", () => {
  it("filters hidden projects even when ?includeHidden=true is passed by a non-owner", async () => {
    // Author of the report is user-1; the caller (user-2) is NOT the owner.
    mockSession("user-2");
    mockPrisma.insightReport.findFirst.mockResolvedValue(
      buildReportFixture("user-1"),
    );

    const response = await getInsight(
      getRequest("http://localhost/api/insights/u1/s1?includeHidden=true"),
      { params: paramsPromise({ username: "u1", slug: "s1" }) },
    );
    expect(response.status).toBe(200);
    const body = await response.json();

    // The hidden-fetch branch must NOT have executed for a non-owner.
    expect(mockPrisma.reportProject.findMany).not.toHaveBeenCalled();

    const projectIds = body.data.reportProjects.map(
      (rp: { projectId: string }) => rp.projectId,
    );
    expect(projectIds).toContain("p-visible");
    expect(projectIds).not.toContain("p-hidden");

    // Bonus: hidden harness sections must also not leak on the non-owner
    // path. `plugins` is in hiddenHarnessSections and is a strippable
    // top-level key; it must be absent from the response harnessData.
    expect(body.data.harnessData.skillInventory).toBeDefined();
    // stripHiddenHarnessData empties rather than deletes hidden keys.
    expect(body.data.harnessData.plugins).toEqual([]);
  });

  it("filters hidden projects for anonymous (no session) callers too", async () => {
    // Extra regression: no session at all is the most common non-owner
    // case (public link shares).
    mockSession(null);
    mockPrisma.insightReport.findFirst.mockResolvedValue(
      buildReportFixture("user-1"),
    );

    const response = await getInsight(
      getRequest("http://localhost/api/insights/u1/s1?includeHidden=true"),
      { params: paramsPromise({ username: "u1", slug: "s1" }) },
    );
    expect(response.status).toBe(200);
    const body = await response.json();

    expect(mockPrisma.reportProject.findMany).not.toHaveBeenCalled();
    const projectIds = body.data.reportProjects.map(
      (rp: { projectId: string }) => rp.projectId,
    );
    expect(projectIds).not.toContain("p-hidden");
    // stripHiddenHarnessData empties rather than deletes hidden keys.
    expect(body.data.harnessData.plugins).toEqual([]);
  });
});

// ── Visibility boundary — owner ─────────────────────────────────────

describe("GET /api/insights/[username]/[slug] — owner visibility", () => {
  it("returns hidden + visible projects when the owner passes ?includeHidden=true", async () => {
    // Author of the report is user-1 and the caller is user-1.
    mockSession("user-1");
    mockPrisma.insightReport.findFirst.mockResolvedValue(
      buildReportFixture("user-1"),
    );
    mockPrisma.reportProject.findMany.mockResolvedValue([HIDDEN_JUNCTION_ROW]);

    const response = await getInsight(
      getRequest("http://localhost/api/insights/u1/s1?includeHidden=true"),
      { params: paramsPromise({ username: "u1", slug: "s1" }) },
    );
    expect(response.status).toBe(200);
    const body = await response.json();

    // The owner branch MUST have fired the second findMany for hidden rows.
    expect(mockPrisma.reportProject.findMany).toHaveBeenCalledWith({
      where: { reportId: "r1", hidden: true },
      orderBy: { position: "asc" },
      include: { project: true },
    });

    const projectIds = body.data.reportProjects.map(
      (rp: { projectId: string }) => rp.projectId,
    );
    expect(projectIds).toContain("p-visible");
    expect(projectIds).toContain("p-hidden");

    // Owner+includeHidden gets unfiltered harnessData (edit-page contract
    // in src/lib/filter-report-response.ts line ~42).
    expect(body.data.harnessData.plugins).toEqual([{ name: "hidden-plugin" }]);
  });

  it("does NOT fetch hidden rows when the owner omits ?includeHidden", async () => {
    // Same owner, no flag → should behave like a public view of their own
    // report (visible-only). Guards against accidental leakage via UI that
    // forgets to pass the flag.
    mockSession("user-1");
    mockPrisma.insightReport.findFirst.mockResolvedValue(
      buildReportFixture("user-1"),
    );

    const response = await getInsight(
      getRequest("http://localhost/api/insights/u1/s1"),
      { params: paramsPromise({ username: "u1", slug: "s1" }) },
    );
    expect(response.status).toBe(200);
    const body = await response.json();

    expect(mockPrisma.reportProject.findMany).not.toHaveBeenCalled();
    const projectIds = body.data.reportProjects.map(
      (rp: { projectId: string }) => rp.projectId,
    );
    expect(projectIds).not.toContain("p-hidden");
  });
});

// ── List feed ───────────────────────────────────────────────────────

// TODO(issue-108): The list-feed path is not reachable from this detail
// route — `filterReportForListFeed` is called by other routes (e.g.
// /api/insights list, homepage feed, /top) rather than
// /api/insights/[username]/[slug]. Add an equivalent test alongside the
// list-feed route handler that owns that call site, asserting the feed
// response never includes hidden projects even when the caller is the
// report's owner (per filter-report-response.ts line ~190, list feeds
// hardcode viewerIsOwner: false / includeHidden: false).
