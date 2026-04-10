/**
 * Tests for /api/projects (list + create) and /api/projects/[id]
 * (patch + delete) and /api/projects/[id]/refresh-metadata.
 *
 * Establishes the repo's first route-handler test pattern: mock
 * @/lib/db, @/lib/auth, and @/lib/link-preview at the module level
 * via vi.mock, then invoke the exported route handlers directly.
 */
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

// ── Mock the Prisma client ──────────────────────────────────────────

vi.mock("@/lib/db", () => ({
  prisma: {
    project: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

// ── Mock next-auth ──────────────────────────────────────────────────

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

// ── Mock link-preview ───────────────────────────────────────────────

vi.mock("@/lib/link-preview", () => ({
  fetchLinkPreview: vi.fn(),
}));

// ── Imports after mocks ─────────────────────────────────────────────

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { fetchLinkPreview } from "@/lib/link-preview";
import { GET as listProjects, POST as createProject } from "../route";
import { PATCH as patchProject, DELETE as deleteProject } from "../[id]/route";
import { POST as refreshMetadata } from "../[id]/refresh-metadata/route";

const mockAuth = auth as unknown as Mock;
const mockFetchLinkPreview = fetchLinkPreview as unknown as Mock;
const mockPrisma = prisma as unknown as {
  project: {
    findMany: Mock;
    findUnique: Mock;
    create: Mock;
    update: Mock;
    updateMany: Mock;
    delete: Mock;
  };
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

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/projects", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ── GET /api/projects ───────────────────────────────────────────────

describe("GET /api/projects", () => {
  it("returns 401 when no session", async () => {
    mockSession(null);
    const response = await listProjects();
    expect(response.status).toBe(401);
  });

  it("returns the current user's projects, newest-first", async () => {
    mockSession("user-1");
    mockPrisma.project.findMany.mockResolvedValue([
      { id: "p1", name: "Alpha" },
      { id: "p2", name: "Beta" },
    ]);

    const response = await listProjects();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toHaveLength(2);
    expect(mockPrisma.project.findMany).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      orderBy: { updatedAt: "desc" },
    });
  });
});

// ── POST /api/projects ──────────────────────────────────────────────

describe("POST /api/projects", () => {
  it("returns 401 when no session", async () => {
    mockSession(null);
    const response = await createProject(jsonRequest({ name: "x" }));
    expect(response.status).toBe(401);
  });

  it("returns 400 when name is missing", async () => {
    mockSession("user-1");
    const response = await createProject(jsonRequest({}));
    expect(response.status).toBe(400);
  });

  it("returns 400 when name is empty/whitespace", async () => {
    mockSession("user-1");
    const response = await createProject(jsonRequest({ name: "   " }));
    expect(response.status).toBe(400);
  });

  it("returns 400 when liveUrl is not a valid URL", async () => {
    mockSession("user-1");
    const response = await createProject(
      jsonRequest({ name: "ok", liveUrl: "not a url" }),
    );
    expect(response.status).toBe(400);
  });

  it("creates a project without metadata fetch when liveUrl is absent", async () => {
    mockSession("user-1");
    mockPrisma.project.create.mockResolvedValue({
      id: "p1",
      name: "New",
      userId: "user-1",
    });

    const response = await createProject(
      jsonRequest({ name: "New", githubUrl: "https://github.com/x/y" }),
    );

    expect(response.status).toBe(201);
    expect(mockFetchLinkPreview).not.toHaveBeenCalled();
    expect(mockPrisma.project.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "user-1",
          name: "New",
          githubUrl: "https://github.com/x/y",
          liveUrl: null,
          ogImage: null,
          ogTitle: null,
          metadataFetchedAt: null,
        }),
      }),
    );
  });

  it("fetches metadata when liveUrl is provided and persists it", async () => {
    mockSession("user-1");
    mockFetchLinkPreview.mockResolvedValue({
      ogImage: "https://cdn/x.png",
      ogTitle: "Hello",
      ogDescription: "World",
      favicon: "https://cdn/fav.ico",
      siteName: "Example",
    });
    mockPrisma.project.create.mockResolvedValue({ id: "p1" });

    const response = await createProject(
      jsonRequest({ name: "X", liveUrl: "https://example.com" }),
    );

    expect(response.status).toBe(201);
    expect(mockFetchLinkPreview).toHaveBeenCalledWith("https://example.com");
    expect(mockPrisma.project.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          ogImage: "https://cdn/x.png",
          ogTitle: "Hello",
          ogDescription: "World",
          favicon: "https://cdn/fav.ico",
          siteName: "Example",
          metadataFetchedAt: expect.any(Date),
        }),
      }),
    );
  });

  it("creates a project with null metadata when the fetch returns null", async () => {
    mockSession("user-1");
    mockFetchLinkPreview.mockResolvedValue(null);
    mockPrisma.project.create.mockResolvedValue({ id: "p1" });

    const response = await createProject(
      jsonRequest({ name: "X", liveUrl: "https://example.com" }),
    );

    expect(response.status).toBe(201);
    expect(mockPrisma.project.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          ogImage: null,
          ogTitle: null,
          metadataFetchedAt: null,
        }),
      }),
    );
  });
});

// ── PATCH /api/projects/[id] ────────────────────────────────────────

describe("PATCH /api/projects/[id]", () => {
  it("returns 401 when no session", async () => {
    mockSession(null);
    const response = await patchProject(jsonRequest({ name: "x" }), {
      params: paramsPromise({ id: "p1" }),
    });
    expect(response.status).toBe(401);
  });

  it("returns 404 when the project does not exist", async () => {
    mockSession("user-1");
    mockPrisma.project.findUnique.mockResolvedValue(null);

    const response = await patchProject(jsonRequest({ name: "x" }), {
      params: paramsPromise({ id: "p-missing" }),
    });
    expect(response.status).toBe(404);
  });

  it("returns 403 when the project belongs to another user", async () => {
    mockSession("user-1");
    mockPrisma.project.findUnique.mockResolvedValue({
      id: "p1",
      userId: "user-2",
      liveUrl: null,
    });

    const response = await patchProject(jsonRequest({ name: "x" }), {
      params: paramsPromise({ id: "p1" }),
    });
    expect(response.status).toBe(403);
  });

  it("updates the project name WITHOUT calling fetchLinkPreview when liveUrl is unchanged", async () => {
    mockSession("user-1");
    mockPrisma.project.findUnique.mockResolvedValue({
      id: "p1",
      userId: "user-1",
      liveUrl: "https://example.com",
    });
    mockPrisma.project.update.mockResolvedValue({ id: "p1" });

    const response = await patchProject(jsonRequest({ name: "Renamed" }), {
      params: paramsPromise({ id: "p1" }),
    });

    expect(response.status).toBe(200);
    expect(mockFetchLinkPreview).not.toHaveBeenCalled();
    expect(mockPrisma.project.update).toHaveBeenCalledWith({
      where: { id: "p1" },
      data: expect.objectContaining({ name: "Renamed" }),
    });
  });

  it("clears cached metadata BEFORE refetch when liveUrl changes", async () => {
    mockSession("user-1");
    mockPrisma.project.findUnique
      .mockResolvedValueOnce({
        id: "p1",
        userId: "user-1",
        liveUrl: "https://old.example.com",
      })
      .mockResolvedValue({ id: "p1" });
    mockFetchLinkPreview.mockResolvedValue({
      ogImage: "https://cdn/new.png",
      ogTitle: "New",
      ogDescription: "New",
      favicon: "https://cdn/new.ico",
      siteName: "New Site",
    });
    mockPrisma.project.update.mockResolvedValue({ id: "p1" });
    mockPrisma.project.updateMany.mockResolvedValue({ count: 1 });

    const response = await patchProject(
      jsonRequest({ liveUrl: "https://new.example.com" }),
      { params: paramsPromise({ id: "p1" }) },
    );

    expect(response.status).toBe(200);

    // First update clears metadata fields and sets the new liveUrl
    const firstUpdate = mockPrisma.project.update.mock.calls[0][0];
    expect(firstUpdate.data).toMatchObject({
      liveUrl: "https://new.example.com",
      ogImage: null,
      ogTitle: null,
      ogDescription: null,
      favicon: null,
      siteName: null,
      metadataFetchedAt: null,
    });

    // Second update (updateMany with compound where) persists the
    // new metadata only if liveUrl still matches what we fetched —
    // this is the race-safety guard for concurrent edits.
    expect(mockPrisma.project.updateMany).toHaveBeenCalledTimes(1);
    const refillCall = mockPrisma.project.updateMany.mock.calls[0][0];
    expect(refillCall.where).toMatchObject({
      id: "p1",
      liveUrl: "https://new.example.com",
    });
    expect(refillCall.data).toMatchObject({
      ogImage: "https://cdn/new.png",
      ogTitle: "New",
    });
  });

  it("race-safety: stale metadata refill is silently discarded when liveUrl changes mid-fetch", async () => {
    // Regression test for codex race-condition finding on Unit 3.
    // Simulation: during the fetch, another concurrent PATCH changes
    // liveUrl. When our updateMany runs with a compound where clause
    // { id, liveUrl: fetchedUrl }, it matches 0 rows and our stale
    // metadata is silently discarded.
    mockSession("user-1");
    mockPrisma.project.findUnique
      .mockResolvedValueOnce({
        id: "p1",
        userId: "user-1",
        liveUrl: "https://a.example.com",
      })
      .mockResolvedValue({ id: "p1" });
    mockFetchLinkPreview.mockResolvedValue({
      ogImage: "https://cdn/B.png",
      ogTitle: "B",
      ogDescription: null,
      favicon: null,
      siteName: null,
    });
    mockPrisma.project.update.mockResolvedValue({ id: "p1" });
    // Race: updateMany finds 0 matching rows because liveUrl was
    // changed by a concurrent request.
    mockPrisma.project.updateMany.mockResolvedValue({ count: 0 });

    const response = await patchProject(
      jsonRequest({ liveUrl: "https://b.example.com" }),
      { params: paramsPromise({ id: "p1" }) },
    );

    expect(response.status).toBe(200);
    expect(mockPrisma.project.updateMany).toHaveBeenCalledTimes(1);
    const refillCall = mockPrisma.project.updateMany.mock.calls[0][0];
    // The gate uses the URL we actually fetched, not the one from the
    // response time — so even if count=0 came back, we proved the
    // guard is in place.
    expect(refillCall.where.liveUrl).toBe("https://b.example.com");
  });

  it("leaves metadata cleared if the new fetch fails", async () => {
    mockSession("user-1");
    mockPrisma.project.findUnique
      .mockResolvedValueOnce({
        id: "p1",
        userId: "user-1",
        liveUrl: "https://old.example.com",
      })
      .mockResolvedValue({ id: "p1" });
    mockFetchLinkPreview.mockResolvedValue(null);
    mockPrisma.project.update.mockResolvedValue({ id: "p1" });

    await patchProject(jsonRequest({ liveUrl: "https://new.example.com" }), {
      params: paramsPromise({ id: "p1" }),
    });

    // Only one update call — the metadata-clearing one. No second
    // update because fetchLinkPreview returned null.
    expect(mockPrisma.project.update).toHaveBeenCalledTimes(1);
    const onlyUpdate = mockPrisma.project.update.mock.calls[0][0];
    expect(onlyUpdate.data.ogImage).toBeNull();
  });
});

// ── DELETE /api/projects/[id] ───────────────────────────────────────

describe("DELETE /api/projects/[id]", () => {
  it("returns 401 when no session", async () => {
    mockSession(null);
    const response = await deleteProject(new Request("http://x"), {
      params: paramsPromise({ id: "p1" }),
    });
    expect(response.status).toBe(401);
  });

  it("returns 404 when the project does not exist", async () => {
    mockSession("user-1");
    mockPrisma.project.findUnique.mockResolvedValue(null);

    const response = await deleteProject(new Request("http://x"), {
      params: paramsPromise({ id: "p-missing" }),
    });
    expect(response.status).toBe(404);
  });

  it("returns 403 for a project owned by another user", async () => {
    mockSession("user-1");
    mockPrisma.project.findUnique.mockResolvedValue({
      id: "p1",
      userId: "user-2",
    });

    const response = await deleteProject(new Request("http://x"), {
      params: paramsPromise({ id: "p1" }),
    });
    expect(response.status).toBe(403);
  });

  it("deletes a project owned by the current user", async () => {
    mockSession("user-1");
    mockPrisma.project.findUnique.mockResolvedValue({
      id: "p1",
      userId: "user-1",
    });
    mockPrisma.project.delete.mockResolvedValue({ id: "p1" });

    const response = await deleteProject(new Request("http://x"), {
      params: paramsPromise({ id: "p1" }),
    });

    expect(response.status).toBe(200);
    expect(mockPrisma.project.delete).toHaveBeenCalledWith({
      where: { id: "p1" },
    });
  });
});

// ── POST /api/projects/[id]/refresh-metadata ────────────────────────

describe("POST /api/projects/[id]/refresh-metadata", () => {
  it("returns 401 when no session", async () => {
    mockSession(null);
    const response = await refreshMetadata(new Request("http://x"), {
      params: paramsPromise({ id: "p1" }),
    });
    expect(response.status).toBe(401);
  });

  it("returns 403 for a project owned by another user", async () => {
    mockSession("user-1");
    mockPrisma.project.findUnique.mockResolvedValue({
      id: "p1",
      userId: "user-2",
      liveUrl: "https://example.com",
    });

    const response = await refreshMetadata(new Request("http://x"), {
      params: paramsPromise({ id: "p1" }),
    });
    expect(response.status).toBe(403);
  });

  it("clears metadata and re-fetches when liveUrl exists", async () => {
    mockSession("user-1");
    mockPrisma.project.findUnique
      .mockResolvedValueOnce({
        id: "p1",
        userId: "user-1",
        liveUrl: "https://example.com",
      })
      .mockResolvedValue({ id: "p1" });
    mockFetchLinkPreview.mockResolvedValue({
      ogImage: "https://cdn/x.png",
      ogTitle: "Refreshed",
      ogDescription: null,
      favicon: null,
      siteName: null,
    });
    mockPrisma.project.update.mockResolvedValue({ id: "p1" });
    mockPrisma.project.updateMany.mockResolvedValue({ count: 1 });

    const response = await refreshMetadata(new Request("http://x"), {
      params: paramsPromise({ id: "p1" }),
    });

    expect(response.status).toBe(200);
    expect(mockFetchLinkPreview).toHaveBeenCalledWith("https://example.com");
    // Clear: one project.update call with all metadata null
    expect(mockPrisma.project.update).toHaveBeenCalledTimes(1);
    expect(mockPrisma.project.update.mock.calls[0][0].data.ogImage).toBeNull();
    // Refill: one project.updateMany call with compound where gating
    // on the URL we fetched
    expect(mockPrisma.project.updateMany).toHaveBeenCalledTimes(1);
    const refill = mockPrisma.project.updateMany.mock.calls[0][0];
    expect(refill.where).toMatchObject({
      id: "p1",
      liveUrl: "https://example.com",
    });
    expect(refill.data.ogTitle).toBe("Refreshed");
  });

  it("leaves metadata cleared when the fetch fails", async () => {
    mockSession("user-1");
    mockPrisma.project.findUnique
      .mockResolvedValueOnce({
        id: "p1",
        userId: "user-1",
        liveUrl: "https://example.com",
      })
      .mockResolvedValue({ id: "p1" });
    mockFetchLinkPreview.mockResolvedValue(null);
    mockPrisma.project.update.mockResolvedValue({ id: "p1" });

    await refreshMetadata(new Request("http://x"), {
      params: paramsPromise({ id: "p1" }),
    });

    // Only the clearing update
    expect(mockPrisma.project.update).toHaveBeenCalledTimes(1);
  });

  it("skips the fetch when the project has no liveUrl", async () => {
    mockSession("user-1");
    mockPrisma.project.findUnique
      .mockResolvedValueOnce({ id: "p1", userId: "user-1", liveUrl: null })
      .mockResolvedValue({ id: "p1" });
    mockPrisma.project.update.mockResolvedValue({ id: "p1" });

    const response = await refreshMetadata(new Request("http://x"), {
      params: paramsPromise({ id: "p1" }),
    });

    expect(response.status).toBe(200);
    expect(mockFetchLinkPreview).not.toHaveBeenCalled();
  });
});
