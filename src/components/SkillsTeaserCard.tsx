"use client";

import { hasShowcaseContent, type HarnessSkillEntry } from "@/types/insights";
import { buildItemKey } from "@/lib/item-visibility";
import { getSafeHeroDataUri } from "@/lib/safe-image";

interface SkillsTeaserCardProps {
  skillInventory: HarnessSkillEntry[];
  // Called when a card or "See all" link is clicked — parent switches the
  // active tab to "skills" and scrolls the anchor into view. When omitted,
  // clicking falls back to the hash anchor alone.
  onNavigateToSkill?: (anchorId: string) => void;
}

// Deterministic gradient fallback for skills without a hero image. Hashes
// the skill name into one of a handful of curated color pairs so the same
// skill renders the same gradient across loads. Matches the palette used
// in the mockup so visual identity is consistent.
const GRADIENTS: [string, string][] = [
  ["#0f172a", "#4f46e5"],
  ["#7c2d12", "#ea580c"],
  ["#164e63", "#06b6d4"],
  ["#1e1b4b", "#7c3aed"],
  ["#064e3b", "#10b981"],
  ["#7f1d1d", "#f43f5e"],
];

function gradientFor(name: string): [string, string] {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return GRADIENTS[Math.abs(hash) % GRADIENTS.length];
}

/**
 * Teaser grid surfaced on the Dashboard tab that advertises the "Skill deep
 * dives" this developer has published. Renders nothing when no skill carries
 * showcase content (the signal that extract was run without --include-skills
 * or every showcase skill is hidden).
 *
 * Sorted by `calls` desc with an alphabetic tiebreak. Each card links into
 * the Skills tab (not rendered here) via onNavigateToSkill if provided, else
 * via a plain hash anchor.
 */
export function SkillsTeaserCard({
  skillInventory,
  onNavigateToSkill,
}: SkillsTeaserCardProps) {
  const showcaseSkills = skillInventory
    .filter(hasShowcaseContent)
    .map((skill) => ({
      skill,
      itemKey: buildItemKey(
        skillInventory,
        skillInventory.indexOf(skill),
        (s) => s.name,
      ),
    }))
    .sort((a, b) => {
      const callsDiff = (b.skill.calls ?? 0) - (a.skill.calls ?? 0);
      if (callsDiff !== 0) return callsDiff;
      return a.skill.name.localeCompare(b.skill.name);
    });

  if (showcaseSkills.length === 0) return null;

  const topCards = showcaseSkills.slice(0, 3);
  const totalCount = showcaseSkills.length;

  const handleClick =
    (anchorId: string) => (e: React.MouseEvent<HTMLAnchorElement>) => {
      if (onNavigateToSkill) {
        e.preventDefault();
        onNavigateToSkill(anchorId);
      }
    };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900/50">
      <div className="mb-1 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
          Skill deep dives
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
            {totalCount} published
          </span>
        </h2>
        <a
          href="#skill-showcase"
          onClick={handleClick("")}
          className="shrink-0 text-sm font-semibold text-blue-600 hover:underline dark:text-blue-400"
        >
          See all {totalCount} in Skills tab →
        </a>
      </div>
      <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">
        In-depth explanations this developer published for specific skills. Tap
        a card to read.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {topCards.map(({ skill, itemKey }) => {
          const heroUri = getSafeHeroDataUri(skill);
          const anchorId = `skill-${itemKey}`;
          const [from, to] = gradientFor(skill.name);
          return (
            <a
              key={itemKey}
              href={`#${anchorId}`}
              onClick={handleClick(anchorId)}
              className="group block overflow-hidden rounded-xl border border-slate-200 bg-white transition-all hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-[0_4px_14px_-3px_rgba(16,185,129,0.25)] dark:border-slate-700 dark:bg-slate-900"
            >
              {heroUri ? (
                <img
                  src={heroUri}
                  alt=""
                  className="aspect-[5/2] w-full object-cover"
                />
              ) : (
                <div
                  aria-hidden="true"
                  className="flex aspect-[5/2] w-full items-center justify-center text-base font-bold text-white"
                  style={{
                    background: `linear-gradient(135deg, ${from}, ${to})`,
                  }}
                >
                  {skill.name}
                </div>
              )}
              <div className="p-3.5">
                <div className="mb-1 flex items-center gap-2">
                  <span className="truncate text-sm font-bold text-slate-900 dark:text-slate-100">
                    {skill.name}
                  </span>
                  <SourceBadge source={skill.source} />
                </div>
                {skill.description ? (
                  <p className="mb-2.5 line-clamp-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                    {skill.description}
                  </p>
                ) : (
                  <p className="mb-2.5 text-xs italic text-slate-400 dark:text-slate-500">
                    No description provided
                  </p>
                )}
                <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 transition-transform group-hover:translate-x-0.5 dark:text-emerald-400">
                  Read deep dive <span aria-hidden="true">→</span>
                </span>
              </div>
            </a>
          );
        })}
      </div>
      {totalCount > topCards.length && (
        <div className="mt-3 text-right">
          <a
            href="#skill-showcase"
            onClick={handleClick("")}
            className="text-xs font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          >
            + {totalCount - topCards.length} more deep dive
            {totalCount - topCards.length === 1 ? "" : "s"} in the Skills tab →
          </a>
        </div>
      )}
    </section>
  );
}

function SourceBadge({ source }: { source: string }) {
  const isPlugin = source.startsWith("plugin:") || source === "plugin";
  return (
    <span
      className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
        isPlugin
          ? "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200"
          : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
      }`}
    >
      {isPlugin ? "plugin" : "custom"}
    </span>
  );
}
