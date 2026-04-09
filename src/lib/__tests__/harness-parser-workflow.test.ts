import { describe, it, expect } from "vitest";
import { parseHarnessHtml } from "@/lib/harness-parser";

const MOCK_HTML = `
<!DOCTYPE html>
<html lang="en">
<head><title>Test</title></head>
<body>
<div class="stats-grid">
  <div class="stat"><div class="stat-value">10</div><div class="stat-label">Sessions</div></div>
  <div class="stat"><div class="stat-value">1.2M</div><div class="stat-label">Tokens</div></div>
  <div class="stat"><div class="stat-value">24h</div><div class="stat-label">Duration</div></div>
  <div class="stat"><div class="stat-value">45m</div><div class="stat-label">Avg Session</div></div>
  <div class="stat"><div class="stat-value">3</div><div class="stat-label">Skills Used</div></div>
  <div class="stat"><div class="stat-value">2</div><div class="stat-label">Hooks</div></div>
  <div class="stat"><div class="stat-value">0</div><div class="stat-label">PRs</div></div>
  <div class="stat"><div class="stat-value">5</div><div class="stat-label">Commits</div></div>
</div>
<div class="autonomy-box">
  <div class="autonomy-label">Directive</div>
  <div class="autonomy-desc">test</div>
  <div class="autonomy-stats">
    <div class="autonomy-stat"><strong>50</strong> user msgs</div>
    <div class="autonomy-stat"><strong>200</strong> assistant msgs</div>
    <div class="autonomy-stat"><strong>100</strong> turns measured</div>
    <div class="autonomy-stat"><strong>2%</strong> error rate</div>
  </div>
</div>
<div class="pills"></div>

<section>
  <div class="section-header"><h2>Workflow Phases</h2><span class="count">8 sessions analyzed</span></div>
  <div class="two-col">
    <div>
      <h3>Phase Distribution</h3>
      <div class="kv-row"><span class="mono">exploration</span><span class="meta">40%</span></div>
      <div class="kv-row"><span class="mono">implementation</span><span class="meta">35%</span></div>
      <div class="kv-row"><span class="mono">testing</span><span class="meta">15%</span></div>
      <div class="kv-row"><span class="mono">shipping</span><span class="meta">10%</span></div>
    </div>
    <div>
      <h3>Phase Transitions</h3>
      <div class="bar-row"><div class="bar-label">exploration->implementation</div><div class="bar-track"><div class="bar-fill"></div></div><div class="bar-value">23</div></div>
      <div class="bar-row"><div class="bar-label">implementation->testing</div><div class="bar-track"><div class="bar-fill"></div></div><div class="bar-value">15</div></div>
      <div class="bar-row"><div class="bar-label">testing->shipping</div><div class="bar-track"><div class="bar-fill"></div></div><div class="bar-value">8</div></div>
    </div>
  </div>
  <div style="display:flex;gap:1.5rem">
    <div class="meta"><strong>75%</strong> explore before implementing</div>
    <div class="meta"><strong>60%</strong> test before shipping</div>
  </div>
</section>

<section>
  <div class="section-header"><h2>Skill Workflow</h2></div>
  <div class="footnote">Skill invocations</div>
  <div class="bar-row"><div class="bar-label">ce-brainstorm</div><div class="bar-track"><div class="bar-fill"></div></div><div class="bar-value">8</div></div>
  <div class="bar-row"><div class="bar-label">ce-work</div><div class="bar-track"><div class="bar-fill"></div></div><div class="bar-value">12</div></div>
  <div class="bar-row"><div class="bar-label">git-commit-push-pr</div><div class="bar-track"><div class="bar-fill"></div></div><div class="bar-value">4</div></div>
  <div class="footnote">Agent dispatches</div>
  <div class="bar-row"><div class="bar-label">Run tests for auth module</div><div class="bar-track"><div class="bar-fill"></div></div><div class="bar-value">3</div></div>
  <div class="bar-row"><div class="bar-label">Lint and format changed files</div><div class="bar-track"><div class="bar-fill"></div></div><div class="bar-value">2</div></div>
  <div class="footnote">Common workflow patterns</div>
  <div class="bar-row"><div class="bar-label">ce-brainstorm &rarr; ce-work &rarr; git-commit-push-pr</div><div class="bar-track"><div class="bar-fill"></div></div><div class="bar-value">5</div></div>
  <div class="bar-row"><div class="bar-label">ce-work &rarr; git-commit-push-pr</div><div class="bar-track"><div class="bar-fill"></div></div><div class="bar-value">3</div></div>
</section>

<script type="application/json" id="insight-harness-integrity">{"hash":"test123"}</script>
</body>
</html>
`;

describe("harness-parser workflow data", () => {
  it("parses workflow phases section", () => {
    const result = parseHarnessHtml(MOCK_HTML);
    expect(result.workflowData).not.toBeNull();
    expect(result.workflowData!.phaseDistribution).toEqual({
      exploration: 40,
      implementation: 35,
      testing: 15,
      shipping: 10,
    });
  });

  it("parses phase transitions", () => {
    const result = parseHarnessHtml(MOCK_HTML);
    expect(result.workflowData!.phaseTransitions).toEqual({
      "exploration->implementation": 23,
      "implementation->testing": 15,
      "testing->shipping": 8,
    });
  });

  it("parses skill invocations", () => {
    const result = parseHarnessHtml(MOCK_HTML);
    expect(result.workflowData!.skillInvocations).toEqual({
      "ce-brainstorm": 8,
      "ce-work": 12,
      "git-commit-push-pr": 4,
    });
  });

  it("parses agent dispatches", () => {
    const result = parseHarnessHtml(MOCK_HTML);
    expect(result.workflowData!.agentDispatches).toEqual({
      "Run tests for auth module": 3,
      "Lint and format changed files": 2,
    });
  });

  it("parses workflow patterns", () => {
    const result = parseHarnessHtml(MOCK_HTML);
    expect(result.workflowData!.workflowPatterns).toEqual([
      {
        sequence: ["ce-brainstorm", "ce-work", "git-commit-push-pr"],
        count: 5,
      },
      { sequence: ["ce-work", "git-commit-push-pr"], count: 3 },
    ]);
  });

  it("parses phase stats", () => {
    const result = parseHarnessHtml(MOCK_HTML);
    expect(result.workflowData!.phaseStats.exploreBeforeImplPct).toBe(75);
    expect(result.workflowData!.phaseStats.testBeforeShipPct).toBe(60);
    expect(result.workflowData!.phaseStats.totalSessionsWithPhases).toBe(8);
  });

  it("returns null workflowData when sections are missing", () => {
    const minimalHtml = `
      <!DOCTYPE html><html><body>
      <div class="stats-grid">
        <div class="stat"><div class="stat-value">1</div><div class="stat-label">Sessions</div></div>
        <div class="stat"><div class="stat-value">0</div><div class="stat-label">Tokens</div></div>
        <div class="stat"><div class="stat-value">0</div><div class="stat-label">Duration</div></div>
        <div class="stat"><div class="stat-value">0</div><div class="stat-label">Avg Session</div></div>
        <div class="stat"><div class="stat-value">0</div><div class="stat-label">Skills Used</div></div>
        <div class="stat"><div class="stat-value">0</div><div class="stat-label">Hooks</div></div>
        <div class="stat"><div class="stat-value">0</div><div class="stat-label">PRs</div></div>
        <div class="stat"><div class="stat-value">0</div><div class="stat-label">Commits</div></div>
      </div>
      <div class="autonomy-box">
        <div class="autonomy-label">Test</div>
        <div class="autonomy-desc">test</div>
      </div>
      <div class="pills"></div>
      <script type="application/json" id="insight-harness-integrity">{"hash":"x"}</script>
      </body></html>
    `;
    const result = parseHarnessHtml(minimalHtml);
    expect(result.workflowData).toBeNull();
  });
});
