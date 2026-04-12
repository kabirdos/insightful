"use client";

import EyeToggle from "./EyeToggle";

/**
 * Per-item visibility wrapper for use inside report edit page sections.
 * Renders an inline EyeToggle and dims the child when hidden.
 * Unlike HideableCard (which wraps whole sections and hides children
 * entirely), HideableItem keeps children visible but dimmed so the
 * owner can see what they're hiding.
 */
export default function HideableItem({
  hidden,
  onToggle,
  children,
}: {
  hidden: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className={`group relative ${hidden ? "opacity-50" : ""}`}>
      <div className="absolute -left-1 -top-1 z-10 opacity-0 transition-opacity group-hover:opacity-100">
        <EyeToggle
          enabled={!hidden}
          onToggle={onToggle}
          showLabel="Show this item"
          hideLabel="Hide this item"
        />
      </div>
      {children}
    </div>
  );
}
