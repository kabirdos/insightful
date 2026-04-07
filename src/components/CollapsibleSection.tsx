"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import clsx from "clsx";

interface CollapsibleSectionProps {
  icon: string;
  iconBgClass?: string;
  title: string;
  summary?: string | null;
  defaultOpen?: boolean;
  children: ReactNode;
}

export default function CollapsibleSection({
  icon,
  iconBgClass = "bg-slate-100 dark:bg-slate-800",
  title,
  summary,
  defaultOpen = false,
  children,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/50">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-start gap-4 p-5 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50"
        type="button"
      >
        {icon ? (
          <div
            className={clsx(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl",
              iconBgClass,
            )}
          >
            {icon}
          </div>
        ) : null}
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            {title}
          </h3>
          {summary && (
            <p className="mt-1 line-clamp-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              {summary}
            </p>
          )}
        </div>
        <ChevronDown
          className={clsx(
            "mt-1 h-5 w-5 shrink-0 text-slate-400 transition-transform",
            open && "rotate-180",
          )}
        />
      </button>
      {open && (
        <div className="border-t border-slate-100 px-5 pb-6 pt-4 dark:border-slate-800">
          {children}
        </div>
      )}
    </div>
  );
}
