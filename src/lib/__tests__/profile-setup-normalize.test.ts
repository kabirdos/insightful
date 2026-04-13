import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { normalizeSetup } from "../profile-setup-normalize";
import { PROFILE_SETUP_VERSION } from "@/types/profile";

const FIXED_NOW = "2026-04-13T12:00:00.000Z";
const OLDER_NOW = "2026-01-01T00:00:00.000Z";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(FIXED_NOW));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("normalizeSetup", () => {
  it("returns null for non-object input", () => {
    expect(normalizeSetup(null)).toBeNull();
    expect(normalizeSetup(undefined)).toBeNull();
    expect(normalizeSetup("hello")).toBeNull();
    expect(normalizeSetup(42)).toBeNull();
    expect(normalizeSetup([])).toBeNull();
  });

  it("returns null when every user field is empty", () => {
    expect(normalizeSetup({})).toBeNull();
    expect(normalizeSetup({ os: "   " })).toBeNull();
    expect(normalizeSetup({ mcpServers: [] })).toBeNull();
    expect(normalizeSetup({ editor: "" })).toBeNull();
  });

  it("strips unknown keys", () => {
    const out = normalizeSetup({ editor: "Zed", malicious: "x", __proto__: 1 });
    expect(out?.editor).toBe("Zed");
    // @ts-expect-error — asserting absence of unknown key
    expect(out?.malicious).toBeUndefined();
  });

  it("trims strings and coerces empty to undefined", () => {
    const out = normalizeSetup({
      editor: "  Zed  ",
      terminal: "",
      shell: "   ",
      keyboard: "HHKB",
    });
    expect(out?.editor).toBe("Zed");
    expect(out?.terminal).toBeUndefined();
    expect(out?.shell).toBeUndefined();
    expect(out?.keyboard).toBe("HHKB");
  });

  it("truncates free-text fields at 120 chars", () => {
    const long = "x".repeat(200);
    const out = normalizeSetup({ machine: long });
    expect(out?.machine?.length).toBe(120);
  });

  it("validates dotfilesUrl and drops invalid values", () => {
    expect(
      normalizeSetup({ dotfilesUrl: "https://github.com/me/dotfiles" })
        ?.dotfilesUrl,
    ).toBe("https://github.com/me/dotfiles");
    expect(normalizeSetup({ dotfilesUrl: "not a url" })).toBeNull();
    expect(normalizeSetup({ dotfilesUrl: "javascript:alert(1)" })).toBeNull();
    expect(normalizeSetup({ dotfilesUrl: "ftp://example.com" })).toBeNull();
  });

  it("caps mcpServers at 20 items and each string at 80 chars", () => {
    const long = "y".repeat(100);
    const many = Array.from({ length: 50 }, (_, i) => `srv-${i}`);
    const out = normalizeSetup({ mcpServers: [...many, long] });
    expect(out?.mcpServers?.length).toBe(20);
    const allWithinLimit = out?.mcpServers?.every((s) => s.length <= 80);
    expect(allWithinLimit).toBe(true);
  });

  it("drops non-string and empty entries from mcpServers", () => {
    const out = normalizeSetup({
      mcpServers: ["a", "", "  ", 42, null, "b"],
    });
    expect(out?.mcpServers).toEqual(["a", "b"]);
  });

  it("returns null if mcpServers is the only field and is empty after cleaning", () => {
    expect(normalizeSetup({ mcpServers: ["", null, "  "] })).toBeNull();
  });

  it("always overwrites version + setupUpdatedAt (server-owned)", () => {
    const out = normalizeSetup({
      editor: "Zed",
      version: 999, // client attempt
      setupUpdatedAt: "1999-01-01T00:00:00.000Z", // client attempt
    });
    expect(out?.version).toBe(PROFILE_SETUP_VERSION);
    expect(out?.setupUpdatedAt).toBe(FIXED_NOW);
  });

  it("preserves prevStored.setupUpdatedAt when user fields are unchanged", () => {
    const prev = {
      version: PROFILE_SETUP_VERSION,
      setupUpdatedAt: OLDER_NOW,
      editor: "Zed",
      shell: "zsh",
    };
    const out = normalizeSetup({ editor: "Zed", shell: "zsh" }, prev);
    expect(out?.setupUpdatedAt).toBe(OLDER_NOW);
  });

  it("refreshes setupUpdatedAt when a user field changes", () => {
    const prev = {
      version: PROFILE_SETUP_VERSION,
      setupUpdatedAt: OLDER_NOW,
      editor: "Zed",
    };
    const out = normalizeSetup({ editor: "Cursor" }, prev);
    expect(out?.setupUpdatedAt).toBe(FIXED_NOW);
  });

  it("refreshes setupUpdatedAt when mcpServers order changes", () => {
    const prev = {
      version: PROFILE_SETUP_VERSION,
      setupUpdatedAt: OLDER_NOW,
      mcpServers: ["a", "b"],
    };
    const out = normalizeSetup({ mcpServers: ["b", "a"] }, prev);
    expect(out?.setupUpdatedAt).toBe(FIXED_NOW);
  });

  it("mints a new setupUpdatedAt when prevStored is absent", () => {
    const out = normalizeSetup({ editor: "Zed" });
    expect(out?.setupUpdatedAt).toBe(FIXED_NOW);
  });

  it("mints a new setupUpdatedAt when prevStored is malformed", () => {
    const out = normalizeSetup({ editor: "Zed" }, "garbage");
    expect(out?.setupUpdatedAt).toBe(FIXED_NOW);
  });

  it("round-trips a stored blob without churning the timestamp (read-path pattern)", () => {
    // Simulates the `normalizeSetup(stored, stored)` call on read paths.
    const stored = {
      version: PROFILE_SETUP_VERSION,
      setupUpdatedAt: OLDER_NOW,
      editor: "Zed",
      shell: "zsh",
      mcpServers: ["serena"],
    };
    const first = normalizeSetup(stored, stored);
    expect(first?.setupUpdatedAt).toBe(OLDER_NOW);
    // Re-normalize the result against itself — still stable.
    const second = normalizeSetup(first, first);
    expect(second?.setupUpdatedAt).toBe(OLDER_NOW);
  });

  it("normalizes even when prev is well-formed but raw is malformed (returns null)", () => {
    const prev = {
      version: PROFILE_SETUP_VERSION,
      setupUpdatedAt: OLDER_NOW,
      editor: "Zed",
    };
    expect(normalizeSetup(null, prev)).toBeNull();
    expect(normalizeSetup({}, prev)).toBeNull();
  });
});
