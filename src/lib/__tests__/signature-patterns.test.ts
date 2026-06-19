import { describe, expect, it } from "vitest";

import { deriveSignaturePatterns } from "@/lib/signature-patterns";
import type { HarnessData } from "@/types/insights";

// Minimal complete HarnessData; override only the fields a given pattern reads.
function makeHarnessData(overrides: Partial<HarnessData> = {}): HarnessData {
  return {
    stats: {
      totalTokens: 0,
      durationHours: 0,
      avgSessionMinutes: 0,
      skillsUsedCount: 0,
      hooksCount: 0,
      prCount: 0,
    },
    autonomy: {
      label: "",
      description: "",
      userMessages: 0,
      assistantMessages: 0,
      turnCount: 0,
      errorRate: "",
    },
    featurePills: [],
    toolUsage: {},
    skillInventory: [],
    hookDefinitions: [],
    hookFrequency: {},
    plugins: [],
    harnessFiles: [],
    fileOpStyle: {
      readPct: 0,
      editPct: 0,
      writePct: 0,
      grepCount: 0,
      globCount: 0,
      style: "",
    },
    agentDispatch: null,
    cliTools: {},
    languages: {},
    models: {},
    permissionModes: {},
    mcpServers: {},
    gitPatterns: {
      prCount: 0,
      commitCount: 0,
      linesAdded: "0",
      branchPrefixes: {},
    },
    versions: [],
    writeupSections: [],
    workflowData: null,
    integrityHash: "",
    skillVersion: null,
    ...overrides,
  };
}

function byId(h: HarnessData) {
  return Object.fromEntries(deriveSignaturePatterns(h).map((p) => [p.id, p]));
}

describe("deriveSignaturePatterns — empty / guards", () => {
  it("returns [] for null/undefined", () => {
    expect(deriveSignaturePatterns(null)).toEqual([]);
    expect(deriveSignaturePatterns(undefined)).toEqual([]);
  });

  it("returns [] when nothing clears threshold", () => {
    expect(deriveSignaturePatterns(makeHarnessData())).toEqual([]);
  });
});

describe("autonomy (lead)", () => {
  const h = makeHarnessData({
    autonomy: {
      label: "Fire-and-Forget",
      description: "1 human turn per 13 Claude turns",
      userMessages: 2038,
      assistantMessages: 26832,
      turnCount: 0,
      errorRate: "3.4%",
    },
    permissionModes: { bypassPermissions: 99, default: 1 },
  });

  it("is the lead card with headline = autonomy.label", () => {
    const p = byId(h).autonomy;
    expect(p).toBeTruthy();
    expect(p.emphasis).toBe("lead");
    expect(p.headline).toBe("Fire-and-Forget");
  });

  it("builds the verified proof chips", () => {
    const p = byId(h).autonomy;
    expect(p.proof).toContain("1 : 13 human:agent turns");
    expect(p.proof).toContain("2,038 sent · 26,832 back");
    expect(p.proof).toContain("99% bypassPermissions");
    expect(p.proof).toContain("3.4% error rate");
  });

  it("omits the error-rate chip when it is 0%", () => {
    const p = byId(
      makeHarnessData({
        autonomy: { ...h.autonomy, errorRate: "0%" },
        permissionModes: h.permissionModes,
      }),
    ).autonomy;
    expect(p.proof.some((c) => c.includes("error rate"))).toBe(false);
  });

  it("is omitted without a label or without human turns", () => {
    expect(
      byId(makeHarnessData({ autonomy: { ...h.autonomy, label: "" } }))
        .autonomy,
    ).toBeUndefined();
    expect(
      byId(makeHarnessData({ autonomy: { ...h.autonomy, userMessages: 0 } }))
        .autonomy,
    ).toBeUndefined();
  });
});

describe("subagents", () => {
  it("requires >= 5 agents", () => {
    const few = makeHarnessData({
      agentDispatch: {
        totalAgents: 4,
        types: {},
        models: {},
        backgroundPct: 0,
        customAgents: [],
      },
    });
    expect(byId(few).subagents).toBeUndefined();
  });

  it("headlines the count and tiers models when there are 2+ families", () => {
    const h = makeHarnessData({
      agentDispatch: {
        totalAgents: 304,
        types: { "general-purpose": 216, Explore: 88 },
        models: { "claude-sonnet-4-5": 69, "claude-opus-4-6": 18 },
        backgroundPct: 45,
        customAgents: [],
      },
    });
    const p = byId(h).subagents;
    expect(p.headline).toBe("Orchestrates 304 sub-agents");
    expect(p.characterization).toContain("model-tiered");
    expect(p.proof).toContain("304 agents");
    expect(p.proof).toContain("45% background");
    expect(p.proof).toContain("sonnet 69 / opus 18");
    expect(p.proof).toContain("top type: general-purpose (216)");
  });

  it("drops the tier chip (and 'model-tiered') with a single model family", () => {
    const h = makeHarnessData({
      agentDispatch: {
        totalAgents: 12,
        types: {},
        models: { "claude-opus-4-6": 12 },
        backgroundPct: 0,
        customAgents: [],
      },
    });
    const p = byId(h).subagents;
    expect(p.characterization).not.toContain("model-tiered");
    expect(p.proof.some((c) => c.includes("/"))).toBe(false);
  });
});

describe("explore-first", () => {
  const strong = {
    exploreBeforeImplPct: 74,
    testBeforeShipPct: 3,
    totalSessionsWithPhases: 106,
  };

  it("headlines the explore pct and flags the honest test gap", () => {
    const p = byId(
      makeHarnessData({
        workflowData: {
          skillInvocations: {},
          agentDispatches: {},
          workflowPatterns: [],
          phaseTransitions: {},
          phaseDistribution: {},
          phaseStats: strong,
        },
      }),
    )["explore-first"];
    expect(p.headline).toBe("Explores before building — 74%");
    expect(p.characterization).toContain("honest gap");
    expect(p.proof).toContain("exploreBeforeImpl 74%");
    expect(p.proof).toContain("testBeforeShip 3%");
  });

  it("is omitted below 50% explore or under 5 phased sessions", () => {
    const low = makeHarnessData({
      workflowData: {
        skillInvocations: {},
        agentDispatches: {},
        workflowPatterns: [],
        phaseTransitions: {},
        phaseDistribution: {},
        phaseStats: { ...strong, exploreBeforeImplPct: 40 },
      },
    });
    expect(byId(low)["explore-first"]).toBeUndefined();
    const fewSessions = makeHarnessData({
      workflowData: {
        skillInvocations: {},
        agentDispatches: {},
        workflowPatterns: [],
        phaseTransitions: {},
        phaseDistribution: {},
        phaseStats: { ...strong, totalSessionsWithPhases: 3 },
      },
    });
    expect(byId(fewSessions)["explore-first"]).toBeUndefined();
  });
});

describe("dual-engine", () => {
  it("appears when codex CLI was invoked", () => {
    const p = byId(
      makeHarnessData({
        cliTools: { git: 500, codex: 71 },
        gitPatterns: {
          prCount: 0,
          commitCount: 0,
          linesAdded: "0",
          branchPrefixes: { codex: 27, fix: 10 },
        },
      }),
    )["dual-engine"];
    expect(p.headline).toBe("Runs Claude + Codex");
    expect(p.proof).toContain("codex called 71×");
    expect(p.proof).toContain("codex branch prefix 27×");
  });

  it("is omitted without a codex signal", () => {
    expect(
      byId(makeHarnessData({ cliTools: { git: 500 } }))["dual-engine"],
    ).toBeUndefined();
  });
});

describe("authorship", () => {
  const mk = (sources: string[]) =>
    makeHarnessData({
      skillInventory: sources.map((source, i) => ({
        name: `skill-${i}`,
        calls: 1,
        source,
        description: "",
      })),
    });

  it("requires >= 2 authored (custom/user) skills", () => {
    expect(byId(mk(["custom"])).authorship).toBeUndefined();
    expect(
      byId(mk(["plugin:foo/bar", "plugin:baz"])).authorship,
    ).toBeUndefined();
  });

  it("headlines 'Builds the tools they use' at 3+, 'Author of N' at 2", () => {
    expect(byId(mk(["custom", "user", "custom"])).authorship.headline).toBe(
      "Builds the tools they use",
    );
    expect(byId(mk(["custom", "user"])).authorship.headline).toBe(
      "Author of 2 skills",
    );
  });

  it("lists authored names (capped) and excludes installed plugins", () => {
    const p = byId(mk(["custom", "user", "plugin:x"])).authorship;
    expect(p.proof[0]).toContain("skill-0");
    expect(p.proof[0]).toContain("skill-1");
    expect(p.proof[0]).not.toContain("skill-2"); // the plugin
  });
});

describe("ordering & cap", () => {
  it("puts autonomy first and caps at 5", () => {
    const h = makeHarnessData({
      autonomy: {
        label: "Fire-and-Forget",
        description: "",
        userMessages: 100,
        assistantMessages: 1300,
        turnCount: 0,
        errorRate: "2%",
      },
      agentDispatch: {
        totalAgents: 50,
        types: { "general-purpose": 50 },
        models: { "claude-sonnet-4-5": 30, "claude-opus-4-6": 20 },
        backgroundPct: 40,
        customAgents: [],
      },
      workflowData: {
        skillInvocations: {},
        agentDispatches: {},
        workflowPatterns: [],
        phaseTransitions: {},
        phaseDistribution: {},
        phaseStats: {
          exploreBeforeImplPct: 80,
          testBeforeShipPct: 60,
          totalSessionsWithPhases: 40,
        },
      },
      cliTools: { codex: 5 },
      skillInventory: [
        { name: "a", calls: 1, source: "custom", description: "" },
        { name: "b", calls: 1, source: "user", description: "" },
      ],
    });
    const patterns = deriveSignaturePatterns(h);
    expect(patterns).toHaveLength(5);
    expect(patterns[0].id).toBe("autonomy");
  });
});
