import type { SkillKey } from "@/types/insights";
import { SKILL_METADATA } from "@/types/insights";
import clsx from "clsx";

interface SkillBadgesProps {
  skills: SkillKey[];
  size?: "sm" | "md";
}

export default function SkillBadges({ skills, size = "md" }: SkillBadgesProps) {
  if (!skills || skills.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {skills.map((key) => {
        const meta = SKILL_METADATA[key];
        if (!meta) return null;
        return (
          <span
            key={key}
            className={clsx(
              "inline-flex items-center gap-1 rounded-full font-semibold uppercase tracking-wide",
              meta.colorClass,
              size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs",
            )}
          >
            <span>{meta.icon}</span>
            <span>{meta.label}</span>
          </span>
        );
      })}
    </div>
  );
}
