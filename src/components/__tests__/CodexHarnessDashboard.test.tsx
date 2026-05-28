import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import CodexHarnessDashboard from "@/components/CodexHarnessDashboard";
import type { CodexHarnessData } from "@/types/insights";

function codexData(
  overrides: Partial<CodexHarnessData> = {},
): CodexHarnessData {
  return {
    tool: "codex",
    stats: {
      totalTokens: 2000,
      sessionCount: 12,
      payloadFormatSessions: 10,
      legacyFormatSessions: 2,
    },
    toolUsage: { exec_command: 8 },
    cliTools: { git: 3 },
    skillInventory: [{ name: "code-review", description: "Review code" }],
    plugins: [{ name: "github", enabled: true }],
    safety: {
      approvalsReviewer: "model",
      approvalModes: ["approve"],
      trustLevels: ["trusted"],
      rulesAllowlist: ["git"],
    },
    workflowData: null,
    workSurfaces: {
      desktopPresence: [{ tool: "Codex CLI", present: true }],
    },
    localOnly: true,
    ...overrides,
  };
}

describe("CodexHarnessDashboard", () => {
  it("renders Codex inventory without fabricating skill counts", () => {
    const html = renderToStaticMarkup(
      <CodexHarnessDashboard codexData={codexData()} />,
    );

    expect(html).toContain("Codex profiles are generated from local CLI");
    expect(html).toContain("code-review");
    expect(html).toContain("Review code");
    expect(html).not.toContain("Hooks &amp; Safety");
    expect(html).not.toContain("Agent Dispatch");
  });

  it("shows an empty workflow state when no phase signal exists", () => {
    const html = renderToStaticMarkup(
      <CodexHarnessDashboard
        codexData={codexData({ workflowData: { phaseTransitions: {} } })}
      />,
    );

    expect(html).toContain("No workflow phase signal was detected");
  });
});
