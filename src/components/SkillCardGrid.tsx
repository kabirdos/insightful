"use client";

import { useState } from "react";
import type { HarnessSkillEntry } from "@/types/insights";

interface SkillCardGridProps {
  skillInventory: HarnessSkillEntry[];
}

function SkillCard({
  skill,
  dimmed = false,
}: {
  skill: HarnessSkillEntry;
  dimmed?: boolean;
}) {
  const isCustom = skill.source.toLowerCase() === "custom";

  return (
    <div
      className={`rounded-lg border p-3.5 transition-shadow hover:shadow-sm ${
        dimmed
          ? "border-slate-200 bg-slate-50 opacity-70 dark:border-slate-700 dark:bg-slate-800/30"
          : isCustom
            ? "border-violet-300 bg-violet-50 dark:border-violet-700 dark:bg-violet-950/20"
            : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900/50"
      }`}
    >
      <div className="flex items-center gap-1.5">
        <span
          className={`text-sm font-bold ${dimmed ? "text-slate-500 dark:text-slate-400" : "text-slate-900 dark:text-slate-100"}`}
        >
          {skill.name}
        </span>
        <span
          className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
            dimmed
              ? "bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500"
              : "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-400"
          }`}
        >
          {skill.calls}
        </span>
      </div>
      <div
        className={`mt-1 inline-block rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
          dimmed
            ? "border-slate-200 text-slate-400 dark:border-slate-700 dark:text-slate-500"
            : isCustom
              ? "border-violet-200 text-violet-600 dark:border-violet-700 dark:text-violet-400"
              : "border-slate-200 text-slate-500 dark:border-slate-700 dark:text-slate-400"
        }`}
      >
        {skill.source}
      </div>
      {skill.description && (
        <p
          className={`mt-2 text-xs leading-relaxed ${dimmed ? "text-slate-400 dark:text-slate-500" : "text-slate-600 dark:text-slate-400"}`}
        >
          {skill.description}
        </p>
      )}
    </div>
  );
}

export default function SkillCardGrid({ skillInventory }: SkillCardGridProps) {
  const [showUnused, setShowUnused] = useState(false);

  if (skillInventory.length === 0) return null;

  const active = skillInventory.filter((s) => s.calls > 0);
  const unused = skillInventory.filter((s) => s.calls === 0);

  return (
    <div className="mb-6 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900/50">
      <h3 className="mb-4 text-[15px] font-bold text-slate-900 dark:text-slate-100">
        Skills & Commands
      </h3>

      {/* Active skills */}
      {active.length > 0 && (
        <>
          <div className="mb-3 flex items-center gap-1.5">
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              className="shrink-0"
            >
              <circle cx="7" cy="7" r="6" fill="#22c55e" />
              <path
                d="M5 7l1.5 1.5L9 5.5"
                stroke="#fff"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="text-[11px] font-bold uppercase tracking-wider text-green-800 dark:text-green-400">
              Active Skills
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {active.map((skill) => (
              <SkillCard key={skill.name} skill={skill} />
            ))}
          </div>
        </>
      )}

      {/* Unused skills */}
      {unused.length > 0 && (
        <div className="mt-4 border-t border-slate-200 pt-3 dark:border-slate-700">
          <button
            onClick={() => setShowUnused(!showUnused)}
            className="flex w-full items-center gap-2 py-1.5 text-left"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              className={`shrink-0 transition-transform duration-200 ${showUnused ? "rotate-180" : ""}`}
            >
              <circle
                cx="7"
                cy="7"
                r="6"
                className="fill-slate-200 dark:fill-slate-700"
              />
              <path
                d="M5 6l2 2 2-2"
                className="stroke-slate-500 dark:stroke-slate-400"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Installed but unused
            </span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              {unused.length} skills
            </span>
          </button>
          {showUnused && (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {unused.map((skill) => (
                <SkillCard key={skill.name} skill={skill} dimmed />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
