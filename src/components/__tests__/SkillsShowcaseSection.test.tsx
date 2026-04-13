import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SkillsShowcaseSection } from "@/components/SkillsShowcaseSection";
import type { HarnessSkillEntry } from "@/types/insights";

const TINY_PNG_B64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwADhgGAWjR9awAAAABJRU5ErkJggg==";

function makeSkill(
  overrides: Partial<HarnessSkillEntry> = {},
): HarnessSkillEntry {
  return {
    name: "test-skill",
    calls: 1,
    source: "user",
    description: "",
    readme_markdown: "# README\n\nBody.",
    ...overrides,
  };
}

function render(skills: HarnessSkillEntry[]): string {
  return renderToStaticMarkup(
    <SkillsShowcaseSection skillInventory={skills} />,
  );
}

describe("SkillsShowcaseSection", () => {
  it("renders nothing when no skill has showcase content", () => {
    const html = render([
      makeSkill({ name: "no-readme", readme_markdown: null }),
    ]);
    expect(html).toBe("");
  });

  it("renders nothing for empty input", () => {
    expect(render([])).toBe("");
  });

  it("renders flat list (no TOC) when no skill has a category", () => {
    const html = render([makeSkill({ name: "a" }), makeSkill({ name: "b" })]);
    expect(html).toContain("a");
    expect(html).toContain("b");
    // No category-anchor should appear
    expect(html).not.toContain("#skill-cat-");
  });

  it("renders TOC and category groups when skills have categories", () => {
    const html = render([
      makeSkill({ name: "a", category: "Productivity" }),
      makeSkill({ name: "b", category: "Coding" }),
    ]);
    expect(html).toContain("#skill-cat-productivity");
    expect(html).toContain("#skill-cat-coding");
    expect(html).toContain("Productivity");
    expect(html).toContain("Coding");
  });

  it("groups null-category skills under Other (sorted last)", () => {
    const html = render([
      makeSkill({ name: "a", category: "Coding" }),
      makeSkill({ name: "b", category: null }),
    ]);
    expect(html).toContain("Other");
    // Other appears AFTER Coding in the rendered HTML
    expect(html.indexOf("Coding")).toBeLessThan(html.indexOf("Other"));
  });

  it("renders a hero <img> with data: URI when valid PNG provided", () => {
    const html = render([
      makeSkill({
        name: "with-hero",
        hero_mime_type: "image/png",
        hero_base64: TINY_PNG_B64,
      }),
    ]);
    expect(html).toContain("<img");
    expect(html).toContain(`data:image/png;base64,${TINY_PNG_B64}`);
  });

  it("omits <img> when hero_mime_type is missing", () => {
    const html = render([
      makeSkill({ name: "no-hero", hero_base64: TINY_PNG_B64 }),
    ]);
    expect(html).not.toContain("<img");
  });

  it("omits <img> when hero is malformed (caught by getSafeHeroDataUri)", () => {
    const html = render([
      makeSkill({
        name: "bad-hero",
        hero_mime_type: "image/png",
        hero_base64: "not!valid!base64",
      }),
    ]);
    expect(html).not.toContain("<img");
  });

  it("renders skill anchor ids using kebab-case skill names", () => {
    const html = render([makeSkill({ name: "Some Cool Skill" })]);
    expect(html).toContain('id="skill-some-cool-skill"');
  });

  it("section root carries id=skill-showcase for teaser link target", () => {
    const html = render([makeSkill({ name: "a" })]);
    expect(html).toContain('id="skill-showcase"');
  });

  it("renders the README markdown via SkillReadme (sanitized)", () => {
    const html = render([
      makeSkill({
        name: "skill",
        readme_markdown: "# Hello\n\n<script>alert(1)</script>\n\nWorld",
      }),
    ]);
    expect(html).toContain("Hello");
    expect(html).toContain("World");
    // Sanitizer must strip the script tag
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("alert(1)");
  });

  it("only renders skills with showcase content (skips bare-summary entries)", () => {
    const html = render([
      makeSkill({ name: "with-readme" }),
      makeSkill({ name: "bare", readme_markdown: null }),
    ]);
    expect(html).toContain("with-readme");
    expect(html).not.toContain("bare");
  });
});
