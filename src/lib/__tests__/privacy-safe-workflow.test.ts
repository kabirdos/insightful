import { describe, expect, it } from "vitest";
import {
  getSafeCommandHighlights,
  getSafeSkillHighlights,
  sanitizeWorkflowCommandName,
  sanitizeWorkflowSkillName,
} from "@/lib/privacy-safe-workflow";

describe("sanitizeWorkflowSkillName", () => {
  it("keeps plugin skills readable", () => {
    expect(
      sanitizeWorkflowSkillName("github:gh-fix-ci", "plugin"),
    ).toBe("gh-fix-ci");
  });

  it("keeps generic custom skill names", () => {
    expect(sanitizeWorkflowSkillName("ux-mockup", "custom")).toBe("ux-mockup");
  });

  it("masks obviously risky custom skill names", () => {
    expect(
      sanitizeWorkflowSkillName("acme-enterprise/src/billing-fix", "custom"),
    ).toBe("custom workflow skill");
  });
});

describe("sanitizeWorkflowCommandName", () => {
  it("keeps safe command shapes", () => {
    expect(sanitizeWorkflowCommandName("npm test")).toBe("npm test");
  });

  it("falls back to the first command token for noisy strings", () => {
    expect(sanitizeWorkflowCommandName("git push origin feat/acme-fix")).toBe(
      "git",
    );
  });
});

describe("workflow highlight helpers", () => {
  it("derives unique skill highlights", () => {
    expect(
      getSafeSkillHighlights(
        [
          { name: "ux-mockup", calls: 8, source: "custom", description: "" },
          {
            name: "github:gh-fix-ci",
            calls: 5,
            source: "plugin",
            description: "",
          },
          { name: "ux-mockup", calls: 3, source: "custom", description: "" },
        ],
        4,
      ),
    ).toEqual(["ux-mockup", "gh-fix-ci"]);
  });

  it("derives unique command highlights", () => {
    expect(
      getSafeCommandHighlights(
        { "npm test": 6, git: 5, "git push origin feat/acme": 2 },
        4,
      ),
    ).toEqual(["npm test", "git"]);
  });
});
