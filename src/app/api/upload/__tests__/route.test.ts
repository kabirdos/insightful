/**
 * Integration test for POST /api/upload — the route that runs harness
 * HTML through parseHarnessHtml + parseInsightsHtml and returns the
 * structured payload the client uses to drive report creation.
 *
 * Why this exists (#106):
 *   - The route has zero existing route-level coverage. A parser
 *     regression on a new harness format silently breaks report
 *     creation in production.
 *   - This test feeds a real-shaped v2.7.0 fixture end-to-end so the
 *     happy path is locked in. Future format changes that break the
 *     parser will show up here before they ship.
 *
 * Note on Prisma: this route does NOT touch the database. It parses,
 * normalizes, and returns JSON. Persistence happens in a separate
 * route the client calls afterwards. So the issue's "report row
 * created" assertion is covered by that downstream route's tests, not
 * here. We still mock @/lib/db to follow the established pattern and
 * to defend against accidental future Prisma calls in this handler.
 */
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

// ── Mock @/lib/db to match the repo route-test pattern ──────────────

vi.mock("@/lib/db", () => ({
  prisma: {
    report: {
      create: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

// ── Mock next-auth ──────────────────────────────────────────────────

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

// ── Imports after mocks ─────────────────────────────────────────────

import { auth } from "@/lib/auth";
import { POST as uploadPOST } from "../route";

const mockAuth = auth as unknown as Mock;

// ── Fixture loader ──────────────────────────────────────────────────

const FIXTURE_PATH = resolve(
  __dirname,
  "../../../../lib/__tests__/fixtures/insight-harness-v2.7.0.html",
);
const FIXTURE_HTML = readFileSync(FIXTURE_PATH, "utf-8");

// ── Helpers ─────────────────────────────────────────────────────────

function mockSession(userId: string | null) {
  if (userId === null) {
    mockAuth.mockResolvedValue(null);
  } else {
    mockAuth.mockResolvedValue({ user: { id: userId } });
  }
}

function uploadRequest(
  html: string,
  filename = "insight-harness.html",
): Request {
  const formData = new FormData();
  formData.append("file", new File([html], filename, { type: "text/html" }));
  return new Request("http://localhost/api/upload", {
    method: "POST",
    body: formData,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Tests ───────────────────────────────────────────────────────────

describe("POST /api/upload — auth", () => {
  it("returns 401 when there is no session", async () => {
    mockSession(null);
    const response = await uploadPOST(uploadRequest(FIXTURE_HTML));
    expect(response.status).toBe(401);
  });
});

describe("POST /api/upload — input validation", () => {
  it("returns 400 when no file field is present", async () => {
    mockSession("user-1");
    const formData = new FormData();
    const request = new Request("http://localhost/api/upload", {
      method: "POST",
      body: formData,
    });
    const response = await uploadPOST(request);
    expect(response.status).toBe(400);
  });

  it("returns 400 when filename does not end in .html or .htm", async () => {
    mockSession("user-1");
    const response = await uploadPOST(
      uploadRequest(FIXTURE_HTML, "report.pdf"),
    );
    expect(response.status).toBe(400);
  });

  it("returns 400 when the body is not multipart/form-data", async () => {
    // Passing a JSON body to a route that expects FormData trips
    // request.formData() → TypeError. Without an inner guard this
    // bubbles to the outer catch as a 500. Lock it to 4xx so a 5xx
    // regression never ships for this foot-gun class.
    mockSession("user-1");
    const request = new Request("http://localhost/api/upload", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ not: "formData" }),
    });
    const response = await uploadPOST(request);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(typeof body.error).toBe("string");
    expect(body.error.length).toBeGreaterThan(0);
  });

  it("returns 400 when the file exceeds the 10MB cap", async () => {
    // The route enforces `file.size > 10 * 1024 * 1024` at route.ts
    // line 78-83. A 10MB+1 payload must bounce with 4xx (documented
    // as 400 today) — never a 500 from running a giant HTML through
    // cheerio.
    mockSession("user-1");
    const OVERSIZED = "x".repeat(10 * 1024 * 1024 + 1);
    const formData = new FormData();
    formData.append(
      "file",
      new File([OVERSIZED], "big.html", { type: "text/html" }),
    );
    const request = new Request("http://localhost/api/upload", {
      method: "POST",
      body: formData,
    });
    const response = await uploadPOST(request);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toMatch(/too large|10MB/i);
  });
});

describe("POST /api/upload — v2.7.0 harness fixture happy path", () => {
  it("parses the fixture end-to-end and returns reportType=insight-harness", async () => {
    mockSession("user-1");
    const response = await uploadPOST(uploadRequest(FIXTURE_HTML));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.reportType).toBe("insight-harness");
  });

  it("prefers harness-level stats over embedded /insights values (override behavior)", async () => {
    // The route MUST prefer harnessData.stats over the parse of the
    // embedded /insights tab for sessionCount + commitCount, and MUST
    // prefer harnessData.enhancedStats over the .stat-row scrape for
    // lines/files/days/msgs-per-day. The fixture deliberately carries
    // DIFFERENT values in each source so a regression that drops the
    // override would surface here:
    //   sessionCount → harness 95 vs insights subtitle "(88 total)"
    //   commitCount  → harness 47 vs insights narrative "41 commits"
    //   linesAdded   → harness 12500 vs insights stats row "+9,000/-2,000"
    //   linesRemoved → harness 3100  vs insights stats row "-2,000"
    //   fileCount    → harness 142   vs insights stats row "110"
    //   dayCount     → harness 30    vs insights stats row "28"
    //   msgsPerDay   → harness 40.0  vs insights stats row "35.0"
    mockSession("user-1");
    const response = await uploadPOST(uploadRequest(FIXTURE_HTML));
    const body = await response.json();

    expect(body.stats.sessionCount).toBe(95);
    expect(body.stats.commitCount).toBe(47);
    expect(body.stats.linesAdded).toBe(12500);
    expect(body.stats.linesRemoved).toBe(3100);
    expect(body.stats.fileCount).toBe(142);
    expect(body.stats.dayCount).toBe(30);
    expect(body.stats.msgsPerDay).toBe(40.0);
  });

  it("preserves the date range parsed from the embedded /insights subtitle", async () => {
    mockSession("user-1");
    const response = await uploadPOST(uploadRequest(FIXTURE_HTML));
    const body = await response.json();
    expect(body.stats.dateRangeStart).toBe("2026-03-15");
    expect(body.stats.dateRangeEnd).toBe("2026-04-14");
    expect(body.stats.messageCount).toBe(1200);
  });

  it("returns the full harnessData blob with v2.7.0 fields populated", async () => {
    mockSession("user-1");
    const response = await uploadPOST(uploadRequest(FIXTURE_HTML));
    const body = await response.json();

    expect(body.harnessData).toBeDefined();

    // Top-level scalar tokens — exercise the headline numbers a
    // regression would most likely break first.
    expect(body.harnessData.stats.totalTokens).toBe(4500000000);
    expect(body.harnessData.stats.lifetimeTokens).toBe(9800000000);
    expect(body.harnessData.stats.durationHours).toBe(220.5);
    expect(body.harnessData.skillVersion).toBe("2.7.0");

    // Skill inventory — list shape with source labels (custom vs plugin).
    expect(body.harnessData.skillInventory).toHaveLength(4);
    expect(body.harnessData.skillInventory[0]).toMatchObject({
      name: "commit",
      source: "custom",
    });

    // Hook definitions — list shape with event + matcher + script.
    expect(body.harnessData.hookDefinitions).toHaveLength(3);
    expect(body.harnessData.hookDefinitions[0]).toMatchObject({
      event: "PreToolUse",
      matcher: "Bash",
    });

    // Plugins, featurePills, fileOpStyle, gitPatterns — sanity-check
    // each major v2.7.0 surface so a parser drift on any one shows up.
    expect(body.harnessData.plugins).toHaveLength(2);
    expect(body.harnessData.featurePills.length).toBeGreaterThan(0);
    expect(body.harnessData.fileOpStyle.style).toBe("Surgical Editor");
    expect(body.harnessData.gitPatterns.prCount).toBe(134);
    expect(body.harnessData.writeupSections).toHaveLength(2);
  });

  it("returns non-empty chartData and detectedSkills derived from the insights view", async () => {
    // The fixture's #tab-insights has a "Top tools used" .chart-card
    // with bar rows for Bash/Read/Edit/Agent, and detectSkills keys on
    // the Agent toolPattern → 'subagents'. Asserting non-empty results
    // catches a regression where the route drops these calls and falls
    // back to {} / [] silently.
    mockSession("user-1");
    const response = await uploadPOST(uploadRequest(FIXTURE_HTML));
    const body = await response.json();

    expect(Array.isArray(body.chartData.toolUsage)).toBe(true);
    expect(body.chartData.toolUsage.length).toBeGreaterThan(0);
    expect(body.chartData.toolUsage[0]).toMatchObject({
      label: "Bash",
      value: 5200,
    });

    expect(Array.isArray(body.detectedSkills)).toBe(true);
    expect(body.detectedSkills.length).toBeGreaterThan(0);
    expect(body.detectedSkills).toContain("subagents");
  });
});
