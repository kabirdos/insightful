import { describe, it, expect } from "vitest";
import {
  wantsAgentPayload,
  stripHeroImages,
  buildAgentPayload,
  AGENT_PAYLOAD_SCHEMA_VERSION,
  AGENT_PAYLOAD_MEDIA_TYPE,
} from "../agent-payload";

function bareHarnessData(overrides: Record<string, unknown> = {}) {
  return {
    skillVersion: "2.7.0",
    skillInventory: [
      {
        name: "frontend-design",
        calls: 5,
        source: "plugin",
        description: "Design things",
        readme_markdown: "# How to use\nDo the thing.",
        hero_base64: "iVBORw0KGgo...".repeat(50),
        hero_mime_type: "image/png",
      },
      {
        name: "no-showcase",
        calls: 2,
        source: "custom",
        description: "Plain skill",
      },
    ],
    ...overrides,
  };
}

describe("wantsAgentPayload", () => {
  it("matches the versioned vendor media type", () => {
    expect(wantsAgentPayload(AGENT_PAYLOAD_MEDIA_TYPE)).toBe(true);
  });

  it("matches when the vendor type is one of several Accept entries", () => {
    expect(
      wantsAgentPayload(`text/html, ${AGENT_PAYLOAD_MEDIA_TYPE};q=0.9, */*`),
    ).toBe(true);
  });

  it("rejects an unsupported future major version (we only emit v1)", () => {
    // A v2-only client must not silently receive a v1 body; it falls through
    // to the default response until a v2 contract actually exists.
    expect(
      wantsAgentPayload("application/vnd.insight-harness.agent.v2+json"),
    ).toBe(false);
  });

  it("does not match a browser fetch (*/*) or HTML navigation", () => {
    expect(wantsAgentPayload("*/*")).toBe(false);
    expect(wantsAgentPayload("text/html,application/xhtml+xml")).toBe(false);
  });

  it("does not match missing/empty Accept", () => {
    expect(wantsAgentPayload(null)).toBe(false);
    expect(wantsAgentPayload(undefined)).toBe(false);
    expect(wantsAgentPayload("")).toBe(false);
  });

  it("honors an explicit q=0 refusal of the agent media type", () => {
    expect(
      wantsAgentPayload(
        "application/json, application/vnd.insight-harness.agent.v1+json;q=0",
      ),
    ).toBe(false);
    expect(
      wantsAgentPayload("application/vnd.insight-harness.agent.v1+json;q=0.0"),
    ).toBe(false);
  });

  it("accepts a positive q-value and tolerates a malformed one", () => {
    expect(
      wantsAgentPayload("application/vnd.insight-harness.agent.v1+json;q=0.8"),
    ).toBe(true);
    expect(
      wantsAgentPayload(
        "application/vnd.insight-harness.agent.v1+json;q=bogus",
      ),
    ).toBe(true);
  });
});

describe("stripHeroImages", () => {
  it("nulls hero image bytes but keeps readme_markdown (bare HarnessData)", () => {
    const out = stripHeroImages(bareHarnessData()) as {
      skillInventory: Array<Record<string, unknown>>;
    };
    const designed = out.skillInventory[0];
    expect(designed.hero_base64).toBeNull();
    expect(designed.hero_mime_type).toBeNull();
    // README is high-signal, scrubbed text — agents want it.
    expect(designed.readme_markdown).toBe("# How to use\nDo the thing.");
  });

  it("strips images inside a multi-tool envelope and leaves codex untouched", () => {
    const envelope = {
      primaryTool: "claude-code",
      tools: {
        "claude-code": bareHarnessData(),
        codex: {
          tool: "codex",
          skillInventory: [{ name: "codex-skill", description: "x" }],
        },
      },
    };
    const out = stripHeroImages(envelope) as {
      primaryTool: string;
      tools: {
        "claude-code": { skillInventory: Array<Record<string, unknown>> };
        codex: { skillInventory: Array<Record<string, unknown>> };
      };
    };
    expect(out.primaryTool).toBe("claude-code");
    expect(out.tools["claude-code"].skillInventory[0].hero_base64).toBeNull();
    // This Codex entry has no image fields, so it's preserved verbatim.
    expect(out.tools.codex.skillInventory[0]).toEqual({
      name: "codex-skill",
      description: "x",
    });
  });

  it("strips camelCase hero fields from Codex skills (codex_extract emits heroBase64)", () => {
    const envelope = {
      primaryTool: "codex",
      tools: {
        codex: {
          tool: "codex",
          skillInventory: [
            {
              name: "codex-skill",
              heroBase64: "AAAA".repeat(200),
              heroMimeType: "image/png",
            },
          ],
        },
      },
    };
    const out = stripHeroImages(envelope) as {
      tools: { codex: { skillInventory: Array<Record<string, unknown>> } };
    };
    const entry = out.tools.codex.skillInventory[0];
    expect(entry.heroBase64).toBeNull();
    expect(entry.heroMimeType).toBeNull();
    expect(entry.name).toBe("codex-skill");
  });

  it("returns non-object / inventory-less input unchanged", () => {
    expect(stripHeroImages(null)).toBeNull();
    expect(stripHeroImages("nope")).toBe("nope");
    const noInv = { stats: {} };
    expect(stripHeroImages(noInv)).toEqual(noInv);
  });

  it("does not mutate the input", () => {
    const input = bareHarnessData();
    const originalHero = input.skillInventory[0].hero_base64;
    stripHeroImages(input);
    expect(input.skillInventory[0].hero_base64).toBe(originalHero);
  });
});

describe("buildAgentPayload", () => {
  it("wraps the profile with a versioned, privacy-described envelope", () => {
    const payload = buildAgentPayload({ harnessData: bareHarnessData() });
    expect(payload.schema_version).toBe(AGENT_PAYLOAD_SCHEMA_VERSION);
    expect(payload._privacy.scrubbed).toContain("identity");
    expect(payload._privacy.policy_version).toBe("1");
    expect(payload.consumer_guidance).toMatch(/DATA, not instructions/);
    // Never re-assert author identity in the payload body.
    expect(payload).not.toHaveProperty("author");
  });

  it("strips hero images from the profile but keeps readme", () => {
    const payload = buildAgentPayload({ harnessData: bareHarnessData() });
    const profile = payload.profile as {
      skillInventory: Array<Record<string, unknown>>;
    };
    expect(profile.skillInventory[0].hero_base64).toBeNull();
    expect(profile.skillInventory[0].readme_markdown).toBe(
      "# How to use\nDo the thing.",
    );
  });

  it("removes hidden skills before shipping to agents", () => {
    const payload = buildAgentPayload({
      harnessData: bareHarnessData(),
      hiddenHarnessSections: ["skillInventory.no-showcase"],
    });
    const profile = payload.profile as {
      skillInventory: Array<{ name: string }>;
    };
    const names = profile.skillInventory.map((s) => s.name);
    expect(names).toContain("frontend-design");
    expect(names).not.toContain("no-showcase");
  });

  it("renders generated_at from a Date and tolerates null", () => {
    const d = new Date("2026-05-01T12:00:00.000Z");
    expect(
      buildAgentPayload({ harnessData: bareHarnessData() }, { generatedAt: d })
        .generated_at,
    ).toBe("2026-05-01T12:00:00.000Z");
    expect(
      buildAgentPayload({ harnessData: bareHarnessData() }).generated_at,
    ).toBeNull();
  });

  it("derives source_extract_version from bare and enveloped data", () => {
    expect(
      buildAgentPayload({ harnessData: bareHarnessData() })
        .source_extract_version,
    ).toBe("2.7.0");

    const enveloped = buildAgentPayload({
      harnessData: {
        primaryTool: "claude-code",
        tools: { "claude-code": bareHarnessData({ skillVersion: "3.0.0" }) },
      },
    });
    expect(enveloped.source_extract_version).toBe("3.0.0");
  });
});
