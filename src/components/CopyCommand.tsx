"use client";

import { useState } from "react";
import { Copy, ClipboardCheck } from "lucide-react";
import clsx from "clsx";

/**
 * Terminal-styled command box with a copy button — the "paste this into
 * Claude Code" affordance reused by the group page's "Learn from this
 * group" block and anywhere else a single copyable command belongs.
 *
 * Mirrors the inline CommandBlock/CopyButton pattern in
 * src/app/upload/page.tsx (dark slate box, `>` prompt, green "Copied"
 * confirmation) but lives in src/components so multiple routes share one
 * implementation instead of re-inlining it.
 */
export default function CopyCommand({
  command,
  label = "Copy",
  className,
}: {
  command: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  const doCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    await navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={clsx(
        "flex items-center gap-2 rounded-lg bg-slate-800 px-3.5 py-2.5 font-mono text-xs dark:bg-slate-900",
        className,
      )}
    >
      <span className="text-slate-500">&gt; </span>
      <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap text-slate-200">
        {command}
      </code>
      <button
        type="button"
        onClick={doCopy}
        className={clsx(
          "shrink-0 rounded-md px-2.5 py-1 text-xs font-semibold transition-colors",
          copied
            ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400"
            : "border border-white/20 bg-white/15 text-slate-200 hover:bg-white/30 dark:text-slate-300",
        )}
      >
        {copied ? (
          <span className="flex items-center gap-1">
            <ClipboardCheck className="h-3 w-3" /> Copied
          </span>
        ) : (
          <span className="flex items-center gap-1">
            <Copy className="h-3 w-3" /> {label}
          </span>
        )}
      </button>
    </div>
  );
}
