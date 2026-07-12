import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import SelfDeclaredStack from "@/components/SelfDeclaredStack";
import type { SelfDeclared } from "@/types/insights";

function render(selfDeclared: SelfDeclared | null | undefined): string {
  return renderToStaticMarkup(
    <SelfDeclaredStack selfDeclared={selfDeclared} />,
  );
}

describe("SelfDeclaredStack", () => {
  it("renders nothing when absent (null / undefined — pre-2.13 report)", () => {
    expect(render(null)).toBe("");
    expect(render(undefined)).toBe("");
  });

  it("renders nothing when fields are present but empty", () => {
    expect(render({ fields: {}, declaredAt: "2026-07-01T00:00:00Z" })).toBe("");
  });

  it("renders declared rows with their friendly labels", () => {
    const html = render({
      fields: {
        voice: "Wispr Flow",
        editor: "Neovim",
        terminal: "Ghostty",
        mic: "Shure MV7",
        remote: "Tailscale",
      },
      declaredAt: "2026-07-01T00:00:00Z",
    });
    expect(html).toContain("My Stack");
    expect(html).toContain("Voice");
    expect(html).toContain("Wispr Flow");
    expect(html).toContain("Editor");
    expect(html).toContain("Neovim");
    expect(html).toContain("Terminal");
    expect(html).toContain("Mic");
    expect(html).toContain("Remote");
  });

  it("always labels the card self-declared / not verified", () => {
    const html = render({
      fields: { editor: "Zed" },
      declaredAt: "",
    });
    expect(html).toContain("Self-declared");
    expect(html).toContain("not verified by the harness");
  });

  it("renders the identity line as a quote and omits it from the rows", () => {
    const html = render({
      fields: { identity: "Weekend hacker shipping tiny tools" },
      declaredAt: "",
    });
    expect(html).toContain("Weekend hacker shipping tiny tools");
  });

  it("escapes untrusted values as text (no HTML injection)", () => {
    const html = render({
      fields: { editor: "<img src=x onerror=alert(1)>" },
      declaredAt: "",
    });
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;img");
  });

  it("omits the declared date when the timestamp is empty or invalid", () => {
    expect(render({ fields: { editor: "Zed" }, declaredAt: "" })).not.toContain(
      "Declared",
    );
    expect(
      render({ fields: { editor: "Zed" }, declaredAt: "not-a-date" }),
    ).not.toContain("Declared");
  });
});
