import { describe, it, expect } from "vitest";
import {
  parseChartData,
  normalizeChartData,
  parseRawHourCounts,
  parseMultiClauding,
} from "../chart-parser";

const SAMPLE_HTML = `
<html><body>
  <div class="chart-card">
    <div class="chart-title">What You Wanted</div>
    <div class="bar-row">
      <div class="bar-label">Bug Fix</div>
      <div class="bar-track"><div class="bar-fill"></div></div>
      <div class="bar-value">27</div>
    </div>
    <div class="bar-row">
      <div class="bar-label">Code Review</div>
      <div class="bar-track"><div class="bar-fill"></div></div>
      <div class="bar-value">16</div>
    </div>
  </div>
  <div class="chart-card">
    <div class="chart-title">Top Tools Used</div>
    <div class="bar-row">
      <div class="bar-label">Bash</div>
      <div class="bar-track"><div class="bar-fill"></div></div>
      <div class="bar-value">2922</div>
    </div>
    <div class="bar-row">
      <div class="bar-label">Read</div>
      <div class="bar-track"><div class="bar-fill"></div></div>
      <div class="bar-value">1318</div>
    </div>
  </div>
  <div class="chart-card">
    <div class="chart-title">Languages</div>
    <div class="bar-row">
      <div class="bar-label">TypeScript</div>
      <div class="bar-track"><div class="bar-fill"></div></div>
      <div class="bar-value">1345</div>
    </div>
  </div>
  <div class="chart-card">
    <div class="chart-title">Session Types</div>
    <div class="bar-row">
      <div class="bar-label">Multi Task</div>
      <div class="bar-track"><div class="bar-fill"></div></div>
      <div class="bar-value">40</div>
    </div>
  </div>
  <div class="chart-card">
    <div class="chart-title">User Response Time Distribution</div>
    <div class="bar-row">
      <div class="bar-label">2-10s</div>
      <div class="bar-track"><div class="bar-fill"></div></div>
      <div class="bar-value">47</div>
    </div>
    <div class="bar-row">
      <div class="bar-label">10-30s</div>
      <div class="bar-track"><div class="bar-fill"></div></div>
      <div class="bar-value">141</div>
    </div>
  </div>
  <div class="chart-card">
    <div class="chart-title">Tool Errors Encountered</div>
    <div class="bar-row">
      <div class="bar-label">Permission Denied</div>
      <div class="bar-track"><div class="bar-fill"></div></div>
      <div class="bar-value">12</div>
    </div>
  </div>
  <div class="chart-card">
    <div class="chart-title">What Helped Most (Claude's Capabilities)</div>
    <div class="bar-row">
      <div class="bar-label">Code Generation</div>
      <div class="bar-track"><div class="bar-fill"></div></div>
      <div class="bar-value">85</div>
    </div>
  </div>
  <div class="chart-card">
    <div class="chart-title">Outcomes</div>
    <div class="bar-row">
      <div class="bar-label">Successful</div>
      <div class="bar-track"><div class="bar-fill"></div></div>
      <div class="bar-value">90</div>
    </div>
  </div>
  <div class="chart-card">
    <div class="chart-title">Primary Friction Types</div>
    <div class="bar-row">
      <div class="bar-label">Context Loss</div>
      <div class="bar-track"><div class="bar-fill"></div></div>
      <div class="bar-value">15</div>
    </div>
  </div>
  <div class="chart-card">
    <div class="chart-title">Inferred Satisfaction (model-estimated)</div>
    <div class="bar-row">
      <div class="bar-label">High</div>
      <div class="bar-track"><div class="bar-fill"></div></div>
      <div class="bar-value">70</div>
    </div>
  </div>
  <div class="chart-card">
    <div class="chart-title">User Messages by Time of Day</div>
    <div class="bar-row">
      <div class="bar-label">Morning (6-12)</div>
      <div class="bar-track"><div class="bar-fill"></div></div>
      <div class="bar-value">340</div>
    </div>
    <div class="bar-row">
      <div class="bar-label">Afternoon (12-18)</div>
      <div class="bar-track"><div class="bar-fill"></div></div>
      <div class="bar-value">774</div>
    </div>
  </div>
  <div class="chart-card">
    <div class="chart-title">Multi-Clauding (Parallel Sessions)</div>
    <div style="display: flex; gap: 24px; margin: 12px 0;">
      <div style="text-align: center;">
        <div style="font-size: 24px; font-weight: 700; color: #7c3aed;">60</div>
        <div style="font-size: 11px; color: #64748b; text-transform: uppercase;">Overlap Events</div>
      </div>
      <div style="text-align: center;">
        <div style="font-size: 24px; font-weight: 700; color: #7c3aed;">62</div>
        <div style="font-size: 11px; color: #64748b; text-transform: uppercase;">Sessions Involved</div>
      </div>
      <div style="text-align: center;">
        <div style="font-size: 24px; font-weight: 700; color: #7c3aed;">26%</div>
        <div style="font-size: 11px; color: #64748b; text-transform: uppercase;">Of Messages</div>
      </div>
    </div>
  </div>
  <script>
    const rawHourCounts = {"0":13,"7":4,"8":20,"9":10,"10":107};
  </script>
</body></html>
`;

describe("parseChartData", () => {
  it("extracts tool usage from 'Top Tools Used' chart", () => {
    const result = parseChartData(SAMPLE_HTML);
    expect(result.toolUsage).toEqual([
      { label: "Bash", value: 2922 },
      { label: "Read", value: 1318 },
    ]);
  });

  it("extracts request types from 'What You Wanted' chart", () => {
    const result = parseChartData(SAMPLE_HTML);
    expect(result.requestTypes).toEqual([
      { label: "Bug Fix", value: 27 },
      { label: "Code Review", value: 16 },
    ]);
  });

  it("extracts languages", () => {
    const result = parseChartData(SAMPLE_HTML);
    expect(result.languages).toEqual([{ label: "TypeScript", value: 1345 }]);
  });

  it("extracts session types", () => {
    const result = parseChartData(SAMPLE_HTML);
    expect(result.sessionTypes).toEqual([{ label: "Multi Task", value: 40 }]);
  });

  it("returns empty object when no charts present", () => {
    const result = parseChartData("<html><body><p>no charts</p></body></html>");
    expect(result).toEqual({});
  });

  it("handles comma-formatted numbers", () => {
    const html = `
      <div class="chart-card">
        <div class="chart-title">Top Tools Used</div>
        <div class="bar-row">
          <div class="bar-label">Bash</div>
          <div class="bar-value">2,922</div>
        </div>
      </div>
    `;
    const result = parseChartData(html);
    expect(result.toolUsage?.[0]).toEqual({ label: "Bash", value: 2922 });
  });

  it("omits keys for charts that aren't in the HTML", () => {
    const html = `
      <div class="chart-card">
        <div class="chart-title">Top Tools Used</div>
        <div class="bar-row">
          <div class="bar-label">Bash</div>
          <div class="bar-value">100</div>
        </div>
      </div>
    `;
    const result = parseChartData(html);
    expect(result.toolUsage).toBeDefined();
    expect(result.requestTypes).toBeUndefined();
    expect(result.languages).toBeUndefined();
    expect(result.sessionTypes).toBeUndefined();
  });

  it("extracts response time distribution", () => {
    const result = parseChartData(SAMPLE_HTML);
    expect(result.responseTimeDistribution).toEqual([
      { label: "2-10s", value: 47 },
      { label: "10-30s", value: 141 },
    ]);
  });

  it("extracts tool errors", () => {
    const result = parseChartData(SAMPLE_HTML);
    expect(result.toolErrors).toEqual([
      { label: "Permission Denied", value: 12 },
    ]);
  });

  it("extracts what helped most", () => {
    const result = parseChartData(SAMPLE_HTML);
    expect(result.whatHelpedMost).toEqual([
      { label: "Code Generation", value: 85 },
    ]);
  });

  it("extracts outcomes", () => {
    const result = parseChartData(SAMPLE_HTML);
    expect(result.outcomes).toEqual([{ label: "Successful", value: 90 }]);
  });

  it("extracts friction types", () => {
    const result = parseChartData(SAMPLE_HTML);
    expect(result.frictionTypes).toEqual([
      { label: "Context Loss", value: 15 },
    ]);
  });

  it("extracts satisfaction", () => {
    const result = parseChartData(SAMPLE_HTML);
    expect(result.satisfaction).toEqual([{ label: "High", value: 70 }]);
  });

  it("extracts time of day", () => {
    const result = parseChartData(SAMPLE_HTML);
    expect(result.timeOfDay).toEqual([
      { label: "Morning (6-12)", value: 340 },
      { label: "Afternoon (12-18)", value: 774 },
    ]);
  });
});

describe("normalizeChartData", () => {
  it("returns null for null", () => {
    expect(normalizeChartData(null)).toBeNull();
  });

  it("returns null for undefined", () => {
    expect(normalizeChartData(undefined)).toBeNull();
  });

  it("returns null for non-objects", () => {
    expect(normalizeChartData("string")).toBeNull();
    expect(normalizeChartData(42)).toBeNull();
    expect(normalizeChartData([])).toBeNull();
  });

  it("returns a clean ChartData for a valid object", () => {
    const input = {
      toolUsage: [
        { label: "Bash", value: 100 },
        { label: "Read", value: 50 },
      ],
    };
    expect(normalizeChartData(input)).toEqual(input);
  });

  it("filters out malformed items in a series", () => {
    const input = {
      toolUsage: [
        { label: "Bash", value: 100 },
        { label: "Missing value" },
        { value: 50 },
        "not an object",
        null,
        { label: "Read", value: 50 },
      ],
    };
    expect(normalizeChartData(input)).toEqual({
      toolUsage: [
        { label: "Bash", value: 100 },
        { label: "Read", value: 50 },
      ],
    });
  });

  it("drops a series entirely if all items are invalid", () => {
    const input = {
      toolUsage: [{ label: "x" }, { value: 1 }],
      languages: [{ label: "TypeScript", value: 1 }],
    };
    expect(normalizeChartData(input)).toEqual({
      languages: [{ label: "TypeScript", value: 1 }],
    });
  });

  it("ignores unknown top-level keys", () => {
    const input = {
      toolUsage: [{ label: "Bash", value: 100 }],
      someFutureKey: [{ label: "x", value: 1 }],
    };
    expect(normalizeChartData(input)).toEqual({
      toolUsage: [{ label: "Bash", value: 100 }],
    });
  });

  it("returns null if every series is invalid or missing", () => {
    expect(normalizeChartData({})).toBeNull();
    expect(normalizeChartData({ toolUsage: "broken" })).toBeNull();
    expect(normalizeChartData({ toolUsage: [{ bad: true }] })).toBeNull();
  });

  it("rejects non-finite numbers (NaN, Infinity)", () => {
    const input = {
      toolUsage: [
        { label: "A", value: NaN },
        { label: "B", value: Infinity },
        { label: "C", value: 42 },
      ],
    };
    expect(normalizeChartData(input)).toEqual({
      toolUsage: [{ label: "C", value: 42 }],
    });
  });

  it("normalizes new chart fields", () => {
    const input = {
      responseTimeDistribution: [{ label: "2-10s", value: 47 }],
      toolErrors: [{ label: "Permission", value: 5 }],
      whatHelpedMost: [{ label: "Code Gen", value: 80 }],
      outcomes: [{ label: "Success", value: 90 }],
      frictionTypes: [{ label: "Context", value: 10 }],
      satisfaction: [{ label: "High", value: 70 }],
      timeOfDay: [{ label: "Morning", value: 300 }],
    };
    const result = normalizeChartData(input);
    expect(result?.responseTimeDistribution).toEqual([
      { label: "2-10s", value: 47 },
    ]);
    expect(result?.toolErrors).toEqual([{ label: "Permission", value: 5 }]);
    expect(result?.whatHelpedMost).toEqual([{ label: "Code Gen", value: 80 }]);
    expect(result?.outcomes).toEqual([{ label: "Success", value: 90 }]);
    expect(result?.frictionTypes).toEqual([{ label: "Context", value: 10 }]);
    expect(result?.satisfaction).toEqual([{ label: "High", value: 70 }]);
    expect(result?.timeOfDay).toEqual([{ label: "Morning", value: 300 }]);
  });
});

describe("parseRawHourCounts", () => {
  it("extracts rawHourCounts from script tag", () => {
    const result = parseRawHourCounts(SAMPLE_HTML);
    expect(result).toEqual({ "0": 13, "7": 4, "8": 20, "9": 10, "10": 107 });
  });

  it("returns undefined when no rawHourCounts present", () => {
    const result = parseRawHourCounts("<html><body></body></html>");
    expect(result).toBeUndefined();
  });

  it("returns undefined for malformed JSON", () => {
    const html = "<script>const rawHourCounts = {bad json};</script>";
    const result = parseRawHourCounts(html);
    expect(result).toBeUndefined();
  });
});

describe("parseMultiClauding", () => {
  it("extracts multi-clauding stats", () => {
    const result = parseMultiClauding(SAMPLE_HTML);
    expect(result).toEqual({
      overlapEvents: 60,
      sessionsInvolved: 62,
      ofMessages: "26%",
    });
  });

  it("returns undefined when no multi-clauding section", () => {
    const result = parseMultiClauding("<html><body></body></html>");
    expect(result).toBeUndefined();
  });
});
