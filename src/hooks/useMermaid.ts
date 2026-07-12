"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface UseMermaidOptions {
  /** Skip loading until data is available. Default: true. */
  shouldLoad?: boolean;
}

interface UseMermaidReturn {
  /** Whether mermaid is loaded, initialized, and ready to render */
  ready: boolean;
  /** Whether loading failed */
  error: boolean;
  /** Render a Mermaid definition into an SVG string */
  render: (id: string, definition: string) => Promise<string | null>;
}

let mermaidInstance: (typeof import("mermaid"))["default"] | null = null;
let initPromise: Promise<void> | null = null;

/**
 * Shared hook for loading and using Mermaid.js.
 * Loads the library once via dynamic import (no CDN, no polling).
 * Pass shouldLoad=false to defer loading until data exists.
 */
export function useMermaid(options: UseMermaidOptions = {}): UseMermaidReturn {
  const { shouldLoad = true } = options;
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!shouldLoad) return;

    async function load() {
      try {
        if (!mermaidInstance) {
          if (!initPromise) {
            initPromise = (async () => {
              const mod = await import("mermaid");
              mermaidInstance = mod.default;
              mermaidInstance.initialize({
                startOnLoad: false,
                theme: "neutral",
                // "loose" is required, not incidental: our node labels are
                // inline-styled <span>s (per-line font sizing). Under the
                // default "strict" level Mermaid encodes those tags as text
                // and DOMPurify strips the style attributes, which breaks the
                // label layout — so tightening to "strict" is not an option
                // here. INVARIANT: because "loose" skips Mermaid's sanitizer,
                // every harness-derived string interpolated into a label MUST
                // be HTML-escaped at build time. buildWorkflowDiagram() in
                // WorkflowDiagram.tsx enforces this via escapeHtml(), layered
                // on the privacy masking in src/lib/privacy-safe-workflow.ts.
                securityLevel: "loose",
                themeVariables: {
                  fontSize: "24px",
                  fontFamily:
                    'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
                  primaryColor: "#ffffff",
                  primaryBorderColor: "#cbd5e1",
                  lineColor: "#94a3b8",
                },
                flowchart: {
                  useMaxWidth: true,
                  htmlLabels: true,
                  nodeSpacing: 60,
                  rankSpacing: 80,
                  padding: 18,
                },
              });
            })();
          }
          await initPromise;
        }
        if (mountedRef.current) setReady(true);
      } catch {
        // Reset so a future mount can retry
        initPromise = null;
        if (mountedRef.current) setError(true);
      }
    }

    load();
  }, [shouldLoad]);

  const render = useCallback(
    async (id: string, definition: string): Promise<string | null> => {
      if (!mermaidInstance) return null;
      try {
        const { svg } = await mermaidInstance.render(id, definition);
        return svg;
      } catch {
        return null;
      }
    },
    [],
  );

  return { ready, error, render };
}
