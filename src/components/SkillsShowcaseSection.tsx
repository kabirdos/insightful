"use client";

import { useEffect, useRef, useState } from "react";
import { hasShowcaseContent, type HarnessSkillEntry } from "@/types/insights";
import { getSafeHeroDataUri } from "@/lib/safe-image";
import { buildItemKey, slugItemKey } from "@/lib/item-visibility";
import { SkillReadme } from "@/components/SkillReadme";

interface SkillsShowcaseSectionProps {
  skillInventory: HarnessSkillEntry[];
  // Optional anchor id to auto-open on mount (e.g. "skill-foo"). When omitted,
  // the component also checks the current URL hash for a matching anchor so
  // the Dashboard teaser cards can deep-link into a specific deep dive.
  autoOpenAnchor?: string | null;
}

const OTHER_CATEGORY = "Other";

/**
 * Skills-tab deep-dive accordion. Each shareable skill is rendered as a
 * collapsible item with the README + hero image in the body. All items are
 * collapsed by default so the page stays bounded — reader taps a row to
 * read. Categories become section headers when at least one skill declares
 * one.
 *
 * Renders nothing when no entry has showcase content.
 */
export function SkillsShowcaseSection({
  skillInventory,
  autoOpenAnchor,
}: SkillsShowcaseSectionProps) {
  const showcaseSkills = skillInventory.filter(hasShowcaseContent);

  // Build a stable item-key → skill map so autoOpen logic and rendering
  // agree on anchor ids. Keyed against the full inventory to match whatever
  // the teaser card generated for deep-links.
  const entries = showcaseSkills.map((skill) => ({
    skill,
    itemKey: buildItemKey(
      skillInventory,
      skillInventory.indexOf(skill),
      (s) => s.name,
    ),
  }));

  // Initial open state respects autoOpenAnchor synchronously so SSR output
  // and the first client render match — otherwise the server would emit a
  // collapsed accordion even when the parent asked for an open one.
  const [openAnchor, setOpenAnchor] = useState<string | null>(
    autoOpenAnchor ?? null,
  );

  // Reset openAnchor during render when the parent supplies a new
  // autoOpenAnchor (e.g. a second teaser-card click after the Skills tab is
  // already mounted). This is the React-recommended "adjust state based on
  // prop change" pattern — keeps us out of the setState-inside-useEffect
  // anti-pattern that ESLint catches.
  const prevAutoOpenRef = useRef<string | null | undefined>(autoOpenAnchor);
  if (autoOpenAnchor && prevAutoOpenRef.current !== autoOpenAnchor) {
    prevAutoOpenRef.current = autoOpenAnchor;
    setOpenAnchor(autoOpenAnchor);
  }

  // Fallback: on mount, if no explicit anchor was requested, open whichever
  // item the URL hash points at so /insights/foo/bar#skill-x shared links
  // land with that deep-dive expanded. Only runs once; safe to ignore the
  // subsequent lint warning since this effect is a one-shot mount sync.
  useEffect(() => {
    if (autoOpenAnchor) return;
    if (typeof window === "undefined") return;
    const hash = window.location.hash.replace(/^#/, "");
    if (hash && entries.some((e) => `skill-${e.itemKey}` === hash)) {
      setOpenAnchor(hash);
    }
    // Intentionally run-once on mount — entries/autoOpenAnchor changes are
    // handled by the synchronous-prop-reset branch above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (showcaseSkills.length === 0) return null;

  const toggle = (anchorId: string) => {
    setOpenAnchor((cur) => (cur === anchorId ? null : anchorId));
  };

  const anyHasCategory = showcaseSkills.some(
    (s) => typeof s.category === "string" && s.category.length > 0,
  );

  if (!anyHasCategory) {
    return (
      <section id="skill-showcase" className="space-y-6">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-xl font-semibold">Skill deep dives</h2>
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            {entries.length} published
          </span>
        </div>
        <Accordion
          entries={entries}
          openAnchor={openAnchor}
          onToggle={toggle}
        />
      </section>
    );
  }

  // Group by category; null/empty → "Other"
  const groups = new Map<string, typeof entries>();
  for (const entry of entries) {
    const cat =
      typeof entry.skill.category === "string" &&
      entry.skill.category.length > 0
        ? entry.skill.category
        : OTHER_CATEGORY;
    const bucket = groups.get(cat);
    if (bucket) bucket.push(entry);
    else groups.set(cat, [entry]);
  }

  const categories = [...groups.keys()].sort((a, b) => {
    if (a === OTHER_CATEGORY) return 1;
    if (b === OTHER_CATEGORY) return -1;
    return a.localeCompare(b);
  });

  return (
    <section id="skill-showcase" className="space-y-6">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-xl font-semibold">Skill deep dives</h2>
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
          {entries.length} published
        </span>
      </div>
      <nav aria-label="Skill categories" className="text-sm">
        <ul className="flex flex-wrap gap-3">
          {categories.map((cat) => (
            <li key={cat}>
              <a
                href={`#skill-cat-${slugItemKey(cat) || "other"}`}
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                {cat}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      {categories.map((cat) => (
        <div
          key={cat}
          id={`skill-cat-${slugItemKey(cat) || "other"}`}
          className="space-y-3"
        >
          <h3 className="text-lg font-medium">{cat}</h3>
          <Accordion
            entries={groups.get(cat) ?? []}
            openAnchor={openAnchor}
            onToggle={toggle}
          />
        </div>
      ))}
    </section>
  );
}

interface AccordionProps {
  entries: { skill: HarnessSkillEntry; itemKey: string }[];
  openAnchor: string | null;
  onToggle: (anchorId: string) => void;
}

function Accordion({ entries, openAnchor, onToggle }: AccordionProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900/50">
      {entries.map(({ skill, itemKey }, idx) => {
        const anchorId = `skill-${itemKey}`;
        const isOpen = openAnchor === anchorId;
        return (
          <AccordionItem
            key={itemKey}
            skill={skill}
            anchorId={anchorId}
            isOpen={isOpen}
            onToggle={() => onToggle(anchorId)}
            isLast={idx === entries.length - 1}
          />
        );
      })}
    </div>
  );
}

function AccordionItem({
  skill,
  anchorId,
  isOpen,
  onToggle,
  isLast,
}: {
  skill: HarnessSkillEntry;
  anchorId: string;
  isOpen: boolean;
  onToggle: () => void;
  isLast: boolean;
}) {
  const heroUri = getSafeHeroDataUri(skill);

  return (
    <div
      id={anchorId}
      className={
        isLast ? "" : "border-b border-slate-100 dark:border-slate-800"
      }
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className={`flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors ${
          isOpen
            ? "bg-emerald-50/60 dark:bg-emerald-950/30"
            : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
        }`}
      >
        <svg
          viewBox="0 0 20 20"
          fill="currentColor"
          className={`h-5 w-5 shrink-0 transition-transform ${
            isOpen
              ? "rotate-90 text-emerald-600 dark:text-emerald-400"
              : "text-slate-400 dark:text-slate-500"
          }`}
          aria-hidden="true"
        >
          <path d="M7 5l6 5-6 5V5z" />
        </svg>
        <span className="shrink-0 text-sm font-semibold text-slate-900 dark:text-slate-100">
          {skill.name}
        </span>
        {skill.description ? (
          <span
            className={`min-w-0 flex-1 text-xs text-slate-500 dark:text-slate-400 ${
              isOpen ? "" : "truncate"
            }`}
          >
            {skill.description}
          </span>
        ) : (
          <span className="min-w-0 flex-1" />
        )}
        <SourceBadge source={skill.source} />
      </button>
      {isOpen && (
        <div className="border-t border-slate-100 bg-slate-50/60 px-5 pb-6 pt-4 dark:border-slate-800 dark:bg-slate-900/30">
          {heroUri && (
            <div className="mb-4 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
              <img
                src={heroUri}
                alt={skill.description || skill.name}
                className="h-auto w-full"
              />
            </div>
          )}
          <div className="skill-readme">
            <SkillReadme markdown={skill.readme_markdown ?? ""} />
          </div>
        </div>
      )}
    </div>
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
