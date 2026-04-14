"use client";

import clsx from "clsx";

export type ProfileTab = "dashboard" | "skills" | "writeup" | "insights";

interface TabDef {
  key: ProfileTab;
  label: string;
  meta?: string;
  byClaude?: boolean;
  // Classes for the idle state: tinted badge bg + saturated icon stroke.
  idleBg: string;
  idleText: string;
  // Classes for the active state: saturated badge bg + white icon + matching
  // tab-fill wash. The fill wash is the lightest tint in the family (e.g.
  // blue-50) and the badge is the same saturated value as the idle text.
  activeFill: string;
  activeBadgeBg: string;
  activeShadow: string;
  Icon: React.ComponentType<{ className?: string }>;
}

// ── Custom inline SVG icons (lucide-compatible: stroke 1.75, round joins,
// currentColor). Tuned to each tab's concept rather than borrowed from the
// lucide set — the Dashboard "2×2 grid with one accent cell" and the
// Write-up "document with a Claude sparkle" are specific to this surface. ──

function DashboardIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      aria-hidden="true"
    >
      <rect
        x="3"
        y="3"
        width="7.5"
        height="7.5"
        rx="1.25"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <rect
        x="13.5"
        y="3"
        width="7.5"
        height="4.5"
        rx="1.25"
        fill="currentColor"
        opacity="0.9"
      />
      <rect
        x="13.5"
        y="10"
        width="7.5"
        height="11"
        rx="1.25"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <rect
        x="3"
        y="13.5"
        width="7.5"
        height="7.5"
        rx="1.25"
        stroke="currentColor"
        strokeWidth="1.75"
      />
    </svg>
  );
}

function WriteupIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M13.5 2.5H6.5A1.5 1.5 0 0 0 5 4v16a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 20V8l-5.5-5.5Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path
        d="M13.5 2.5V8H19"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path
        d="M8 12h8M8 15.5h6M8 19h4.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {/* Claude-style 4-point sparkle badge in the corner */}
      <path
        d="M18 11.5 18.5 13 20 13.5 18.5 14 18 15.5 17.5 14 16 13.5 17.5 13 18 11.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

function SkillsIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      aria-hidden="true"
    >
      {/* Hexagon shell — echoes the "module/building-block" metaphor. */}
      <path
        d="M12 2.75 20 7.25V16.75L12 21.25 4 16.75V7.25L12 2.75Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      {/* Inner stacked slabs — suggest a mini-library of skills. */}
      <path
        d="M8 10.5h8M8 13h6M8 15.5h4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function InsightsIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      aria-hidden="true"
    >
      {/* Primary 4-point sparkle */}
      <path
        d="M12 3.5 13.6 9.2 19.2 10.8 13.6 12.4 12 18.1 10.4 12.4 4.8 10.8 10.4 9.2 12 3.5Z"
        fill="currentColor"
      />
      {/* Satellites */}
      <path
        d="M19 4 19.6 5.9 21.5 6.5 19.6 7.1 19 9 18.4 7.1 16.5 6.5 18.4 5.9 19 4Z"
        fill="currentColor"
        opacity="0.75"
      />
      <path
        d="M18.5 15.5 19 17 20.5 17.5 19 18 18.5 19.5 18 18 16.5 17.5 18 17 18.5 15.5Z"
        fill="currentColor"
        opacity="0.6"
      />
    </svg>
  );
}

const TABS: TabDef[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    meta: "metrics · charts · setup",
    idleBg: "bg-blue-100 dark:bg-blue-900/30",
    idleText: "text-blue-600 dark:text-blue-400",
    activeFill: "bg-blue-50 dark:bg-blue-950/30",
    activeBadgeBg: "bg-blue-600",
    activeShadow: "shadow-[0_4px_10px_-3px_rgba(37,99,235,0.45)]",
    Icon: DashboardIcon,
  },
  {
    key: "skills",
    label: "Skills",
    meta: "inventory · deep dives",
    idleBg: "bg-emerald-100 dark:bg-emerald-900/30",
    idleText: "text-emerald-600 dark:text-emerald-400",
    activeFill: "bg-emerald-50 dark:bg-emerald-950/30",
    activeBadgeBg: "bg-emerald-600",
    activeShadow: "shadow-[0_4px_10px_-3px_rgba(5,150,105,0.45)]",
    Icon: SkillsIcon,
  },
  {
    key: "writeup",
    label: "Write-up",
    byClaude: true,
    idleBg: "bg-indigo-100 dark:bg-indigo-900/30",
    idleText: "text-indigo-600 dark:text-indigo-400",
    activeFill: "bg-indigo-50 dark:bg-indigo-950/30",
    activeBadgeBg: "bg-indigo-600",
    activeShadow: "shadow-[0_4px_10px_-3px_rgba(79,70,229,0.45)]",
    Icon: WriteupIcon,
  },
  {
    key: "insights",
    label: "Claude Insights",
    byClaude: true,
    idleBg: "bg-purple-100 dark:bg-purple-900/30",
    idleText: "text-purple-600 dark:text-purple-400",
    activeFill: "bg-purple-50 dark:bg-purple-950/30",
    activeBadgeBg: "bg-purple-600",
    activeShadow: "shadow-[0_4px_10px_-3px_rgba(147,51,234,0.45)]",
    Icon: InsightsIcon,
  },
];

interface ProfileTabsProps {
  active: ProfileTab;
  onChange: (tab: ProfileTab) => void;
}

export default function ProfileTabs({ active, onChange }: ProfileTabsProps) {
  return (
    <div
      role="tablist"
      aria-label="Profile sections"
      className="relative mb-6 grid grid-cols-1 overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900/50 sm:grid-cols-2 lg:grid-cols-4"
    >
      {TABS.map((tab) => {
        const isActive = active === tab.key;
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.key)}
            className={clsx(
              "group relative flex items-center gap-3.5 border-b border-slate-100 px-5 py-4 text-left transition-colors last:border-b-0 dark:border-slate-800 sm:border-b-0 sm:border-r sm:last:border-r-0",
              isActive
                ? tab.activeFill
                : "hover:bg-slate-50 dark:hover:bg-slate-800/50",
            )}
          >
            <div
              className={clsx(
                "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-all group-hover:-translate-y-px",
                isActive
                  ? `${tab.activeBadgeBg} text-white ${tab.activeShadow}`
                  : `${tab.idleBg} ${tab.idleText}`,
              )}
            >
              <tab.Icon className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <div
                className={clsx(
                  "text-base leading-tight transition-colors",
                  isActive
                    ? "font-semibold text-slate-900 dark:text-white"
                    : "font-medium text-slate-600 group-hover:text-slate-900 dark:text-slate-400 dark:group-hover:text-white",
                )}
              >
                {tab.label}
              </div>
              {tab.byClaude ? (
                <div className="mt-0.5 text-xs italic text-slate-400 dark:text-slate-500">
                  by Claude
                </div>
              ) : tab.meta ? (
                <div className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
                  {tab.meta}
                </div>
              ) : null}
            </div>
            {/* Site-signature blue→violet 3px rail on active (same accent
                used on StatCard tops in HeroStats.tsx) */}
            {isActive && (
              <span
                aria-hidden="true"
                className="absolute inset-x-0 bottom-0 h-[3px] bg-gradient-to-r from-blue-500 to-violet-500"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

// Next-tab navigation footer shown at the bottom of each panel. Renders a
// single "Next: <label>" button when there's a downstream tab, plus a
// "Previous" link when applicable.
export function NextTabNav({
  active,
  onChange,
}: {
  active: ProfileTab;
  onChange: (tab: ProfileTab) => void;
}) {
  const idx = TABS.findIndex((t) => t.key === active);
  const prev = idx > 0 ? TABS[idx - 1] : null;
  const next = idx < TABS.length - 1 ? TABS[idx + 1] : null;

  if (!next && !prev) return null;

  return (
    <div className="mt-6 flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white px-5 py-4 dark:border-slate-700 dark:bg-slate-900/50">
      <div className="min-w-0">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          End of {TABS[idx].label}
        </div>
        <div className="mt-0.5 text-sm font-medium text-slate-700 dark:text-slate-300">
          {next ? "Up next" : "You've reached the end"}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {prev && (
          <button
            type="button"
            onClick={() => onChange(prev.key)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            ← {prev.label}
          </button>
        )}
        {next && (
          <button
            type="button"
            onClick={() => onChange(next.key)}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
          >
            {next.label} <span aria-hidden="true">→</span>
          </button>
        )}
      </div>
    </div>
  );
}
