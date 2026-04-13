import { hasShowcaseContent, type HarnessSkillEntry } from "@/types/insights";
import { getSafeHeroDataUri } from "@/lib/safe-image";
import { buildItemKey, slugItemKey } from "@/lib/item-visibility";
import { SkillReadme } from "@/components/SkillReadme";

interface SkillsShowcaseSectionProps {
  skillInventory: HarnessSkillEntry[];
}

const OTHER_CATEGORY = "Other";

/**
 * Full Skills Showcase — renders each shareable skill's README and (when
 * present and validated) its hero image. Grouped by category when at least
 * one skill declares one; otherwise renders a flat list with no TOC.
 *
 * Renders nothing when no entry has showcase content. The section's id
 * (#skill-showcase) is the target of SkillsTeaserCard's "View all" link.
 */
export function SkillsShowcaseSection({
  skillInventory,
}: SkillsShowcaseSectionProps) {
  const showcaseSkills = skillInventory.filter(hasShowcaseContent);
  if (showcaseSkills.length === 0) return null;

  const anyHasCategory = showcaseSkills.some(
    (s) => typeof s.category === "string" && s.category.length > 0,
  );

  // Build collision-safe item keys against the ORIGINAL skillInventory so
  // anchor ids match whatever SkillsTeaserCard generated from the same list.
  // Using the filtered showcaseSkills here would produce different indices
  // and break the teaser "View all" anchors.
  const itemKeyFor = (skill: HarnessSkillEntry): string =>
    buildItemKey(skillInventory, skillInventory.indexOf(skill), (s) => s.name);

  if (!anyHasCategory) {
    return (
      <section id="skill-showcase" className="space-y-6">
        <h2 className="text-xl font-semibold">Skill Showcase</h2>
        <div className="space-y-8">
          {showcaseSkills.map((skill) => {
            const itemKey = itemKeyFor(skill);
            return <SkillCard key={itemKey} itemKey={itemKey} skill={skill} />;
          })}
        </div>
      </section>
    );
  }

  // Group by category; null/empty → "Other"
  const groups = new Map<string, HarnessSkillEntry[]>();
  for (const skill of showcaseSkills) {
    const cat =
      typeof skill.category === "string" && skill.category.length > 0
        ? skill.category
        : OTHER_CATEGORY;
    const bucket = groups.get(cat);
    if (bucket) bucket.push(skill);
    else groups.set(cat, [skill]);
  }

  // Categories alphabetic, but Other always last
  const categories = [...groups.keys()].sort((a, b) => {
    if (a === OTHER_CATEGORY) return 1;
    if (b === OTHER_CATEGORY) return -1;
    return a.localeCompare(b);
  });

  return (
    <section id="skill-showcase" className="space-y-6">
      <h2 className="text-xl font-semibold">Skill Showcase</h2>
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
          className="space-y-6"
        >
          <h3 className="text-lg font-medium">{cat}</h3>
          <div className="space-y-8">
            {(groups.get(cat) ?? []).map((skill) => {
              const itemKey = itemKeyFor(skill);
              return (
                <SkillCard key={itemKey} itemKey={itemKey} skill={skill} />
              );
            })}
          </div>
        </div>
      ))}
    </section>
  );
}

function SkillCard({
  skill,
  itemKey,
}: {
  skill: HarnessSkillEntry;
  itemKey: string;
}) {
  const heroUri = getSafeHeroDataUri(skill);
  const anchorId = `skill-${itemKey}`;

  return (
    <article
      id={anchorId}
      className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950"
    >
      <header className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h4 className="text-lg font-semibold">{skill.name}</h4>
          {skill.description && (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {skill.description}
            </p>
          )}
        </div>
        <SourceBadge source={skill.source} />
      </header>
      {heroUri && (
        <div className="mb-4 overflow-hidden rounded-md border border-zinc-200 dark:border-zinc-800">
          <img
            src={heroUri}
            alt={skill.description || skill.name}
            className="h-auto w-full"
          />
        </div>
      )}
      <div className="prose prose-sm max-w-none dark:prose-invert">
        <SkillReadme markdown={skill.readme_markdown ?? ""} />
      </div>
    </article>
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
