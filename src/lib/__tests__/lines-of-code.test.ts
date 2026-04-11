import { describe, expect, it } from "vitest";
import {
  parseHarnessLinesString,
  resolveLinesAdded,
  resolveLinesRemoved,
} from "../lines-of-code";

describe("parseHarnessLinesString", () => {
  it("parses K suffix (uppercase)", () => {
    expect(parseHarnessLinesString("44.0K")).toBe(44000);
  });

  it("parses K suffix with decimal", () => {
    expect(parseHarnessLinesString("18.4K")).toBe(18400);
  });

  it("parses k suffix (lowercase)", () => {
    expect(parseHarnessLinesString("18.4k")).toBe(18400);
  });

  it("parses M suffix (uppercase)", () => {
    expect(parseHarnessLinesString("1.2M")).toBe(1_200_000);
  });

  it("parses m suffix (lowercase)", () => {
    expect(parseHarnessLinesString("1.2m")).toBe(1_200_000);
  });

  it("parses plain integer strings", () => {
    expect(parseHarnessLinesString("44000")).toBe(44000);
  });

  it("parses thousands-separator strings", () => {
    expect(parseHarnessLinesString("18,400")).toBe(18400);
  });

  it("passes finite numbers through", () => {
    expect(parseHarnessLinesString(44000)).toBe(44000);
  });

  it("returns null for non-finite numbers", () => {
    expect(parseHarnessLinesString(Number.NaN)).toBeNull();
    expect(parseHarnessLinesString(Number.POSITIVE_INFINITY)).toBeNull();
  });

  it("returns null for null input", () => {
    expect(parseHarnessLinesString(null)).toBeNull();
  });

  it("returns null for undefined input", () => {
    expect(parseHarnessLinesString(undefined)).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(parseHarnessLinesString("")).toBeNull();
  });

  it("returns null for a whitespace-only string", () => {
    expect(parseHarnessLinesString("   ")).toBeNull();
  });

  it("returns null for garbage strings", () => {
    expect(parseHarnessLinesString("garbage")).toBeNull();
  });

  it("returns null for suffix typos (KB, lines, Q)", () => {
    // Strict full-string match: reject anything with extra letters or
    // trailing words so malformed harness JSON fails closed instead of
    // silently parsing just the prefix. Regression guard from the
    // codex review of #35.
    expect(parseHarnessLinesString("44.0KB")).toBeNull();
    expect(parseHarnessLinesString("18.4K lines")).toBeNull();
    expect(parseHarnessLinesString("1.2Q")).toBeNull();
  });

  it("returns null for multi-dot inputs", () => {
    expect(parseHarnessLinesString("1.2.3K")).toBeNull();
    expect(parseHarnessLinesString("1..2K")).toBeNull();
  });

  it("rejects a lone decimal with no leading digit", () => {
    // Our strict regex requires at least one leading digit.
    expect(parseHarnessLinesString(".5K")).toBeNull();
  });

  it("handles a sub-unit K-suffix value with a leading zero", () => {
    expect(parseHarnessLinesString("0.5K")).toBe(500);
  });
});

describe("resolveLinesAdded", () => {
  it("prefers the scalar column when present", () => {
    const result = resolveLinesAdded({
      linesAdded: 1234,
      linesRemoved: null,
      harnessData: { gitPatterns: { linesAdded: "44.0K" } },
    });
    expect(result).toBe(1234);
  });

  it("uses 0 from the scalar column when explicitly zero", () => {
    // Zero is a real value, not a fallback trigger.
    const result = resolveLinesAdded({
      linesAdded: 0,
      linesRemoved: null,
      harnessData: { gitPatterns: { linesAdded: "44.0K" } },
    });
    expect(result).toBe(0);
  });

  it("falls back to the harness string when the scalar is null", () => {
    const result = resolveLinesAdded({
      linesAdded: null,
      linesRemoved: null,
      harnessData: { gitPatterns: { linesAdded: "44.0K" } },
    });
    expect(result).toBe(44000);
  });

  it("falls back to the harness string when the scalar is undefined", () => {
    const result = resolveLinesAdded({
      harnessData: { gitPatterns: { linesAdded: "18.4K" } },
    });
    expect(result).toBe(18400);
  });

  it("returns null when both sources are null", () => {
    expect(
      resolveLinesAdded({
        linesAdded: null,
        linesRemoved: null,
        harnessData: null,
      }),
    ).toBeNull();
  });

  it("returns null when scalar is null and harnessData has no gitPatterns", () => {
    expect(
      resolveLinesAdded({
        linesAdded: null,
        harnessData: { gitPatterns: null },
      }),
    ).toBeNull();
  });

  it("returns null when scalar is null and harness string is unparseable", () => {
    expect(
      resolveLinesAdded({
        linesAdded: null,
        harnessData: { gitPatterns: { linesAdded: "garbage" } },
      }),
    ).toBeNull();
  });
});

describe("resolveLinesRemoved", () => {
  it("prefers the scalar column when present", () => {
    const result = resolveLinesRemoved({
      linesAdded: null,
      linesRemoved: 4321,
    });
    expect(result).toBe(4321);
  });

  it("uses 0 from the scalar column when explicitly zero", () => {
    const result = resolveLinesRemoved({
      linesRemoved: 0,
      harnessData: { gitPatterns: { linesRemoved: "5.0K" } },
    });
    expect(result).toBe(0);
  });

  it("falls back to harnessData.gitPatterns.linesRemoved when scalar is null", () => {
    // Defensive: the harness pipeline does not populate this today,
    // but the resolver is symmetrical so future schema changes work.
    const result = resolveLinesRemoved({
      linesRemoved: null,
      harnessData: { gitPatterns: { linesRemoved: "9.2K" } },
    });
    expect(result).toBe(9200);
  });

  it("returns null when scalar is null and no fallback exists", () => {
    // Real harness reports today: scalar NULL, gitPatterns has only
    // linesAdded, so resolveLinesRemoved should cleanly return null.
    expect(
      resolveLinesRemoved({
        linesRemoved: null,
        harnessData: { gitPatterns: { linesAdded: "44.0K" } },
      }),
    ).toBeNull();
  });

  it("returns null when both sources are null", () => {
    expect(
      resolveLinesRemoved({
        linesAdded: null,
        linesRemoved: null,
        harnessData: null,
      }),
    ).toBeNull();
  });
});
