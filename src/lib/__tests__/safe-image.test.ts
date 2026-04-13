import { describe, expect, it } from "vitest";

import type { HarnessSkillEntry } from "@/types/insights";
import { getSafeHeroDataUri, isSafeImageDataUri } from "@/lib/safe-image";

// Minimal valid base64 — 1×1 transparent PNG would normally be ~70 bytes
const TINY_B64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwADhgGAWjR9awAAAABJRU5ErkJggg==";

function makeEntry(
  overrides: Partial<HarnessSkillEntry> = {},
): HarnessSkillEntry {
  return {
    name: "test-skill",
    calls: 1,
    source: "user",
    description: "",
    ...overrides,
  };
}

describe("isSafeImageDataUri", () => {
  it("accepts valid PNG data URI", () => {
    expect(isSafeImageDataUri(`data:image/png;base64,${TINY_B64}`)).toBe(true);
  });

  it("accepts valid JPEG data URI", () => {
    expect(isSafeImageDataUri(`data:image/jpeg;base64,${TINY_B64}`)).toBe(true);
  });

  it.each([
    ["non-string input", 12345],
    ["null", null],
    ["undefined", undefined],
    ["empty string", ""],
  ])("rejects %s", (_label, input) => {
    expect(isSafeImageDataUri(input)).toBe(false);
  });

  it.each([
    ["http URL", "http://evil.com/pixel.gif"],
    ["https URL", "https://evil.com/pixel.gif"],
    ["javascript:", "javascript:alert(1)"],
    ["mixed-case JaVaScRiPt:", "JaVaScRiPt:alert(1)"],
    ["vbscript:", "vbscript:msgbox(1)"],
    ["data:text/html", "data:text/html,<script>alert(1)</script>"],
    ["data:image/svg+xml", `data:image/svg+xml;base64,${TINY_B64}`],
    ["data:image/gif", `data:image/gif;base64,${TINY_B64}`],
    ["data:image/webp", `data:image/webp;base64,${TINY_B64}`],
    ["data:image/png without base64", `data:image/png,${TINY_B64}`],
    ["data:image/PNG (mixed case mime)", `data:image/PNG;base64,${TINY_B64}`],
    [
      "data:image/png;base64 with whitespace in body",
      "data:image/png;base64,iVBOR w0KGgo=",
    ],
    ["data:image/png;base64 with !", "data:image/png;base64,iVBOR!w0KGgo="],
    ["data:image/png;base64 with empty body", "data:image/png;base64,"],
  ])("rejects %s", (_label, input) => {
    expect(isSafeImageDataUri(input)).toBe(false);
  });

  it("rejects oversized payload", () => {
    const oversized = "data:image/png;base64," + "A".repeat(600 * 1024);
    expect(isSafeImageDataUri(oversized)).toBe(false);
  });
});

describe("getSafeHeroDataUri", () => {
  it("composes a valid PNG data URI", () => {
    const entry = makeEntry({
      hero_mime_type: "image/png",
      hero_base64: TINY_B64,
    });
    expect(getSafeHeroDataUri(entry)).toBe(`data:image/png;base64,${TINY_B64}`);
  });

  it("composes a valid JPEG data URI", () => {
    const entry = makeEntry({
      hero_mime_type: "image/jpeg",
      hero_base64: TINY_B64,
    });
    expect(getSafeHeroDataUri(entry)).toBe(
      `data:image/jpeg;base64,${TINY_B64}`,
    );
  });

  it("returns null when hero_mime_type is missing", () => {
    const entry = makeEntry({ hero_base64: TINY_B64 });
    expect(getSafeHeroDataUri(entry)).toBeNull();
  });

  it("returns null when hero_base64 is missing", () => {
    const entry = makeEntry({ hero_mime_type: "image/png" });
    expect(getSafeHeroDataUri(entry)).toBeNull();
  });

  it("returns null when hero_base64 is empty", () => {
    const entry = makeEntry({ hero_mime_type: "image/png", hero_base64: "" });
    expect(getSafeHeroDataUri(entry)).toBeNull();
  });

  it("returns null for SVG mime type even if bytes look valid", () => {
    // The TS type narrows away SVG, but JSON arriving from the extractor isn't
    // type-checked at runtime — simulate a malformed payload by casting.
    const entry = makeEntry({ hero_base64: TINY_B64 });
    (entry as { hero_mime_type: string }).hero_mime_type = "image/svg+xml";
    expect(getSafeHeroDataUri(entry)).toBeNull();
  });

  it("returns null for malformed base64 (contains !)", () => {
    const entry = makeEntry({
      hero_mime_type: "image/png",
      hero_base64: "iVBOR!w0KGgo=",
    });
    expect(getSafeHeroDataUri(entry)).toBeNull();
  });

  it("returns null for oversized base64", () => {
    const entry = makeEntry({
      hero_mime_type: "image/png",
      hero_base64: "A".repeat(600 * 1024),
    });
    expect(getSafeHeroDataUri(entry)).toBeNull();
  });
});
