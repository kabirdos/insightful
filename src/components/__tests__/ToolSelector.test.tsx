import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import ToolSelector from "@/components/ToolSelector";

describe("ToolSelector", () => {
  it("renders nothing for single-tool reports", () => {
    const html = renderToStaticMarkup(
      <ToolSelector
        tools={["claude-code"]}
        active="claude-code"
        onChange={() => undefined}
      />,
    );
    expect(html).toBe("");
  });

  it("renders separate Claude Code and Codex choices", () => {
    const html = renderToStaticMarkup(
      <ToolSelector
        tools={["claude-code", "codex"]}
        active="codex"
        onChange={() => undefined}
      />,
    );

    expect(html).toContain("Claude Code");
    expect(html).toContain("Codex");
    expect(html).toContain('aria-selected="true"');
    expect(html).toContain("Local CLI profile");
  });
});
