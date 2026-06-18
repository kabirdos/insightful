"use client";

import { useState, useCallback, type MouseEvent } from "react";
import Link from "next/link";
import { Bot, Check, Copy } from "lucide-react";
import clsx from "clsx";

export interface LearnFromThisProps {
  /** Absolute, canonical public URL of the profile or group to learn from. */
  url: string;
  /**
   * Tunes the copy for what's being learned from. "profile" (default) is a
   * single person's harness; "group" is a collection at `/g/<slug>`.
   */
  variant?: "profile" | "group";
  /** Extra classes appended to the outer callout. */
  className?: string;
}

/**
 * Builds the ready-to-paste agent prompt. The leading phrase matches the
 * insight-harness skill's documented learn-mode triggers ("learn from this
 * harness"), and the trailing URL is what `learn.py` resolves — so pasting
 * this into Claude Code or Codex reliably switches the skill into learn mode.
 */
export function buildLearnPrompt(url: string, variant: "profile" | "group") {
  const noun =
    variant === "group" ? "group of harnesses" : "Claude Code / Codex harness";
  return `Learn from this ${noun} and tell me what to copy into mine: ${url}`;
}

/**
 * Resolves a (possibly relative) report/group path to an absolute URL.
 * Callers pass the relative path from `buildReportUrl`, but `learn.py` needs a
 * fetchable absolute URL. Already-absolute inputs pass through; without an
 * origin (SSR) the input is returned unchanged.
 */
export function toAbsoluteUrl(url: string, origin?: string): string {
  if (/^https?:\/\//.test(url)) return url;
  return origin ? origin + url : url;
}

export default function LearnFromThis({
  url,
  variant = "profile",
  className,
}: LearnFromThisProps) {
  const [copied, setCopied] = useState(false);
  const subject = variant === "group" ? "this group" : "this setup";

  const onCopy = useCallback(
    async (e: MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();
      // Resolve to an absolute URL at click time, not during render — doing it
      // here (vs. reading window during render) avoids an SSR/hydration
      // mismatch.
      const origin =
        typeof window !== "undefined" ? window.location.origin : undefined;
      await navigator.clipboard.writeText(
        buildLearnPrompt(toAbsoluteUrl(url, origin), variant),
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    },
    [url, variant],
  );

  return (
    <div
      className={clsx(
        "mb-6 flex flex-col gap-3 rounded-xl border border-violet-200 bg-gradient-to-r from-violet-50 to-blue-50 p-4 sm:flex-row sm:items-center sm:gap-4 dark:border-violet-800/60 dark:from-violet-950/30 dark:to-blue-950/30",
        className,
      )}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-300">
        <Bot className="h-5 w-5" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-semibold text-slate-900 dark:text-white">
          Learn from {subject}
        </p>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Point your coding agent (Claude Code or Codex) at {subject} and
          it&apos;ll tell you what to copy into your own harness.{" "}
          <Link
            href="/install"
            className="font-medium text-violet-700 underline-offset-2 hover:underline dark:text-violet-300"
          >
            Needs the insight-harness skill
          </Link>
          .
        </p>
      </div>
      <button
        type="button"
        onClick={onCopy}
        aria-label={`Copy the agent prompt to learn from ${subject}`}
        className="flex shrink-0 items-center justify-center gap-2 rounded-lg bg-violet-600 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-700"
      >
        {copied ? (
          <>
            <Check className="h-4 w-4" />
            Copied!
          </>
        ) : (
          <>
            <Copy className="h-4 w-4" />
            Copy agent prompt
          </>
        )}
      </button>
    </div>
  );
}
