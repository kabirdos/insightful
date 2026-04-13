import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SkillsTeaserCard } from "@/components/SkillsTeaserCard";
import type { HarnessSkillEntry } from "@/types/insights";

function makeSkill(
  overrides: Partial<HarnessSkillEntry> = {},
): HarnessSkillEntry {
  return {
    name: "test-skill",
    calls: 1,
    source: "user",
    description: "",
    readme_markdown: "# README",
    ...overrides,
  };
}

function render(skills: HarnessSkillEntry[]): string {
  return renderToStaticMarkup(<SkillsTeaserCard skillInventory={skills} />);
}

describe("SkillsTeaserCard", () => {
  it("renders nothing when no skill has showcase content", () => {
    const html = render([
      makeSkill({ name: "no-readme", readme_markdown: null }),
    ]);
    expect(html).toBe("");
  });

  it("renders nothing for empty input", () => {
    expect(render([])).toBe("");
  });

  it("renders top-5 shareable skills sorted by calls desc", () => {
    const skills = [
      makeSkill({ name: "low", calls: 1 }),
      makeSkill({ name: "high", calls: 100 }),
      makeSkill({ name: "mid", calls: 50 }),
    ];
    const html = render(skills);
    const highIdx = html.indexOf("high");
    const midIdx = html.indexOf("mid");
    const lowIdx = html.indexOf("low");
    expect(highIdx).toBeLessThan(midIdx);
    expect(midIdx).toBeLessThan(lowIdx);
  });

  it("alphabetic tiebreak when calls are equal", () => {
    const skills = [
      makeSkill({ name: "zebra", calls: 5 }),
      makeSkill({ name: "alpha", calls: 5 }),
    ];
    const html = render(skills);
    expect(html.indexOf("alpha")).toBeLessThan(html.indexOf("zebra"));
  });

  it("caps at 5 entries even when more have showcase content", () => {
    const skills = Array.from({ length: 8 }, (_, i) =>
      makeSkill({ name: `skill-${i}`, calls: 100 - i }),
    );
    const html = render(skills);
    // Top 5 should appear
    expect(html).toContain("skill-0");
    expect(html).toContain("skill-4");
    // 6th should not
    expect(html).not.toContain("skill-5");
  });

  it("excludes entries without showcase content", () => {
    const skills = [
      makeSkill({ name: "with-readme", readme_markdown: "# x" }),
      makeSkill({ name: "without-readme", readme_markdown: null }),
    ];
    const html = render(skills);
    expect(html).toContain("with-readme");
    expect(html).not.toContain("without-readme");
  });

  it("renders View all anchor pointing at #skill-showcase", () => {
    const html = render([makeSkill({ name: "a" })]);
    expect(html).toContain('href="#skill-showcase"');
  });

  it("renders skill anchors with kebab-case ids", () => {
    const html = render([makeSkill({ name: "Some Cool Skill" })]);
    expect(html).toContain("#skill-some-cool-skill");
  });

  it("renders distinct badges for plugin vs custom skills", () => {
    const html = render([
      makeSkill({ name: "p", source: "plugin:foo/bar" }),
      makeSkill({ name: "c", source: "user" }),
    ]);
    expect(html).toContain("plugin");
    expect(html).toContain("custom");
  });
});
