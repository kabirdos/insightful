"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { TrendingUp, Heart, User, ExternalLink } from "lucide-react";
import clsx from "clsx";

type SectionType =
  | "all"
  | "at_a_glance"
  | "impressive_workflows"
  | "friction_analysis"
  | "suggestions"
  | "on_the_horizon"
  | "interaction_style";

interface TopSection {
  id: string;
  sectionKey: string;
  sectionType: string;
  preview: string;
  voteCount: number;
  reportSlug: string;
  reportTitle: string;
  author: {
    username: string;
    displayName?: string | null;
    avatarUrl?: string | null;
  };
}

const filterTabs: { value: SectionType; label: string }[] = [
  { value: "all", label: "All" },
  { value: "impressive_workflows", label: "Workflows" },
  { value: "friction_analysis", label: "Friction" },
  { value: "suggestions", label: "Suggestions" },
  { value: "on_the_horizon", label: "Horizon" },
  { value: "interaction_style", label: "Style" },
  { value: "at_a_glance", label: "Overview" },
];

const sectionTypeColors: Record<string, string> = {
  at_a_glance:
    "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
  interaction_style:
    "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400",
  impressive_workflows:
    "bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-400",
  friction_analysis:
    "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400",
  suggestions:
    "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
  on_the_horizon:
    "bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400",
  fun_ending:
    "bg-yellow-50 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-400",
};

const sectionTypeLabels: Record<string, string> = {
  at_a_glance: "At a Glance",
  interaction_style: "Interaction Style",
  impressive_workflows: "Workflows",
  friction_analysis: "Friction",
  suggestions: "Suggestions",
  on_the_horizon: "Horizon",
  fun_ending: "Fun",
};

export default function TopPage() {
  const [sections, setSections] = useState<TopSection[]>([]);
  const [filter, setFilter] = useState<SectionType>("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = filter !== "all" ? `?type=${filter}` : "";
    fetch(`/api/top${params}`)
      .then((r) => r.json())
      .then((data) => setSections(data.sections || []))
      .catch(() => setSections([]))
      .finally(() => setLoading(false));
  }, [filter]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="mb-8 text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <TrendingUp className="h-7 w-7 text-blue-600" />
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">
            Top Insights
          </h1>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          The most-voted individual sections across all reports
        </p>
      </div>

      {/* Filter Tabs */}
      <div className="mb-6 flex flex-wrap items-center justify-center gap-1">
        {filterTabs.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setFilter(value)}
            className={clsx(
              "rounded-full px-3.5 py-1.5 text-sm font-medium transition-all",
              filter === value
                ? "bg-blue-600 text-white shadow-sm"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="animate-pulse rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900/50"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="h-6 w-6 rounded-full bg-slate-200 dark:bg-slate-700" />
                <div className="h-4 w-32 rounded bg-slate-200 dark:bg-slate-700" />
              </div>
              <div className="h-4 w-full rounded bg-slate-100 dark:bg-slate-800 mb-2" />
              <div className="h-4 w-3/4 rounded bg-slate-100 dark:bg-slate-800" />
            </div>
          ))}
        </div>
      ) : sections.length > 0 ? (
        <div className="space-y-3">
          {sections.map((section, idx) => (
            <Link
              key={section.id}
              href={`/insights/${section.reportSlug}#${section.sectionKey}`}
              className="group flex gap-4 rounded-xl border border-slate-200 bg-white p-5 transition-all hover:border-blue-200 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/50 dark:hover:border-blue-900"
            >
              {/* Rank */}
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-sm font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                {idx + 1}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  <span
                    className={clsx(
                      "rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                      sectionTypeColors[section.sectionType] ||
                        "bg-slate-100 text-slate-600",
                    )}
                  >
                    {sectionTypeLabels[section.sectionType] ||
                      section.sectionType}
                  </span>
                  <span className="text-xs text-slate-400">from</span>
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-300 truncate">
                    {section.reportTitle}
                  </span>
                </div>
                <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300 line-clamp-2">
                  {section.preview}
                </p>
                <div className="mt-2 flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    {section.author.avatarUrl ? (
                      <Image
                        src={section.author.avatarUrl}
                        alt=""
                        width={20}
                        height={20}
                        className="rounded-full"
                      />
                    ) : (
                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-400">
                        <User className="h-3 w-3" />
                      </div>
                    )}
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {section.author.displayName || section.author.username}
                    </span>
                  </div>
                </div>
              </div>

              {/* Vote count */}
              <div className="flex shrink-0 flex-col items-center justify-center gap-0.5">
                <Heart className="h-4 w-4 text-red-400" />
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  {section.voteCount}
                </span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16">
          <TrendingUp className="mb-3 h-10 w-10 text-slate-300 dark:text-slate-600" />
          <p className="text-slate-500 dark:text-slate-400">
            No voted sections yet
          </p>
        </div>
      )}
    </div>
  );
}
