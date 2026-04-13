import { hasShowcaseContent, type HarnessSkillEntry } from "@/types/insights";
import { buildItemKey } from "@/lib/item-visibility";

interface SkillsTeaserCardProps {
  skillInventory: HarnessSkillEntry[];
}

/**
 * Top-5 teaser card that surfaces shareable skills with renderable showcase
 * content. Renders nothing when no entry carries showcase data — that's the
 * signal the report wasn't generated with --include-skills (or every showcase
 * skill was hidden).
 *
 * Sorted by `calls` desc with an alphabetic tiebreak, so the most-used skills
 * surface first. Targets the full SkillsShowcaseSection below via a "View all"
 * anchor.
 */
export function SkillsTeaserCard({ skillInventory }: SkillsTeaserCardProps) {
  const showcaseSkills = skillInventory
    .filter(hasShowcaseContent)
    .sort((a, b) => {
      const callsDiff = (b.calls ?? 0) - (a.calls ?? 0);
      if (callsDiff !== 0) return callsDiff;
      return a.name.localeCompare(b.name);
    })
    .slice(0, 5);

  if (showcaseSkills.length === 0) return null;

  return (
    <section className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-lg font-semibold">Featured skills</h2>
        <a
          href="#skill-showcase"
          className="text-sm text-blue-600 hover:underline dark:text-blue-400"
        >
          View all →
        </a>
      </div>
      <ul className="space-y-2">
        {showcaseSkills.map((skill) => {
          // Collision-safe keypath derived from the FULL input list so two
          // skills with the same slugged name get distinct anchors matching
          // the SkillCard DOM ids in SkillsShowcaseSection.
          const itemKey = buildItemKey(
            skillInventory,
            skillInventory.indexOf(skill),
            (s) => s.name,
          );
          return (
            <li
              key={itemKey}
              className="flex items-center justify-between gap-3"
            >
              <div className="min-w-0 flex-1">
                <a
                  href={`#skill-${itemKey}`}
                  className="font-medium hover:underline"
                >
                  {skill.name}
                </a>
                {skill.description && (
                  <div className="truncate text-xs text-zinc-500">
                    {skill.description}
                  </div>
                )}
              </div>
              <SourceBadge source={skill.source} />
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function SourceBadge({ source }: { source: string }) {
  const isPlugin = source.startsWith("plugin:") || source === "plugin";
  return (
    <span
      className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
        isPlugin
          ? "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200"
          : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
      }`}
    >
      {isPlugin ? "plugin" : "custom"}
    </span>
  );
}
