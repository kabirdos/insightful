import { describe, it, expect } from "vitest";
import { parseChartData, normalizeChartData } from "../chart-parser";

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
});
