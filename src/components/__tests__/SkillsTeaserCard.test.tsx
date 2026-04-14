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

// Visible card count on the Dashboard — matches the teaser grid in the
// SkillsTeaserCard component. Kept as a constant so tests track the
// component without hard-coding the number in multiple places.
const VISIBLE_CARDS = 3;

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

  it("orders top cards by calls desc — anchor href order reflects the sort", () => {
    const skills = [
      makeSkill({ name: "low", calls: 1 }),
      makeSkill({ name: "high", calls: 100 }),
      makeSkill({ name: "mid", calls: 50 }),
    ];
    const html = render(skills);
    const highIdx = html.indexOf('href="#skill-high"');
    const midIdx = html.indexOf('href="#skill-mid"');
    const lowIdx = html.indexOf('href="#skill-low"');
    expect(highIdx).toBeGreaterThan(-1);
    expect(highIdx).toBeLessThan(midIdx);
    expect(midIdx).toBeLessThan(lowIdx);
  });

  it("alphabetic tiebreak when calls are equal", () => {
    const skills = [
      makeSkill({ name: "zebra", calls: 5 }),
      makeSkill({ name: "alpha", calls: 5 }),
    ];
    const html = render(skills);
    expect(html.indexOf('href="#skill-alpha"')).toBeLessThan(
      html.indexOf('href="#skill-zebra"'),
    );
  });

  it("caps visible cards and links overflow into the Skills tab", () => {
    const skills = Array.from({ length: 8 }, (_, i) =>
      makeSkill({ name: `skill-${i}`, calls: 100 - i }),
    );
    const html = render(skills);
    // Visible cards (top VISIBLE_CARDS) each get a hash anchor
    for (let i = 0; i < VISIBLE_CARDS; i++) {
      expect(html).toContain(`href="#skill-skill-${i}"`);
    }
    // Overflow skills are NOT rendered as anchor cards on Dashboard
    for (let i = VISIBLE_CARDS; i < 8; i++) {
      expect(html).not.toContain(`href="#skill-skill-${i}"`);
    }
    // Header + footer link both advertise the total count of 8
    expect(html).toContain("See all 8 in Skills tab →");
    expect(html).toContain("8 published");
    // Footer pluralizes the overflow count correctly
    expect(html).toContain(`+ ${8 - VISIBLE_CARDS} more deep dives`);
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

  it("renders See all link pointing at #skill-showcase", () => {
    const html = render([makeSkill({ name: "a" })]);
    expect(html).toContain('href="#skill-showcase"');
  });

  it("renders skill anchors with kebab-case ids", () => {
    const html = render([makeSkill({ name: "Some Cool Skill" })]);
    expect(html).toContain('href="#skill-some-cool-skill"');
  });

  it("renders distinct badges for plugin vs custom skills", () => {
    const html = render([
      makeSkill({ name: "p", source: "plugin:foo/bar" }),
      makeSkill({ name: "c", source: "user" }),
    ]);
    expect(html).toContain("plugin");
    expect(html).toContain("custom");
  });

  it("renders the Skill deep dives heading + Read deep dive CTA", () => {
    const html = render([makeSkill({ name: "a" })]);
    expect(html).toContain("Skill deep dives");
    expect(html).toContain("Read deep dive");
  });

  it("shows placeholder when a skill has no description", () => {
    const html = render([makeSkill({ name: "no-desc", description: "" })]);
    expect(html).toContain("No description provided");
  });

  it("footer link uses singular wording when exactly one skill overflows", () => {
    const skills = Array.from({ length: VISIBLE_CARDS + 1 }, (_, i) =>
      makeSkill({ name: `s-${i}`, calls: 100 - i }),
    );
    const html = render(skills);
    expect(html).toContain("+ 1 more deep dive in the Skills tab");
    expect(html).not.toContain("+ 1 more deep dives");
  });
});
