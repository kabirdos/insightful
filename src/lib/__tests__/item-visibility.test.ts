import { describe, it, expect } from "vitest";
import {
  slugItemKey,
  buildItemKey,
  isItemHidden,
  isSectionHidden,
  hideSetFromArray,
  filterList,
  filterRecord,
  parseKeypath,
} from "../item-visibility";

describe("slugItemKey", () => {
  it("kebab-cases and lowercases", () => {
    expect(slugItemKey("Parallel Refactor")).toBe("parallel-refactor");
  });

  it("is idempotent", () => {
    const slug = slugItemKey("Hello World");
    expect(slugItemKey(slug)).toBe(slug);
  });

  it("handles emoji and unicode by stripping", () => {
    expect(slugItemKey("🚀 Deploy Pipeline")).toBe("deploy-pipeline");
  });

  it("collapses multiple hyphens", () => {
    expect(slugItemKey("foo---bar")).toBe("foo-bar");
  });

  it("trims leading/trailing hyphens", () => {
    expect(slugItemKey("--hello--")).toBe("hello");
  });

  it("enforces 60 char max", () => {
    const long = "a".repeat(100);
    expect(slugItemKey(long).length).toBeLessThanOrEqual(60);
  });

  it("returns empty string for purely non-alphanumeric input", () => {
    expect(slugItemKey("🎉🎊")).toBe("");
  });
});

describe("buildItemKey", () => {
  it("returns bare slug when no collision", () => {
    const list = [{ name: "Alpha" }, { name: "Beta" }];
    expect(buildItemKey(list, 0, (x) => x.name)).toBe("alpha");
    expect(buildItemKey(list, 1, (x) => x.name)).toBe("beta");
  });

  it("appends @index when collision exists", () => {
    const list = [{ name: "Refactor" }, { name: "Refactor" }, { name: "Other" }];
    expect(buildItemKey(list, 0, (x) => x.name)).toBe("refactor@0");
    expect(buildItemKey(list, 1, (x) => x.name)).toBe("refactor@1");
    expect(buildItemKey(list, 2, (x) => x.name)).toBe("other");
  });

  it("falls back to @index for empty slugs", () => {
    const list = [{ name: "🎉" }];
    expect(buildItemKey(list, 0, (x) => x.name)).toBe("@0");
  });
});

describe("parseKeypath", () => {
  it("parses top-level key", () => {
    expect(parseKeypath("skillInventory")).toEqual({
      topKey: "skillInventory",
      itemKey: null,
    });
  });

  it("parses item-level keypath", () => {
    expect(parseKeypath("skillInventory.parallel-refactor")).toEqual({
      topKey: "skillInventory",
      itemKey: "parallel-refactor",
    });
  });

  it("parses keypath with collision index", () => {
    expect(parseKeypath("impressiveWorkflows.refactor@2")).toEqual({
      topKey: "impressiveWorkflows",
      itemKey: "refactor@2",
    });
  });

  it("rejects empty string", () => {
    expect(parseKeypath("")).toBeNull();
  });

  it("rejects malformed topKey (starts with number)", () => {
    expect(parseKeypath("123abc")).toBeNull();
  });

  it("rejects keypath with empty itemKey", () => {
    expect(parseKeypath("skillInventory.")).toBeNull();
  });

  it("rejects itemKey with uppercase", () => {
    expect(parseKeypath("skillInventory.Refactor")).toBeNull();
  });
});

describe("isSectionHidden / isItemHidden", () => {
  it("isSectionHidden returns true when top-level key present", () => {
    const hidden = hideSetFromArray(["skillInventory"]);
    expect(isSectionHidden(hidden, "skillInventory")).toBe(true);
    expect(isSectionHidden(hidden, "plugins")).toBe(false);
  });

  it("isItemHidden returns true for item keypath", () => {
    const hidden = hideSetFromArray(["skillInventory.parallel-refactor"]);
    expect(isItemHidden(hidden, "skillInventory", "parallel-refactor")).toBe(true);
    expect(isItemHidden(hidden, "skillInventory", "other")).toBe(false);
  });

  it("section-level hide trumps item-level", () => {
    const hidden = hideSetFromArray(["skillInventory"]);
    expect(isItemHidden(hidden, "skillInventory", "anything")).toBe(true);
  });
});

describe("filterList", () => {
  const items = [
    { name: "Alpha" },
    { name: "Beta" },
    { name: "Gamma" },
  ];

  it("returns all items when nothing hidden", () => {
    const hidden = hideSetFromArray([]);
    const result = filterList(items, hidden, "skillInventory", (x) => x.name);
    expect(result).toHaveLength(3);
  });

  it("returns empty when section-level hidden", () => {
    const hidden = hideSetFromArray(["skillInventory"]);
    const result = filterList(items, hidden, "skillInventory", (x) => x.name);
    expect(result).toHaveLength(0);
  });

  it("filters specific items by keypath", () => {
    const hidden = hideSetFromArray(["skillInventory.beta"]);
    const result = filterList(items, hidden, "skillInventory", (x) => x.name);
    expect(result).toHaveLength(2);
    expect(result.map((x) => x.name)).toEqual(["Alpha", "Gamma"]);
  });

  it("handles multiple hides", () => {
    const hidden = hideSetFromArray([
      "skillInventory.alpha",
      "skillInventory.gamma",
    ]);
    const result = filterList(items, hidden, "skillInventory", (x) => x.name);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Beta");
  });
});

describe("filterRecord", () => {
  const rec = { TypeScript: 100, Python: 50, Rust: 30 };

  it("returns all entries when nothing hidden", () => {
    const hidden = hideSetFromArray([]);
    const result = filterRecord(rec, hidden, "languages");
    expect(Object.keys(result)).toHaveLength(3);
  });

  it("returns empty when section-level hidden", () => {
    const hidden = hideSetFromArray(["languages"]);
    const result = filterRecord(rec, hidden, "languages");
    expect(Object.keys(result)).toHaveLength(0);
  });

  it("filters specific entries by keypath", () => {
    const hidden = hideSetFromArray(["languages.python"]);
    const result = filterRecord(rec, hidden, "languages");
    expect(Object.keys(result)).toEqual(["TypeScript", "Rust"]);
  });
});
