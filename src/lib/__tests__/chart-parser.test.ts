import { describe, it, expect } from "vitest";
import { parseChartData } from "../chart-parser";

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
