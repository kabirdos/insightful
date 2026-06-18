import { describe, it, expect } from "vitest";
import { buildLearnPrompt, toAbsoluteUrl } from "@/components/LearnFromThis";

// The component mounts React + clipboard, which this repo can't render in unit
// tests (no jsdom). The copy that actually matters — the agent prompt — is a
// pure function, so we assert its contract directly: it must carry the skill's
// learn-mode trigger phrase and the exact URL so a paste into Claude Code /
// Codex reliably switches into learn mode.

describe("buildLearnPrompt", () => {
  const url = "https://insightharness.com/insights/kabirdos/2026-04-15-abc123";

  it("embeds the URL verbatim so learn.py can resolve it", () => {
    expect(buildLearnPrompt(url, "profile")).toContain(url);
    expect(buildLearnPrompt(url, "group")).toContain(url);
  });

  it("leads with the documented learn-mode trigger phrase", () => {
    // SKILL.md triggers learn mode on "learn from this harness".
    expect(buildLearnPrompt(url, "profile").toLowerCase()).toContain(
      "learn from this",
    );
    expect(buildLearnPrompt(url, "group").toLowerCase()).toContain(
      "learn from this",
    );
  });

  it("distinguishes a single profile from a group of profiles", () => {
    expect(buildLearnPrompt(url, "profile")).toContain("harness");
    expect(buildLearnPrompt(url, "group")).toContain("group of harnesses");
  });

  it("asks the agent for actionable copy advice", () => {
    expect(buildLearnPrompt(url, "profile").toLowerCase()).toContain(
      "what to copy",
    );
  });
});

describe("toAbsoluteUrl", () => {
  const origin = "https://insightharness.com";

  it("prefixes the origin onto a relative report path", () => {
    expect(toAbsoluteUrl("/insights/kabirdos/abc123", origin)).toBe(
      "https://insightharness.com/insights/kabirdos/abc123",
    );
  });

  it("leaves an already-absolute URL untouched", () => {
    const abs = "https://insightharness.com/g/hyperzen";
    expect(toAbsoluteUrl(abs, origin)).toBe(abs);
  });

  it("returns the input unchanged when no origin is available (SSR)", () => {
    expect(toAbsoluteUrl("/insights/kabirdos/abc123", undefined)).toBe(
      "/insights/kabirdos/abc123",
    );
  });
});
