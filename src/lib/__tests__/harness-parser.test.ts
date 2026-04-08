import { describe, it, expect } from "vitest";
import { isHarnessReport, parseHarnessHtml } from "../harness-parser";

// ---------------------------------------------------------------------------
// Minimal HTML fixtures that mirror the real harness report structure
// ---------------------------------------------------------------------------

const MINIMAL_HARNESS_HTML = `
<html><body>
  <div class="container">
    <!-- Stats Grid -->
    <div class="stats-grid">
      <div class="stat">
        <div class="stat-value">42</div>
        <div class="stat-label">Sessions</div>
      </div>
      <div class="stat">
        <div class="stat-value">1.2M</div>
        <div class="stat-label">Tokens</div>
      </div>
      <div class="stat">
        <div class="stat-value">18h</div>
        <div class="stat-label">Duration</div>
      </div>
      <div class="stat">
        <div class="stat-value">5</div>
        <div class="stat-label">Skills Used</div>
      </div>
      <div class="stat">
        <div class="stat-value">3</div>
        <div class="stat-label">Hooks</div>
      </div>
      <div class="stat">
        <div class="stat-value">7</div>
        <div class="stat-label">PRs</div>
      </div>
      <div class="stat">
        <div class="stat-value">23</div>
        <div class="stat-label">Commits</div>
      </div>
    </div>

    <!-- Autonomy Box -->
    <div class="autonomy-box">
      <div class="autonomy-label">Fire-and-Forget</div>
      <div class="autonomy-desc">You launch tasks and let Claude run</div>
      <div class="autonomy-stat"><strong>150</strong> user msgs</div>
      <div class="autonomy-stat"><strong>800</strong> assistant msgs</div>
      <div class="autonomy-stat"><strong>950</strong> turns measured</div>
    </div>

    <!-- Feature Pills -->
    <div class="pills">
      <span class="pill on">Task Agents (12%)</span>
      <span class="pill">MCP Servers</span>
      <span class="pill on">Custom Skills (45%)</span>
    </div>

    <!-- Tool Usage -->
    <section>
      <div class="section-header"><h2>Tool Usage</h2></div>
      <div class="bar-row">
        <div class="bar-label">Read</div>
        <div class="bar-value">1,500</div>
      </div>
      <div class="bar-row">
        <div class="bar-label">Edit</div>
        <div class="bar-value">800</div>
      </div>
      <div class="bar-row">
        <div class="bar-label">Bash</div>
        <div class="bar-value">2,200</div>
      </div>
    </section>

    <!-- Skills Inventory -->
    <section>
      <div class="section-header"><h2>Skills</h2></div>
      <table>
        <tbody>
          <tr>
            <td>
              <span class="mono accent">commit</span>
              <span class="badge custom">custom</span>
              <span class="meta">Auto-commit helper</span>
            </td>
            <td>12</td>
          </tr>
          <tr>
            <td>
              <span class="mono accent">review-pr</span>
              <span class="badge plugin">plugin</span>
              <span class="meta">PR reviewer</span>
            </td>
            <td>5</td>
          </tr>
        </tbody>
      </table>
    </section>

    <!-- Hooks -->
    <section>
      <div class="section-header"><h2>Hooks</h2></div>
      <table>
        <tbody>
          <tr>
            <td>PreToolUse</td>
            <td>Bash</td>
            <td>validate-bash.sh</td>
          </tr>
          <tr>
            <td>PostToolUse</td>
            <td>Edit</td>
            <td>format-on-save.sh</td>
          </tr>
        </tbody>
      </table>
    </section>

    <!-- Plugins -->
    <div class="plugin-card">
      <div class="plugin-name">superpowers</div>
      <span class="badge active">active</span>
      <div class="meta">v2.1.0 · compound-engineering</div>
    </div>

    <!-- File Operation Style -->
    <section>
      <div class="section-header"><h2>File Operation Style</h2></div>
      <div class="donut-item">
        <div class="ratio">45:40:15</div>
        <div class="label">Read : Edit : Write</div>
      </div>
      <div class="donut-item">
        <div class="ratio">120:80</div>
        <div class="label">Grep : Glob</div>
      </div>
      <div class="donut-item">
        <div class="ratio">Surgical Editor</div>
        <div class="label">Style</div>
      </div>
    </section>

    <!-- Git Patterns -->
    <section>
      <div class="section-header"><h2>Git Patterns</h2></div>
      <div class="meta">7 PRs · 23 commits · 1.2K lines added</div>
      <div class="tags">
        <span class="tag">feat/ (8)</span>
        <span class="tag">fix/ (12)</span>
      </div>
    </section>

    <!-- Writeup Sections (inside tab-writeup) -->
    <div id="tab-writeup">
      <div class="writeup-section">
        <h2>Workflow Analysis</h2>
        <p>You use Claude Code heavily for refactoring.</p>
      </div>
      <div class="writeup-section">
        <h2>Tool Preferences</h2>
        <p>Strong preference for Edit over Write.</p>
      </div>
    </div>

    <!-- Integrity Hash -->
    <script type="application/json" id="insight-harness-integrity">
      {"hash": "abc123def456"}
    </script>

    <!-- Versions -->
    <section>
      <div class="section-header"><h2>Claude Code Versions</h2></div>
      <div class="tags">
        <span class="tag">1.0.33</span>
        <span class="tag">1.0.34</span>
      </div>
    </section>
  </div>
</body></html>
`;

// ---------------------------------------------------------------------------
// isHarnessReport
// ---------------------------------------------------------------------------

describe("isHarnessReport", () => {
  it("detects harness report by integrity script tag", () => {
    expect(isHarnessReport(MINIMAL_HARNESS_HTML)).toBe(true);
  });

  it("returns false for plain insights HTML", () => {
    const insightsHtml =
      '<html><body><div class="subtitle">100 messages across 10 sessions</div></body></html>';
    expect(isHarnessReport(insightsHtml)).toBe(false);
  });

  it("returns false for empty/minimal HTML", () => {
    expect(isHarnessReport("")).toBe(false);
    expect(isHarnessReport("<html><body></body></html>")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// parseHarnessHtml — stats
// ---------------------------------------------------------------------------

describe("parseHarnessHtml", () => {
  it("parses without throwing", () => {
    expect(() => parseHarnessHtml(MINIMAL_HARNESS_HTML)).not.toThrow();
  });

  describe("stats", () => {
    it("extracts sessionCount", () => {
      const result = parseHarnessHtml(MINIMAL_HARNESS_HTML);
      expect(result.stats.sessionCount).toBe(42);
    });

    it("extracts totalTokens with M suffix", () => {
      const result = parseHarnessHtml(MINIMAL_HARNESS_HTML);
      expect(result.stats.totalTokens).toBe(1_200_000);
    });

    it("extracts durationHours", () => {
      const result = parseHarnessHtml(MINIMAL_HARNESS_HTML);
      expect(result.stats.durationHours).toBe(18);
    });

    it("extracts skillsUsedCount", () => {
      const result = parseHarnessHtml(MINIMAL_HARNESS_HTML);
      expect(result.stats.skillsUsedCount).toBe(5);
    });

    it("extracts hooksCount", () => {
      const result = parseHarnessHtml(MINIMAL_HARNESS_HTML);
      expect(result.stats.hooksCount).toBe(3);
    });

    it("extracts prCount", () => {
      const result = parseHarnessHtml(MINIMAL_HARNESS_HTML);
      expect(result.stats.prCount).toBe(7);
    });

    it("extracts commitCount", () => {
      const result = parseHarnessHtml(MINIMAL_HARNESS_HTML);
      expect(result.stats.commitCount).toBe(23);
    });
  });

  // ---------------------------------------------------------------------------
  // Autonomy
  // ---------------------------------------------------------------------------

  describe("autonomy", () => {
    it("extracts autonomy label", () => {
      const result = parseHarnessHtml(MINIMAL_HARNESS_HTML);
      expect(result.autonomy.label).toBe("Fire-and-Forget");
    });

    it("extracts autonomy description", () => {
      const result = parseHarnessHtml(MINIMAL_HARNESS_HTML);
      expect(result.autonomy.description).toBe(
        "You launch tasks and let Claude run",
      );
    });

    it("extracts user message count", () => {
      const result = parseHarnessHtml(MINIMAL_HARNESS_HTML);
      expect(result.autonomy.userMessages).toBe(150);
    });

    it("extracts assistant message count", () => {
      const result = parseHarnessHtml(MINIMAL_HARNESS_HTML);
      expect(result.autonomy.assistantMessages).toBe(800);
    });

    it("extracts turn count", () => {
      const result = parseHarnessHtml(MINIMAL_HARNESS_HTML);
      expect(result.autonomy.turnCount).toBe(950);
    });
  });

  // ---------------------------------------------------------------------------
  // Feature Pills
  // ---------------------------------------------------------------------------

  describe("feature pills", () => {
    it("extracts pill names and active state", () => {
      const result = parseHarnessHtml(MINIMAL_HARNESS_HTML);
      expect(result.featurePills).toHaveLength(3);

      expect(result.featurePills[0]).toEqual({
        name: "Task Agents",
        active: true,
        value: "12%",
      });
      expect(result.featurePills[1]).toEqual({
        name: "MCP Servers",
        active: false,
        value: "",
      });
      expect(result.featurePills[2]).toEqual({
        name: "Custom Skills",
        active: true,
        value: "45%",
      });
    });
  });

  // ---------------------------------------------------------------------------
  // Tool Usage
  // ---------------------------------------------------------------------------

  describe("tool usage", () => {
    it("extracts tool usage as record", () => {
      const result = parseHarnessHtml(MINIMAL_HARNESS_HTML);
      expect(result.toolUsage).toEqual({
        Read: 1500,
        Edit: 800,
        Bash: 2200,
      });
    });
  });

  // ---------------------------------------------------------------------------
  // Skill Inventory
  // ---------------------------------------------------------------------------

  describe("skill inventory", () => {
    it("extracts skill entries with source badges", () => {
      const result = parseHarnessHtml(MINIMAL_HARNESS_HTML);
      expect(result.skillInventory).toHaveLength(2);

      expect(result.skillInventory[0]).toEqual({
        name: "commit",
        calls: 12,
        source: "custom",
        description: "Auto-commit helper",
      });
      expect(result.skillInventory[1]).toEqual({
        name: "review-pr",
        calls: 5,
        source: "plugin",
        description: "PR reviewer",
      });
    });
  });

  // ---------------------------------------------------------------------------
  // Hook Definitions
  // ---------------------------------------------------------------------------

  describe("hook definitions", () => {
    it("extracts hook event, matcher, and script", () => {
      const result = parseHarnessHtml(MINIMAL_HARNESS_HTML);
      expect(result.hookDefinitions).toHaveLength(2);

      expect(result.hookDefinitions[0]).toEqual({
        event: "PreToolUse",
        matcher: "Bash",
        script: "validate-bash.sh",
      });
      expect(result.hookDefinitions[1]).toEqual({
        event: "PostToolUse",
        matcher: "Edit",
        script: "format-on-save.sh",
      });
    });
  });

  // ---------------------------------------------------------------------------
  // Plugins
  // ---------------------------------------------------------------------------

  describe("plugins", () => {
    it("extracts plugin name, version, and active state", () => {
      const result = parseHarnessHtml(MINIMAL_HARNESS_HTML);
      expect(result.plugins).toHaveLength(1);
      expect(result.plugins[0].name).toBe("superpowers");
      expect(result.plugins[0].active).toBe(true);
      expect(result.plugins[0].version).toBe("2.1.0");
      expect(result.plugins[0].marketplace).toBe("compound-engineering");
    });
  });

  // ---------------------------------------------------------------------------
  // File Operation Style
  // ---------------------------------------------------------------------------

  describe("file operation style", () => {
    it("extracts read/edit/write percentages", () => {
      const result = parseHarnessHtml(MINIMAL_HARNESS_HTML);
      expect(result.fileOpStyle.readPct).toBe(45);
      expect(result.fileOpStyle.editPct).toBe(40);
      expect(result.fileOpStyle.writePct).toBe(15);
    });

    it("extracts grep/glob counts", () => {
      const result = parseHarnessHtml(MINIMAL_HARNESS_HTML);
      expect(result.fileOpStyle.grepCount).toBe(120);
      expect(result.fileOpStyle.globCount).toBe(80);
    });

    it("extracts style label", () => {
      const result = parseHarnessHtml(MINIMAL_HARNESS_HTML);
      expect(result.fileOpStyle.style).toBe("Surgical Editor");
    });
  });

  // ---------------------------------------------------------------------------
  // Git Patterns
  // ---------------------------------------------------------------------------

  describe("git patterns", () => {
    it("extracts PR and commit counts from meta", () => {
      const result = parseHarnessHtml(MINIMAL_HARNESS_HTML);
      expect(result.gitPatterns.prCount).toBe(7);
      expect(result.gitPatterns.commitCount).toBe(23);
    });

    it("extracts lines added", () => {
      const result = parseHarnessHtml(MINIMAL_HARNESS_HTML);
      expect(result.gitPatterns.linesAdded).toBe("1.2K");
    });

    it("extracts branch prefixes", () => {
      const result = parseHarnessHtml(MINIMAL_HARNESS_HTML);
      expect(result.gitPatterns.branchPrefixes).toEqual({
        "feat/": 8,
        "fix/": 12,
      });
    });
  });

  // ---------------------------------------------------------------------------
  // Writeup Sections
  // ---------------------------------------------------------------------------

  describe("writeup sections", () => {
    it("extracts writeup section titles and content", () => {
      const result = parseHarnessHtml(MINIMAL_HARNESS_HTML);
      expect(result.writeupSections).toHaveLength(2);
      expect(result.writeupSections[0].title).toBe("Workflow Analysis");
      expect(result.writeupSections[0].contentHtml).toContain(
        "use Claude Code heavily",
      );
      expect(result.writeupSections[1].title).toBe("Tool Preferences");
    });
  });

  // ---------------------------------------------------------------------------
  // Integrity Hash
  // ---------------------------------------------------------------------------

  describe("integrity hash", () => {
    it("extracts hash from integrity script tag", () => {
      const result = parseHarnessHtml(MINIMAL_HARNESS_HTML);
      expect(result.integrityHash).toBe("abc123def456");
    });
  });

  // ---------------------------------------------------------------------------
  // Versions
  // ---------------------------------------------------------------------------

  describe("versions", () => {
    it("extracts version tags", () => {
      const result = parseHarnessHtml(MINIMAL_HARNESS_HTML);
      expect(result.versions).toEqual(["1.0.33", "1.0.34"]);
    });
  });

  // ---------------------------------------------------------------------------
  // Graceful degradation
  // ---------------------------------------------------------------------------

  describe("graceful degradation", () => {
    it("handles minimal HTML without crashing", () => {
      const minimal = "<html><body><div class='container'></div></body></html>";
      const result = parseHarnessHtml(minimal);
      expect(result.stats.totalTokens).toBe(0);
      expect(result.stats.sessionCount).toBe(0);
      expect(result.autonomy.label).toBe("");
      expect(result.featurePills).toEqual([]);
      expect(result.skillInventory).toEqual([]);
      expect(result.hookDefinitions).toEqual([]);
      expect(result.plugins).toEqual([]);
      expect(result.writeupSections).toEqual([]);
      expect(result.integrityHash).toBe("");
      expect(result.versions).toEqual([]);
    });

    it("handles empty string", () => {
      const result = parseHarnessHtml("");
      expect(result.stats.totalTokens).toBe(0);
      expect(result.featurePills).toEqual([]);
    });
  });
});
