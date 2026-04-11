"use client";

import { useState } from "react";
import {
  Lightbulb,
  Zap,
  FolderOpen,
  Sparkles,
  AlertTriangle,
  Compass,
  Rocket,
  PartyPopper,
  Check,
  Copy,
  Star,
  MessageCircle,
} from "lucide-react";
import clsx from "clsx";
import VoteButton from "./VoteButton";
import type {
  ProjectArea,
  ImpressiveWorkflow,
  FrictionCategory,
  ClaudeMdAddition,
  FeatureToTry,
  UsagePattern,
  HorizonOpportunity,
} from "@/types/insights";

interface SectionRendererProps {
  slug: string;
  reportId: string;
  sectionKey: string;
  sectionType: string;
  data: unknown;
  voteCount?: number;
  voted?: boolean;
  annotation?: string | null;
  readOnly?: boolean;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-600 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
    >
      {copied ? (
        <>
          <Check className="h-3 w-3 text-green-500" />
          Copied
        </>
      ) : (
        <>
          <Copy className="h-3 w-3" />
          Copy
        </>
      )}
    </button>
  );
}

function SectionHeader({
  icon: Icon,
  title,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  color: string;
}) {
  return (
    <div className="flex items-center gap-2.5 mb-4">
      <div
        className={clsx(
          "flex h-8 w-8 items-center justify-center rounded-lg",
          color,
        )}
      >
        <Icon className="h-4 w-4" />
      </div>
      <h2 className="text-xl font-bold text-slate-900 dark:text-white">
        {title}
      </h2>
    </div>
  );
}

function AnnotationCallout({ body }: { body: string }) {
  return (
    <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950/30">
      <div className="flex items-center gap-2 mb-1.5">
        <MessageCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
          Author&apos;s Note
        </span>
      </div>
      <p className="text-sm text-blue-800 dark:text-blue-200 leading-relaxed">
        {body}
      </p>
    </div>
  );
}

/* ============ Section Renderers ============ */

function AtAGlanceSection({
  data,
}: {
  data: {
    whats_working: string;
    whats_hindering: string;
    quick_wins: string;
    ambitious_workflows: string;
  };
}) {
  const items = [
    {
      label: "Strengths",
      text: data.whats_working,
      color:
        "border-l-green-500 bg-green-50/50 dark:bg-green-950/20 dark:border-l-green-600",
      iconColor: "text-green-600 dark:text-green-400",
    },
    {
      label: "Challenges",
      text: data.whats_hindering,
      color:
        "border-l-red-500 bg-red-50/50 dark:bg-red-950/20 dark:border-l-red-600",
      iconColor: "text-red-600 dark:text-red-400",
    },
    {
      label: "Opportunities",
      text: data.quick_wins,
      color:
        "border-l-amber-500 bg-amber-50/50 dark:bg-amber-950/20 dark:border-l-amber-600",
      iconColor: "text-amber-600 dark:text-amber-400",
    },
    {
      label: "Next Frontiers",
      text: data.ambitious_workflows,
      color:
        "border-l-purple-500 bg-purple-50/50 dark:bg-purple-950/20 dark:border-l-purple-600",
      iconColor: "text-purple-600 dark:text-purple-400",
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map((item) => (
        <div
          key={item.label}
          className={clsx(
            "rounded-lg border-l-4 p-4 transition-shadow hover:shadow-sm",
            item.color,
          )}
        >
          <h4
            className={clsx(
              "text-sm font-semibold uppercase tracking-wide mb-1.5",
              item.iconColor,
            )}
          >
            {item.label}
          </h4>
          <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
            {item.text}
          </p>
        </div>
      ))}
    </div>
  );
}

function InteractionStyleSection({
  data,
}: {
  data: { narrative: string; key_pattern: string };
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
        {data.narrative}
      </p>
      <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-4 dark:border-indigo-900 dark:bg-indigo-950/30">
        <div className="flex items-center gap-2 mb-1.5">
          <Zap className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          <span className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">
            Key Pattern
          </span>
        </div>
        <p className="text-sm text-indigo-800 dark:text-indigo-200 leading-relaxed">
          {data.key_pattern}
        </p>
      </div>
    </div>
  );
}

function ProjectAreasSection({ data }: { data: { areas: ProjectArea[] } }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {data.areas.map((area, i) => (
        <div
          key={i}
          className="rounded-xl border border-slate-200 bg-white p-4 transition-shadow hover:shadow-sm dark:border-slate-700 dark:bg-slate-800/50"
        >
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-semibold text-slate-900 dark:text-white truncate">
              {area.name}
            </h4>
            <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-400">
              {area.session_count} sessions
            </span>
          </div>
          <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
            {area.description}
          </p>
        </div>
      ))}
    </div>
  );
}

function ImpressiveWorkflowsSection({
  data,
}: {
  data: { intro: string; impressive_workflows: ImpressiveWorkflow[] };
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
        {data.intro}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {data.impressive_workflows.map((wf, i) => (
          <div
            key={i}
            className="rounded-xl border border-green-200 bg-gradient-to-br from-green-50 to-emerald-50 p-4 dark:border-green-900 dark:from-green-950/30 dark:to-emerald-950/20"
          >
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-4 w-4 text-green-600 dark:text-green-400" />
              <h4 className="font-semibold text-green-800 dark:text-green-300">
                {wf.title}
              </h4>
            </div>
            <p className="text-sm leading-relaxed text-green-700 dark:text-green-400">
              {wf.description}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function FrictionAnalysisSection({
  data,
}: {
  data: { intro: string; categories: FrictionCategory[] };
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
        {data.intro}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {data.categories.map((cat, i) => (
          <div
            key={i}
            className="rounded-xl border border-red-200 bg-gradient-to-br from-red-50 to-amber-50 p-4 dark:border-red-900/50 dark:from-red-950/20 dark:to-amber-950/10"
          >
            <h4 className="font-semibold text-red-800 dark:text-red-300 mb-1.5">
              {cat.category}
            </h4>
            <p className="text-sm leading-relaxed text-red-700 dark:text-red-400 mb-2">
              {cat.description}
            </p>
            {cat.examples.length > 0 && (
              <ul className="space-y-1">
                {cat.examples.map((ex, j) => (
                  <li
                    key={j}
                    className="flex items-start gap-1.5 text-xs text-red-600 dark:text-red-400"
                  >
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-red-400 dark:bg-red-600" />
                    {ex}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function SuggestionsSection({
  data,
}: {
  data: {
    claude_md_additions: ClaudeMdAddition[];
    features_to_try: FeatureToTry[];
    usage_patterns: UsagePattern[];
  };
}) {
  return (
    <div className="space-y-8">
      {/* CLAUDE.md Additions */}
      {data.claude_md_additions.length > 0 && (
        <div>
          <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200 mb-3">
            CLAUDE.md Additions
          </h3>
          <div className="space-y-2">
            {data.claude_md_additions.map((item, i) => (
              <div
                key={i}
                className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800/50"
              >
                <div className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 dark:text-white text-sm">
                      {item.addition}
                    </p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {item.why}
                    </p>
                    {item.prompt_scaffold && (
                      <div className="mt-2 rounded-md bg-slate-50 p-2 dark:bg-slate-900">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">
                            Scaffold
                          </span>
                          <CopyButton text={item.prompt_scaffold} />
                        </div>
                        <pre className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap font-mono">
                          {item.prompt_scaffold}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Features to Try */}
      {data.features_to_try.length > 0 && (
        <div>
          <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200 mb-3">
            Features to Try
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {data.features_to_try.map((feat, i) => (
              <div
                key={i}
                className="rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-yellow-50 p-4 dark:border-amber-900/50 dark:from-amber-950/20 dark:to-yellow-950/10"
              >
                <h4 className="font-semibold text-amber-800 dark:text-amber-300 text-sm">
                  {feat.feature}
                </h4>
                <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                  {feat.one_liner}
                </p>
                <p className="mt-2 text-xs text-amber-600 dark:text-amber-400/80">
                  {feat.why_for_you}
                </p>
                {feat.example_code && (
                  <div className="mt-2 rounded-md bg-amber-100/50 p-2 dark:bg-amber-950/30">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] uppercase tracking-wider text-amber-500 font-medium">
                        Example
                      </span>
                      <CopyButton text={feat.example_code} />
                    </div>
                    <pre className="text-xs text-amber-800 dark:text-amber-300 whitespace-pre-wrap font-mono">
                      {feat.example_code}
                    </pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Usage Patterns */}
      {data.usage_patterns.length > 0 && (
        <div>
          <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200 mb-3">
            Usage Patterns
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {data.usage_patterns.map((pat, i) => (
              <div
                key={i}
                className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800/50"
              >
                <h4 className="font-semibold text-slate-900 dark:text-white text-sm">
                  {pat.title}
                </h4>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                  {pat.suggestion}
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-500">
                  {pat.detail}
                </p>
                {pat.copyable_prompt && (
                  <div className="mt-2 rounded-md bg-slate-50 p-2 dark:bg-slate-900">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">
                        Prompt
                      </span>
                      <CopyButton text={pat.copyable_prompt} />
                    </div>
                    <pre className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap font-mono">
                      {pat.copyable_prompt}
                    </pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function OnTheHorizonSection({
  data,
}: {
  data: { intro: string; opportunities: HorizonOpportunity[] };
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
        {data.intro}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {data.opportunities.map((opp, i) => (
          <div
            key={i}
            className="rounded-xl border border-purple-200 bg-gradient-to-br from-purple-50 to-violet-50 p-4 dark:border-purple-900/50 dark:from-purple-950/30 dark:to-violet-950/20"
          >
            <div className="flex items-center gap-2 mb-2">
              <Rocket className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              <h4 className="font-semibold text-purple-800 dark:text-purple-300 text-sm">
                {opp.title}
              </h4>
            </div>
            <p className="text-xs text-purple-700 dark:text-purple-400 leading-relaxed">
              {opp.whats_possible}
            </p>
            <p className="mt-2 text-xs text-purple-600 dark:text-purple-400/80">
              {opp.how_to_try}
            </p>
            {opp.copyable_prompt && (
              <div className="mt-2 rounded-md bg-purple-100/50 p-2 dark:bg-purple-950/30">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] uppercase tracking-wider text-purple-500 font-medium">
                    Try it
                  </span>
                  <CopyButton text={opp.copyable_prompt} />
                </div>
                <pre className="text-xs text-purple-800 dark:text-purple-300 whitespace-pre-wrap font-mono">
                  {opp.copyable_prompt}
                </pre>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function FunEndingSection({
  data,
}: {
  data: { headline: string; detail: string };
}) {
  return (
    <div className="rounded-xl border border-yellow-200 bg-gradient-to-br from-yellow-50 to-amber-50 p-6 dark:border-yellow-900/50 dark:from-yellow-950/30 dark:to-amber-950/20">
      <div className="flex items-center gap-2 mb-2">
        <PartyPopper className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
        <h3 className="text-lg font-bold text-yellow-800 dark:text-yellow-300">
          {data.headline}
        </h3>
      </div>
      <p className="text-sm leading-relaxed text-yellow-700 dark:text-yellow-400">
        {data.detail}
      </p>
    </div>
  );
}

/* ============ Main SectionRenderer ============ */

const sectionMeta: Record<
  string,
  {
    title: string;
    icon: React.ComponentType<{ className?: string }>;
    color: string;
  }
> = {
  at_a_glance: {
    title: "At a Glance",
    icon: Lightbulb,
    color: "bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-400",
  },
  interaction_style: {
    title: "Interaction Style",
    icon: Zap,
    color:
      "bg-indigo-100 text-indigo-600 dark:bg-indigo-900 dark:text-indigo-400",
  },
  project_areas: {
    title: "Project Areas",
    icon: FolderOpen,
    color: "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400",
  },
  impressive_workflows: {
    title: "Impressive Workflows",
    icon: Sparkles,
    color: "bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-400",
  },
  friction_analysis: {
    title: "Friction Analysis",
    icon: AlertTriangle,
    color: "bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-400",
  },
  suggestions: {
    title: "Suggestions",
    icon: Compass,
    color: "bg-amber-100 text-amber-600 dark:bg-amber-900 dark:text-amber-400",
  },
  on_the_horizon: {
    title: "On the Horizon",
    icon: Rocket,
    color:
      "bg-purple-100 text-purple-600 dark:bg-purple-900 dark:text-purple-400",
  },
  fun_ending: {
    title: "Fun Ending",
    icon: PartyPopper,
    color:
      "bg-yellow-100 text-yellow-600 dark:bg-yellow-900 dark:text-yellow-400",
  },
};

export default function SectionRenderer({
  slug,
  reportId,
  sectionKey,
  sectionType,
  data,
  voteCount = 0,
  voted = false,
  annotation,
  readOnly = false,
}: SectionRendererProps) {
  const meta = sectionMeta[sectionType] || sectionMeta.at_a_glance;

  function renderContent() {
    switch (sectionType) {
      case "at_a_glance":
        return (
          <AtAGlanceSection
            data={
              data as {
                whats_working: string;
                whats_hindering: string;
                quick_wins: string;
                ambitious_workflows: string;
              }
            }
          />
        );
      case "interaction_style":
        return (
          <InteractionStyleSection
            data={data as { narrative: string; key_pattern: string }}
          />
        );
      case "project_areas":
        return <ProjectAreasSection data={data as { areas: ProjectArea[] }} />;
      case "impressive_workflows":
        return (
          <ImpressiveWorkflowsSection
            data={
              data as {
                intro: string;
                impressive_workflows: ImpressiveWorkflow[];
              }
            }
          />
        );
      case "friction_analysis":
        return (
          <FrictionAnalysisSection
            data={data as { intro: string; categories: FrictionCategory[] }}
          />
        );
      case "suggestions":
        return (
          <SuggestionsSection
            data={
              data as {
                claude_md_additions: ClaudeMdAddition[];
                features_to_try: FeatureToTry[];
                usage_patterns: UsagePattern[];
              }
            }
          />
        );
      case "on_the_horizon":
        return (
          <OnTheHorizonSection
            data={
              data as { intro: string; opportunities: HorizonOpportunity[] }
            }
          />
        );
      case "fun_ending":
        return (
          <FunEndingSection
            data={data as { headline: string; detail: string }}
          />
        );
      default:
        return (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Unknown section type
          </p>
        );
    }
  }

  return (
    <section
      id={sectionKey}
      className="scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900/50"
    >
      <SectionHeader icon={meta.icon} title={meta.title} color={meta.color} />
      {renderContent()}
      {annotation && <AnnotationCallout body={annotation} />}

      {/* Actions */}
      {!readOnly && (
        <div className="mt-5 flex items-center gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
          <VoteButton
            slug={slug}
            reportId={reportId}
            sectionKey={sectionKey}
            initialCount={voteCount}
            initialVoted={voted}
          />
          <button className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-500 transition-colors hover:bg-amber-50 hover:text-amber-600 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-amber-950/30 dark:hover:text-amber-400">
            <Star className="h-4 w-4" />
            Highlight
          </button>
        </div>
      )}
    </section>
  );
}
