/**
 * Smoke test for the groups index page (/groups).
 *
 * No jsdom; we render the exported empty-state component directly
 * (the full page gates it behind session + fetch state).
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-auth/react", () => ({
  useSession: () => ({ data: null, status: "unauthenticated" }),
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

import { GroupsEmptyState } from "../page";

describe("Groups index — empty state", () => {
  it("prompts the user to create a group and invite people", () => {
    const html = renderToStaticMarkup(<GroupsEmptyState />);
    expect(html).toContain("Create a group and invite people");
    expect(html).toContain("share your reports privately");
  });
});
