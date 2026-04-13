/**
 * Tests for the report-junction routes:
 *   POST  /api/insights/[slug]/projects               (attach projects)
 *   PATCH /api/insights/[slug]/projects/[projectId]   (toggle hidden)
 */
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    insightReport: {
      findFirst: vi.fn(),
    },
    project: {
      findMany: vi.fn(),
    },
    reportProject: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      createMany: vi.fn(),
      update: vi.fn(),
      aggregate: vi.fn(),
    },
  },
}));

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { POST as attachProjects } from "../route";
import { PATCH as toggleHidden } from "../[projectId]/route";

const mockAuth = auth as unknown as Mock;
const mockPrisma = prisma as unknown as {
  insightReport: { findFirst: Mock };
  project: { findMany: Mock };
  reportProject: {
    findUnique: Mock;
    findMany: Mock;
    createMany: Mock;
    update: Mock;
    aggregate: Mock;
  };
};

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

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/x", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ── POST /api/insights/[slug]/projects ──────────────────────────────

describe("POST /api/insights/[slug]/projects (attach)", () => {
  it("returns 401 when no session", async () => {
    mockSession(null);
    const response = await attachProjects(jsonRequest({ projectIds: ["p1"] }), {
      params: paramsPromise({ username: "u1", slug: "s1" }),
    });
    expect(response.status).toBe(401);
  });

  it("returns 404 when the report does not exist", async () => {
    mockSession("user-1");
    mockPrisma.insightReport.findFirst.mockResolvedValue(null);

    const response = await attachProjects(jsonRequest({ projectIds: ["p1"] }), {
      params: paramsPromise({ username: "u1", slug: "missing" }),
    });
    expect(response.status).toBe(404);
  });

  it("returns 403 when the report belongs to another user", async () => {
    mockSession("user-1");
    mockPrisma.insightReport.findFirst.mockResolvedValue({
      id: "r1",
      authorId: "user-2",
    });

    const response = await attachProjects(jsonRequest({ projectIds: ["p1"] }), {
      params: paramsPromise({ username: "u1", slug: "s1" }),
    });
    expect(response.status).toBe(403);
  });

  it("returns 400 when projectIds is not an array", async () => {
    mockSession("user-1");
    mockPrisma.insightReport.findFirst.mockResolvedValue({
      id: "r1",
      authorId: "user-1",
    });

    const response = await attachProjects(jsonRequest({ projectIds: "nope" }), {
      params: paramsPromise({ username: "u1", slug: "s1" }),
    });
    expect(response.status).toBe(400);
  });

  it("returns 200 with empty data when projectIds is []", async () => {
    mockSession("user-1");
    mockPrisma.insightReport.findFirst.mockResolvedValue({
      id: "r1",
      authorId: "user-1",
    });

    const response = await attachProjects(jsonRequest({ projectIds: [] }), {
      params: paramsPromise({ username: "u1", slug: "s1" }),
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data).toEqual([]);
  });

  it("returns 400 when any projectId is not owned by the current user", async () => {
    mockSession("user-1");
    mockPrisma.insightReport.findFirst.mockResolvedValue({
      id: "r1",
      authorId: "user-1",
    });
    // Only p1 is owned; p2 is not.
    mockPrisma.project.findMany.mockResolvedValue([{ id: "p1" }]);

    const response = await attachProjects(
      jsonRequest({ projectIds: ["p1", "p2"] }),
      {
        params: paramsPromise({ username: "u1", slug: "s1" }),
      },
    );
    expect(response.status).toBe(400);
    expect(mockPrisma.reportProject.createMany).not.toHaveBeenCalled();
  });

  it("creates junction rows with positions starting after existing max", async () => {
    mockSession("user-1");
    mockPrisma.insightReport.findFirst.mockResolvedValue({
      id: "r1",
      authorId: "user-1",
    });
    mockPrisma.project.findMany.mockResolvedValue([{ id: "p1" }, { id: "p2" }]);
    // Existing max position is 4 → new ones start at 5
    mockPrisma.reportProject.aggregate.mockResolvedValue({
      _max: { position: 4 },
    });
    mockPrisma.reportProject.createMany.mockResolvedValue({ count: 2 });
    mockPrisma.reportProject.findMany.mockResolvedValue([
      { id: "rp5", position: 5, projectId: "p1", project: {} },
      { id: "rp6", position: 6, projectId: "p2", project: {} },
    ]);

    const response = await attachProjects(
      jsonRequest({ projectIds: ["p1", "p2"] }),
      {
        params: paramsPromise({ username: "u1", slug: "s1" }),
      },
    );

    expect(response.status).toBe(201);
    const createManyArgs = mockPrisma.reportProject.createMany.mock.calls[0][0];
    expect(createManyArgs.data).toEqual([
      { reportId: "r1", projectId: "p1", position: 5 },
      { reportId: "r1", projectId: "p2", position: 6 },
    ]);
    expect(createManyArgs.skipDuplicates).toBe(true);
  });

  it("starts position at 0 when there are no existing attachments", async () => {
    mockSession("user-1");
    mockPrisma.insightReport.findFirst.mockResolvedValue({
      id: "r1",
      authorId: "user-1",
    });
    mockPrisma.project.findMany.mockResolvedValue([{ id: "p1" }]);
    mockPrisma.reportProject.aggregate.mockResolvedValue({
      _max: { position: null },
    });
    mockPrisma.reportProject.createMany.mockResolvedValue({ count: 1 });
    mockPrisma.reportProject.findMany.mockResolvedValue([
      { id: "rp0", position: 0, projectId: "p1", project: {} },
    ]);

    await attachProjects(jsonRequest({ projectIds: ["p1"] }), {
      params: paramsPromise({ username: "u1", slug: "s1" }),
    });

    const createManyArgs = mockPrisma.reportProject.createMany.mock.calls[0][0];
    expect(createManyArgs.data[0].position).toBe(0);
  });
});

// ── PATCH /api/insights/[slug]/projects/[projectId] ─────────────────

describe("PATCH /api/insights/[slug]/projects/[projectId] (hide toggle)", () => {
  it("returns 401 when no session", async () => {
    mockSession(null);
    const response = await toggleHidden(jsonRequest({ hidden: true }), {
      params: paramsPromise({ username: "u1", slug: "s1", projectId: "p1" }),
    });
    expect(response.status).toBe(401);
  });

  it("returns 404 when the report does not exist", async () => {
    mockSession("user-1");
    mockPrisma.insightReport.findFirst.mockResolvedValue(null);

    const response = await toggleHidden(jsonRequest({ hidden: true }), {
      params: paramsPromise({ username: "u1", slug: "missing", projectId: "p1" }),
    });
    expect(response.status).toBe(404);
  });

  it("returns 403 when the report belongs to another user", async () => {
    mockSession("user-1");
    mockPrisma.insightReport.findFirst.mockResolvedValue({
      id: "r1",
      authorId: "user-2",
    });

    const response = await toggleHidden(jsonRequest({ hidden: true }), {
      params: paramsPromise({ username: "u1", slug: "s1", projectId: "p1" }),
    });
    expect(response.status).toBe(403);
  });

  it("returns 404 when the junction row does not exist", async () => {
    mockSession("user-1");
    mockPrisma.insightReport.findFirst.mockResolvedValue({
      id: "r1",
      authorId: "user-1",
    });
    mockPrisma.reportProject.findUnique.mockResolvedValue(null);

    const response = await toggleHidden(jsonRequest({ hidden: true }), {
      params: paramsPromise({ username: "u1", slug: "s1", projectId: "p1" }),
    });
    expect(response.status).toBe(404);
  });

  it("returns 400 when hidden is not a boolean", async () => {
    mockSession("user-1");
    mockPrisma.insightReport.findFirst.mockResolvedValue({
      id: "r1",
      authorId: "user-1",
    });
    mockPrisma.reportProject.findUnique.mockResolvedValue({
      id: "rp1",
      reportId: "r1",
      projectId: "p1",
      hidden: false,
    });

    const response = await toggleHidden(jsonRequest({ hidden: "yes" }), {
      params: paramsPromise({ username: "u1", slug: "s1", projectId: "p1" }),
    });
    expect(response.status).toBe(400);
  });

  it("toggles hidden to true", async () => {
    mockSession("user-1");
    mockPrisma.insightReport.findFirst.mockResolvedValue({
      id: "r1",
      authorId: "user-1",
    });
    mockPrisma.reportProject.findUnique.mockResolvedValue({
      id: "rp1",
      reportId: "r1",
      projectId: "p1",
      hidden: false,
    });
    mockPrisma.reportProject.update.mockResolvedValue({
      id: "rp1",
      hidden: true,
      project: {},
    });

    const response = await toggleHidden(jsonRequest({ hidden: true }), {
      params: paramsPromise({ username: "u1", slug: "s1", projectId: "p1" }),
    });

    expect(response.status).toBe(200);
    expect(mockPrisma.reportProject.update).toHaveBeenCalledWith({
      where: {
        reportId_projectId: { reportId: "r1", projectId: "p1" },
      },
      data: { hidden: true },
      include: { project: true },
    });
  });

  it("toggles hidden to false (unhide)", async () => {
    mockSession("user-1");
    mockPrisma.insightReport.findFirst.mockResolvedValue({
      id: "r1",
      authorId: "user-1",
    });
    mockPrisma.reportProject.findUnique.mockResolvedValue({
      id: "rp1",
      reportId: "r1",
      projectId: "p1",
      hidden: true,
    });
    mockPrisma.reportProject.update.mockResolvedValue({
      id: "rp1",
      hidden: false,
      project: {},
    });

    const response = await toggleHidden(jsonRequest({ hidden: false }), {
      params: paramsPromise({ username: "u1", slug: "s1", projectId: "p1" }),
    });

    expect(response.status).toBe(200);
    expect(mockPrisma.reportProject.update.mock.calls[0][0].data.hidden).toBe(
      false,
    );
  });
});
