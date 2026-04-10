import { describe, expect, it } from "vitest";
import {
  getSafeCommandHighlights,
  getSafeSkillHighlights,
  parseSkillKey,
  safeSequenceLabel,
  safeSkillKeyLabel,
  sanitizeWorkflowCommandName,
  sanitizeWorkflowSkillName,
} from "@/lib/privacy-safe-workflow";

describe("sanitizeWorkflowSkillName", () => {
  it("keeps plugin skills readable", () => {
    expect(sanitizeWorkflowSkillName("github:gh-fix-ci", "plugin")).toBe(
      "gh-fix-ci",
    );
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

describe("parseSkillKey", () => {
  it("splits a plugin-prefixed key", () => {
    expect(parseSkillKey("superpowers:writing-plans")).toEqual({
      plugin: "superpowers",
      shortName: "writing-plans",
    });
  });

  it("returns custom plugin for keys without a colon", () => {
    expect(parseSkillKey("ux-mockup")).toEqual({
      plugin: "custom",
      shortName: "ux-mockup",
    });
  });
});

describe("safeSkillKeyLabel", () => {
  it("trusts known-plugin skills (strips prefix, returns short name)", () => {
    // The WorkflowDiagram passes plugin-prefixed keys directly. The
    // sanitizer should NOT mask superpowers/compound-engineering/etc.
    // because the marketplace vetted them.
    expect(safeSkillKeyLabel("superpowers:dispatching-parallel-agents")).toBe(
      "dispatching-parallel-agents",
    );
    expect(safeSkillKeyLabel("compound-engineering:ce-brainstorm")).toBe(
      "ce-brainstorm",
    );
    expect(safeSkillKeyLabel("pr-review-toolkit:silent-failure-hunter")).toBe(
      "silent-failure-hunter",
    );
  });

  it("masks custom skill names that contain risky tokens", () => {
    // These are the leak vectors codex flagged in WorkflowDiagram.tsx —
    // file paths, ticket IDs, URLs, @-handles inside custom skill names.
    expect(safeSkillKeyLabel("custom:ACME-1234-billing-fix")).toBe(
      "custom workflow skill",
    );
    expect(safeSkillKeyLabel("custom:src/billing/refund.ts")).toBe(
      "custom workflow skill",
    );
    expect(safeSkillKeyLabel("custom:@megacorp/internal-tool")).toBe(
      "custom workflow skill",
    );
    expect(safeSkillKeyLabel("custom:https://wiki.acme.corp/runbook")).toBe(
      "custom workflow skill",
    );
  });

  it("keeps generic custom skill names", () => {
    expect(safeSkillKeyLabel("custom:explain-this")).toBe("explain-this");
    expect(safeSkillKeyLabel("ux-mockup")).toBe("ux-mockup");
  });
});

describe("safeSequenceLabel", () => {
  it("joins plugin-prefixed skills with arrows and strips prefixes", () => {
    expect(
      safeSequenceLabel([
        "compound-engineering:ce-brainstorm",
        "superpowers:writing-plans",
        "pr-review-toolkit:code-reviewer",
      ]),
    ).toBe("ce-brainstorm → writing-plans → code-reviewer");
  });

  it("masks risky custom skills inside the chain", () => {
    // Even if other skills in the chain are safe, the risky one
    // should be masked. The codex finding called this out as the
    // 'Strongest path' pill leak — strongestPattern.label was just
    // sequence.join(" -> ") with no sanitization.
    expect(
      safeSequenceLabel([
        "superpowers:writing-plans",
        "custom:src/billing-secret/handler.ts",
        "pr-review-toolkit:code-reviewer",
      ]),
    ).toBe("writing-plans → custom workflow skill → code-reviewer");
  });

  it("returns empty string for an empty sequence", () => {
    expect(safeSequenceLabel([])).toBe("");
  });
});
