import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SkillReadme, _internal } from "@/components/SkillReadme";

const { safeUrlTransform } = _internal;

function render(markdown: string): string {
  return renderToStaticMarkup(<SkillReadme markdown={markdown} />);
}

// ── safeUrlTransform unit tests ───────────────────────────────────────────

describe("safeUrlTransform", () => {
  it.each([
    ["fragment", "#heading"],
    ["mailto", "mailto:x@y.com"],
    ["https", "https://example.com"],
    ["http", "http://example.com"],
  ])("allows %s URLs", (_label, url) => {
    expect(safeUrlTransform(url)).toBe(url);
  });

  it.each([
    ["javascript:", "javascript:alert(1)"],
    ["mixed-case JaVaScRiPt:", "JaVaScRiPt:alert(1)"],
    ["vbscript:", "vbscript:msgbox(1)"],
    ["data:text/html", "data:text/html,<script>alert(1)</script>"],
    ["file://", "file:///etc/passwd"],
    ["data:image/svg+xml", "data:image/svg+xml;base64,PHN2Zz4="],
    ["data:image/gif", "data:image/gif;base64,R0lGODlhAQABAAAAACw="],
    ["empty", ""],
  ])("strips %s URLs", (_label, url) => {
    expect(safeUrlTransform(url)).toBe("");
  });

  it("allows valid PNG data URI", () => {
    const png =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwADhgGAWjR9awAAAABJRU5ErkJggg==";
    expect(safeUrlTransform(png)).toBe(png);
  });

  it("strips malformed PNG data URI (contains !)", () => {
    expect(safeUrlTransform("data:image/png;base64,iVBOR!w0KGgo=")).toBe("");
  });
});

// ── Rendering tests ───────────────────────────────────────────────────────

describe("SkillReadme rendering", () => {
  it("renders headings and paragraphs", () => {
    const html = render("# Hello\n\nWorld");
    expect(html).toContain("<h1>Hello</h1>");
    expect(html).toContain("<p>World</p>");
  });

  it("renders fenced code blocks", () => {
    const html = render("```\nconsole.log('x');\n```");
    expect(html).toContain("<pre>");
    expect(html).toContain("console.log");
  });

  it("renders GFM tables", () => {
    const html = render("| a | b |\n|---|---|\n| 1 | 2 |");
    expect(html).toContain("<table>");
    expect(html).toContain("<td>1</td>");
  });

  it("strips raw <script> tags from markdown", () => {
    const html = render("Hello\n\n<script>alert(1)</script>\n\nWorld");
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("alert(1)");
  });

  it("strips event handlers on inline HTML images", () => {
    const html = render('<img src="x" onerror="alert(1)">');
    expect(html).not.toContain("onerror");
    expect(html).not.toContain("alert(1)");
  });

  it("neutralizes javascript: in markdown links (renders as plain text)", () => {
    const html = render("[click](javascript:alert(1))");
    // Anchor either has no href or empty href; either way, no javascript: in output
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("alert(1)");
  });

  it("neutralizes vbscript: in markdown links", () => {
    const html = render("[x](vbscript:msgbox(1))");
    expect(html).not.toContain("vbscript:");
  });

  it("neutralizes data:text/html in markdown links", () => {
    const html = render("[x](data:text/html,<script>alert(1)</script>)");
    expect(html).not.toContain("data:text/html");
    expect(html).not.toContain("alert(1)");
  });

  it("strips http(s) image URLs from markdown", () => {
    const html = render("![pixel](https://evil.com/pixel.gif)");
    expect(html).not.toContain("evil.com");
    expect(html).not.toContain("pixel.gif");
  });

  it("strips data:image/svg+xml images from markdown", () => {
    const html = render("![x](data:image/svg+xml;base64,PHN2Zz4=)");
    expect(html).not.toContain("svg+xml");
  });

  it("strips malformed base64 image URIs from markdown", () => {
    const html = render("![x](data:image/png;base64,not-real-base64!!!)");
    // The src attribute should be missing or empty
    expect(html).not.toContain("not-real-base64");
  });

  it("renders valid PNG data URI image from markdown", () => {
    const png =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwADhgGAWjR9awAAAABJRU5ErkJggg==";
    const html = render(`![hero](${png})`);
    expect(html).toContain("<img");
    expect(html).toContain(png);
  });

  it("opens external links in new tab with rel=noopener noreferrer", () => {
    const html = render("[ex](https://example.com)");
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain('href="https://example.com"');
  });

  it("renders fragment links without target attr", () => {
    const html = render("[toc](#heading)");
    expect(html).toContain('href="#heading"');
  });

  it("renders mailto links", () => {
    const html = render("[email](mailto:x@y.com)");
    expect(html).toContain('href="mailto:x@y.com"');
  });

  it("renders empty markdown without crashing", () => {
    expect(() => render("")).not.toThrow();
  });
});
