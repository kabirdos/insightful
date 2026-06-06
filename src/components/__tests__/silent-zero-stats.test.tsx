import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import InsightCard from "@/components/InsightCard";
import ContributorRow from "@/components/ContributorRow";
import SnapshotCard from "@/components/SnapshotCard";

// Regression guard for issue #29 (consumer side): listing/leaderboard cards
// must omit a metric whose value is a sourceless 0 (e.g. commitCount/linesAdded
// on a machine without the legacy session-meta dir), never render "0 commits" /
// "+0" / "0/wk". A confident zero reads as a false claim and undercuts the
// product's "verified, honest data" promise. The standalone-HTML half is pinned
// by insight-harness/test_no_silent_zeros.py; this pins the React half.

describe("InsightCard — no silent zeros", () => {
  // A real report with sessions but a sourceless 0 for commits/lines/msgs.
  const sourceless = {
    slug: "s",
    title: "Untitled Report",
    authorUsername: "ada",
    publishedAt: "2026-06-01",
    voteCount: 0,
    commentCount: 0,
    sessionCount: 12,
    messageCount: 0,
    commitCount: 0,
    linesAdded: 0,
    linesRemoved: 0,
    fileCount: 0,
    dayCount: 30,
    msgsPerDay: 0,
  };

  it("omits zero-valued metrics instead of rendering '0 commits' / '+0'", () => {
    const html = renderToStaticMarkup(<InsightCard {...sourceless} />);
    expect(html).not.toContain("commits");
    expect(html).not.toContain("msgs");
    expect(html).not.toContain("files");
    expect(html).not.toContain("+0");
    expect(html).not.toContain("/day");
  });

  it("renders metrics that are genuinely positive", () => {
    const html = renderToStaticMarkup(
      <InsightCard
        {...sourceless}
        messageCount={4200}
        commitCount={37}
        linesAdded={1500}
        linesRemoved={200}
        fileCount={18}
        msgsPerDay={140}
      />,
    );
    expect(html).toContain("37 commits");
    expect(html).toContain("4,200 msgs");
    expect(html).toContain("18 files");
    expect(html).toContain("+1,500");
  });
});

describe("ContributorRow — no silent zeros", () => {
  const base = {
    slug: "s",
    username: "ada",
    displayName: "Ada",
    avatarUrl: null,
    publishedAt: "2026-06-01",
    dateRangeStart: "2026-05-01",
    dateRangeEnd: "2026-05-31",
    dayCount: 7, // 1 week → per-week == raw value, keeps assertions simple
    messageCount: 0,
    linesAdded: 0,
    linesRemoved: 0,
    fileCount: 0,
    commitCount: 0,
    detectedSkills: [],
  };

  it("omits per-week stats whose value is 0 (no '+0' / '0 commits')", () => {
    const html = renderToStaticMarkup(<ContributorRow {...base} />);
    expect(html).not.toContain("commits");
    expect(html).not.toContain("msgs");
    expect(html).not.toContain("+0");
  });

  it("renders per-week stats that are positive", () => {
    const html = renderToStaticMarkup(
      <ContributorRow {...base} commitCount={14} messageCount={70} />,
    );
    expect(html).toContain("commits");
    expect(html).toContain("msgs");
  });
});

describe("SnapshotCard — no silent zeros", () => {
  const base = {
    sessionCount: 10,
    messageCount: 0,
    linesAdded: 0,
    linesRemoved: 0,
    fileCount: 0,
    dayCount: 7,
    commitCount: 0,
    chartData: null,
    detectedSkills: [],
    keyPattern: null,
    projectAreas: null,
  };

  it("omits weekly-average stats whose value is 0", () => {
    const html = renderToStaticMarkup(<SnapshotCard {...base} />);
    expect(html).not.toContain("Commits");
    expect(html).not.toContain("Added");
    expect(html).not.toContain("Files");
  });

  it("renders weekly-average stats that are positive", () => {
    const html = renderToStaticMarkup(
      <SnapshotCard {...base} commitCount={21} linesAdded={3500} />,
    );
    expect(html).toContain("Commits");
    expect(html).toContain("Added");
  });
});
