/**
 * Smoke test for the group join page (/g/join/[token]).
 *
 * No jsdom in the repo, so we render the exported invalid-state view
 * directly (the full page gates the invalid view behind a fetch effect
 * that doesn't run under renderToStaticMarkup).
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-auth/react", () => ({
  useSession: () => ({ data: null, status: "unauthenticated" }),
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ token: "deadbeef" }),
  useRouter: () => ({ push: vi.fn() }),
}));

import { InviteUnavailable } from "../page";

describe("Join page — invalid invite", () => {
  it("renders the 'no longer valid' message", () => {
    const html = renderToStaticMarkup(<InviteUnavailable />);
    expect(html).toContain("This invite is no longer valid");
  });
});
