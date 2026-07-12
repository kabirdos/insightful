/**
 * Report + group pages must carry the `noai, noimageai` robots opt-out so
 * published harness profiles aren't hoovered into AI training corpora,
 * WITHOUT emitting `noindex`/`nofollow` (search indexing must stay intact).
 *
 * Prisma is mocked at the module level so `generateMetadata` runs without a
 * DB. We assert the emitted directive on both the found and not-found paths.
 */
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    insightReport: {
      findFirst: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/db";
import { generateMetadata } from "@/app/insights/[username]/[slug]/layout";
import { metadata as groupMetadata } from "@/app/g/[slug]/layout";

const findFirst = prisma.insightReport.findFirst as unknown as Mock;

const params = Promise.resolve({ username: "octocat", slug: "my-harness" });

// A robots directive string carries the AI opt-out but never `noindex`
// or `nofollow`, so standard crawlers keep indexing the page.
function assertAiOptOut(robots: unknown) {
  expect(typeof robots).toBe("string");
  const value = robots as string;
  expect(value).toContain("noai");
  expect(value).toContain("noimageai");
  expect(value).not.toContain("noindex");
  expect(value).not.toContain("nofollow");
}

describe("report page robots opt-out", () => {
  beforeEach(() => {
    findFirst.mockReset();
  });

  it("emits noai/noimageai for a published report and keeps OG metadata", async () => {
    findFirst.mockResolvedValue({
      totalTokens: 1_000_000,
      sessionCount: 12,
      commitCount: 30,
      reportType: "insight-harness",
      author: { displayName: "Octo Cat", username: "octocat" },
    });

    const meta = await generateMetadata({ params });

    assertAiOptOut((meta.other as Record<string, unknown>)?.robots);
    // The AI opt-out must not clobber the shareable-preview metadata.
    expect(meta.title).toContain("Octo Cat");
    expect(meta.openGraph).toBeTruthy();
  });

  it("still emits the opt-out on the not-found / draft path", async () => {
    findFirst.mockResolvedValue(null);

    const meta = await generateMetadata({ params });

    assertAiOptOut((meta.other as Record<string, unknown>)?.robots);
  });
});

describe("group page robots opt-out", () => {
  it("emits noai/noimageai via the static group layout metadata", () => {
    assertAiOptOut((groupMetadata.other as Record<string, unknown>)?.robots);
  });
});
