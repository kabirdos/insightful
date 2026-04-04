"use client";

import { useState, useEffect, useCallback } from "react";
import { Search as SearchIcon, X, Sparkles } from "lucide-react";
import InsightCard from "@/components/InsightCard";

interface InsightSummary {
  slug: string;
  title: string;
  publishedAt: string;
  dateRangeStart?: string | null;
  dateRangeEnd?: string | null;
  sessionCount?: number | null;
  messageCount?: number | null;
  commitCount?: number | null;
  whatsWorkingPreview?: string | null;
  voteCount: number;
  commentCount: number;
  sectionTags: string[];
  author: {
    username: string;
    displayName?: string | null;
    avatarUrl?: string | null;
  };
}

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<InsightSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      setSearched(false);
      return;
    }
    setLoading(true);
    setSearched(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}`);
      const data = await res.json();
      setResults(data.data || []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => doSearch(query), 400);
    return () => clearTimeout(timer);
  }, [query, doSearch]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl mb-2">
          Search Insights
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Find insights by content, author, or workflow
        </p>
      </div>

      {/* Search Input */}
      <div className="relative mb-8 mx-auto max-w-xl">
        <SearchIcon className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search insights..."
          autoFocus
          className="w-full rounded-xl border border-slate-200 bg-white py-3.5 pl-12 pr-10 text-base text-slate-900 placeholder-slate-400 outline-none transition-colors focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:placeholder-slate-500 dark:focus:border-blue-600 dark:focus:ring-blue-900/30"
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Results */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="animate-pulse rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900/50"
            >
              <div className="h-5 w-3/4 rounded bg-slate-200 dark:bg-slate-700 mb-3" />
              <div className="h-4 w-1/2 rounded bg-slate-100 dark:bg-slate-800 mb-2" />
              <div className="h-10 w-full rounded bg-slate-100 dark:bg-slate-800" />
            </div>
          ))}
        </div>
      ) : results.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {results.map((insight) => (
            <InsightCard
              key={insight.slug}
              slug={insight.slug}
              title={insight.title}
              authorUsername={insight.author.username}
              authorAvatar={insight.author.avatarUrl}
              authorDisplayName={insight.author.displayName}
              publishedAt={insight.publishedAt}
              dateRangeStart={insight.dateRangeStart}
              dateRangeEnd={insight.dateRangeEnd}
              sessionCount={insight.sessionCount}
              messageCount={insight.messageCount}
              commitCount={insight.commitCount}
              whatsWorkingPreview={insight.whatsWorkingPreview}
              voteCount={insight.voteCount}
              commentCount={insight.commentCount}
              sectionTags={insight.sectionTags}
            />
          ))}
        </div>
      ) : searched ? (
        <div className="flex flex-col items-center justify-center py-16">
          <SearchIcon className="mb-3 h-10 w-10 text-slate-300 dark:text-slate-600" />
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">
            No results found
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Try different keywords or check your spelling
          </p>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16">
          <Sparkles className="mb-3 h-10 w-10 text-slate-300 dark:text-slate-600" />
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Start typing to search across all shared insights
          </p>
        </div>
      )}
    </div>
  );
}
