"use client";

import { Eye, EyeOff } from "lucide-react";

/**
 * Small reusable visibility toggle used on the report edit page for
 * both narrative sections and (in Unit 8) per-project hide controls.
 *
 * Previously this lived inline inside src/app/insights/[slug]/edit/
 * page.tsx. Extracted to a shared component so the new project-hide
 * toggle in Unit 8 can reuse the exact same visual pattern.
 */
export default function EyeToggle({
  enabled,
  onToggle,
  showLabel,
  hideLabel,
}: {
  enabled: boolean;
  onToggle: () => void;
  /**
   * Title attribute shown when the content is currently hidden and
   * the button would re-show it. Defaults to "Show this section".
   */
  showLabel?: string;
  /**
   * Title attribute shown when the content is currently visible and
   * the button would hide it. Defaults to "Hide this section".
   */
  hideLabel?: string;
}) {
  const title = enabled
    ? (hideLabel ?? "Hide this section")
    : (showLabel ?? "Show this section");

  return (
    <button
      onClick={onToggle}
      className="rounded p-1 text-slate-400 transition-colors hover:text-slate-600 dark:hover:text-slate-300"
      title={title}
      aria-label={title}
    >
      {enabled ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
    </button>
  );
}
