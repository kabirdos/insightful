"use client";

import { useState } from "react";
import { Heart } from "lucide-react";
import clsx from "clsx";

interface VoteButtonProps {
  slug: string;
  reportId: string;
  sectionKey: string;
  initialCount: number;
  initialVoted?: boolean;
}

export default function VoteButton({
  slug,
  reportId,
  sectionKey,
  initialCount,
  initialVoted = false,
}: VoteButtonProps) {
  const [voted, setVoted] = useState(initialVoted);
  const [count, setCount] = useState(initialCount);
  const [isLoading, setIsLoading] = useState(false);

  async function handleVote() {
    if (isLoading) return;

    // Optimistic update
    setVoted(!voted);
    setCount((c) => (voted ? c - 1 : c + 1));
    setIsLoading(true);

    try {
      const method = voted ? "DELETE" : "POST";
      const res = await fetch(`/api/insights/${slug}/vote`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sectionKey }),
      });

      if (!res.ok) {
        // Revert optimistic update
        setVoted(voted);
        setCount(initialCount);
      }
    } catch {
      // Revert optimistic update
      setVoted(voted);
      setCount(initialCount);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <button
      onClick={handleVote}
      disabled={isLoading}
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-all duration-200",
        voted
          ? "bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-950/40 dark:text-red-400 dark:hover:bg-red-950/60"
          : "bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-300",
        isLoading && "opacity-60 cursor-not-allowed",
      )}
      aria-label={voted ? "Remove vote" : "Vote"}
    >
      <Heart
        className={clsx(
          "h-4 w-4 transition-transform duration-200",
          voted && "fill-current scale-110",
        )}
      />
      <span>{count}</span>
    </button>
  );
}
