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
                securityLevel: "strict",
                flowchart: { useMaxWidth: true },
              });
            })();
          }
          await initPromise;
        }
        if (mountedRef.current) setReady(true);
      } catch {
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
