"use client";

import { useState, useCallback, type MouseEvent } from "react";
import { Share2 } from "lucide-react";
import clsx from "clsx";

export interface ShareButtonProps {
  /** URL to share. Can be absolute or a path (callers should pass an absolute URL for best share UX). */
  url: string;
  /** Optional title passed to navigator.share. Ignored by the clipboard fallback. */
  title?: string;
  /** Extra classes appended to the button. Defaults preserve the detail-page styling. */
  className?: string;
}

/**
 * Shared share-action logic. Exported for unit testing — the component wraps
 * this with React state for the "Copied!" confirmation. Returns `true` if the
 * clipboard fallback ran (so the caller can flash a "Copied!" label), or
 * `false` if the native Web Share API handled it.
 */
export async function performShare({
  url,
  title,
}: {
  url: string;
  title?: string;
}): Promise<boolean> {
  if (
    typeof navigator !== "undefined" &&
    typeof navigator.share === "function"
  ) {
    try {
      await navigator.share(title ? { title, url } : { url });
      return false;
    } catch (err) {
      // User-cancelled shares throw AbortError — don't fall through to
      // clipboard in that case (they deliberately backed out).
      if (err instanceof DOMException && err.name === "AbortError") {
        return false;
      }
      // Any other failure (permissions, unsupported payload): fall through
      // to the clipboard path so sharing still works.
    }
  }
  await navigator.clipboard.writeText(url);
  return true;
}

/**
 * Factory for the button's click handler. Extracted so unit tests can
 * drive the exact logic (stopPropagation, preventDefault, copied state
 * transitions) without a React renderer/DOM.
 */
export function createShareClickHandler({
  url,
  title,
  setCopied,
  copiedDurationMs = 2000,
}: {
  url: string;
  title?: string;
  setCopied: (value: boolean) => void;
  copiedDurationMs?: number;
}) {
  return async (e: Pick<MouseEvent, "stopPropagation" | "preventDefault">) => {
    // Cards wrap this button in a <Link>, so we must stop the event from
    // bubbling up and triggering navigation. preventDefault also guards
    // against any ancestor <form> or default action.
    e.stopPropagation();
    e.preventDefault();
    const usedClipboard = await performShare({ url, title });
    if (usedClipboard) {
      setCopied(true);
      setTimeout(() => setCopied(false), copiedDurationMs);
    }
  };
}

export default function ShareButton({
  url,
  title,
  className,
}: ShareButtonProps) {
  const [copied, setCopied] = useState(false);

  const onClick = useCallback(
    async (e: MouseEvent<HTMLButtonElement>) => {
      await createShareClickHandler({ url, title, setCopied })(e);
    },
    [url, title],
  );

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Share"
      className={clsx(
        "flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800",
        className,
      )}
    >
      <Share2 className="h-4 w-4" />
      {copied ? "Copied!" : "Share"}
    </button>
  );
}
