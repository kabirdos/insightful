/**
 * Smoke tests for the group page (/g/[slug]).
 *
 * The repo ships neither @testing-library/react nor jsdom, so these are
 * react-dom/server renders of the exported presentational pieces
 * (mirrors the /upload page test pattern). We cover:
 *   - the invite-only card shown to non-members / anonymous (404 shape)
 *   - the member comparison card renders vanity stats and OMITS
 *     sourceless ones (the no-silent-zero rule, #155-#157)
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// next-auth/react is client-only; stub it so SSR import resolution and
// the signIn handler reference don't explode.
vi.mock("next-auth/react", () => ({
  useSession: () => ({ data: null, status: "unauthenticated" }),
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ slug: "hyperzen" }),
  useRouter: () => ({ push: vi.fn() }),
}));

import { InviteOnlyCard, MemberCard, type GroupMember } from "../page";

describe("InviteOnlyCard", () => {
  it("renders the invite-only message with the slug and a sign-in CTA when signed out", () => {
    const html = renderToStaticMarkup(
      <InviteOnlyCard slug="hyperzen" signedIn={false} />,
    );
    expect(html).toContain("hyperzen");
    expect(html).toContain("This group is invite-only");
    expect(html).toContain("Ask a member for an invite link");
    expect(html).toContain("Sign in with GitHub");
  });

  it("hides the sign-in CTA when already signed in", () => {
    const html = renderToStaticMarkup(
      <InviteOnlyCard slug="hyperzen" signedIn={true} />,
    );
    expect(html).toContain("This group is invite-only");
    expect(html).not.toContain("Sign in with GitHub");
  });
});

describe("MemberCard — no-silent-zero", () => {
  const baseReport = {
    slug: "my-report",
    title: "My Report",
    reportType: "insight-harness",
    autonomyLabel: "Guided",
    detectedSkills: ["custom_skills", "hooks"],
    // A clean 7-day range so perWeek == the raw value.
    dateRangeStart: "2026-06-01",
    dateRangeEnd: "2026-06-07",
    publishedAt: "2026-06-07",
    avgSessionMinutes: 30,
  };

  it("renders vanity stats that have a source", () => {
    const member: GroupMember = {
      username: "alice",
      displayName: "Alice",
      avatarUrl: null,
      role: "owner",
      joinedAt: "2026-06-01",
      latestReport: {
        ...baseReport,
        totalTokens: 5_000_000,
        sessionCount: 21, // 3 weeks of data in a 7-day window → 21/wk
        durationHours: 14,
        commitCount: 35,
        prCount: 4,
      },
    };
    const html = renderToStaticMarkup(<MemberCard member={member} />);
    expect(html).toContain("Alice");
    expect(html).toContain("lifetime tokens");
    expect(html).toContain("5.0M");
    expect(html).toContain("sessions / wk");
    expect(html).toContain("commits / wk");
    expect(html).toContain("PRs");
    // Autonomy + skills surface.
    expect(html).toContain("Guided");
    expect(html).toContain("custom skills");
  });

  it("omits sourceless stats instead of rendering 0 / —", () => {
    const member: GroupMember = {
      username: "bob",
      displayName: "Bob",
      avatarUrl: null,
      role: "member",
      joinedAt: "2026-06-01",
      latestReport: {
        ...baseReport,
        totalTokens: 1_000_000,
        sessionCount: 7,
        // No commits, PRs, or duration → those cells must not render.
        durationHours: null,
        commitCount: null,
        prCount: null,
        autonomyLabel: null,
        detectedSkills: [],
      },
    };
    const html = renderToStaticMarkup(<MemberCard member={member} />);
    expect(html).toContain("sessions / wk");
    expect(html).not.toContain("commits / wk");
    expect(html).not.toContain("active / wk");
    expect(html).not.toContain("PRs");
  });

  it("renders a muted placeholder for a member with no visible report", () => {
    const member: GroupMember = {
      username: "carol",
      displayName: "Carol",
      avatarUrl: null,
      role: "member",
      joinedAt: "2026-06-01",
      latestReport: null,
    };
    const html = renderToStaticMarkup(<MemberCard member={member} />);
    expect(html).toContain("Carol");
    expect(html).toContain("No shared report yet");
  });
});
