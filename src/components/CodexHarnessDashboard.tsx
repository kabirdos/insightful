"use client";

import {
  Code2,
  Info,
  Monitor,
  Package,
  ShieldCheck,
  Terminal,
  Wrench,
} from "lucide-react";
import type { ComponentType, ReactNode } from "react";
import MiniBarChart from "@/components/MiniBarChart";
import { formatCompactNumber } from "@/lib/number-format";
import type { CodexHarnessData } from "@/types/insights";

interface CodexHarnessDashboardProps {
  codexData: CodexHarnessData;
}

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900/50">
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-md bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300">
        <Icon className="h-5 w-5" />
      </div>
      <div className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
        {value}
      </div>
      <div className="mt-1 text-xs font-medium uppercase text-slate-500 dark:text-slate-400">
        {label}
      </div>
    </div>
  );
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: ComponentType<{ className?: string }>;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900/50">
      <div className="mb-4 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          <Icon className="h-4 w-4" />
        </span>
        <h3 className="text-sm font-bold text-slate-950 dark:text-white">
          {title}
        </h3>
      </div>
      {children}
    </section>
  );
}

function KeyValueList({
  entries,
  emptyLabel,
}: {
  entries: Array<[string, number]>;
  emptyLabel: string;
}) {
  if (entries.length === 0) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">{emptyLabel}</p>;
  }

  return (
    <MiniBarChart
      data={entries.map(([label, value]) => ({ label, value }))}
      title=""
      color="bg-blue-500"
    />
  );
}

export default function CodexHarnessDashboard({
  codexData,
}: CodexHarnessDashboardProps) {
  const stats = codexData.stats;
  const toolEntries = Object.entries(codexData.toolUsage).sort(
    (a, b) => b[1] - a[1],
  );
  const cliEntries = Object.entries(codexData.cliTools).sort(
    (a, b) => b[1] - a[1],
  );
  const skills = codexData.skillInventory;
  const plugins = codexData.plugins;
  const desktopPresence = codexData.workSurfaces.desktopPresence;
  const hasWorkflowSignal =
    !!codexData.workflowData &&
    Object.keys(codexData.workflowData).some((key) => {
      const value = codexData.workflowData?.[key];
      if (Array.isArray(value)) return value.length > 0;
      return !!value && typeof value === "object"
        ? Object.keys(value).length > 0
        : value != null;
    });

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-100">
        <div className="flex gap-3">
          <Info className="mt-0.5 h-5 w-5 shrink-0" />
          <p>
            Codex profiles are generated from local CLI and desktop harness
            signals. Inventory items are shown as discovered capabilities, not
            as usage counts unless the extractor provided counts.
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Tokens"
          value={
            typeof stats.totalTokens === "number"
              ? formatCompactNumber(stats.totalTokens)
              : "n/a"
          }
          icon={Code2}
        />
        <StatCard
          label="Sessions"
          value={
            typeof stats.sessionCount === "number"
              ? formatCompactNumber(stats.sessionCount)
              : "n/a"
          }
          icon={Terminal}
        />
        <StatCard
          label="Payload sessions"
          value={
            typeof stats.payloadFormatSessions === "number"
              ? formatCompactNumber(stats.payloadFormatSessions)
              : "n/a"
          }
          icon={Package}
        />
        <StatCard
          label="Legacy sessions"
          value={
            typeof stats.legacyFormatSessions === "number"
              ? formatCompactNumber(stats.legacyFormatSessions)
              : "n/a"
          }
          icon={Monitor}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Tool Usage" icon={Wrench}>
          <KeyValueList entries={toolEntries} emptyLabel="No tool usage data." />
        </Section>

        <Section title="CLI Commands" icon={Terminal}>
          <KeyValueList entries={cliEntries} emptyLabel="No CLI command data." />
        </Section>
      </div>

      <Section title="Skills Inventory" icon={Code2}>
        {skills.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {skills.map((skill) => (
              <div
                key={skill.name}
                className="rounded-md border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/50"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="break-words text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {skill.name}
                    </div>
                    {skill.description && (
                      <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                        {skill.description}
                      </p>
                    )}
                  </div>
                  {typeof skill.calls === "number" && (
                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                      {formatCompactNumber(skill.calls)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            No skill inventory data.
          </p>
        )}
      </Section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Plugins" icon={Package}>
          {plugins.length > 0 ? (
            <div className="space-y-2">
              {plugins.map((plugin) => (
                <div
                  key={plugin.name}
                  className="flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/50"
                >
                  <span className="min-w-0 break-words font-mono text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {plugin.name}
                  </span>
                  {typeof plugin.enabled === "boolean" && (
                    <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                      {plugin.enabled ? "enabled" : "disabled"}
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              No plugin data.
            </p>
          )}
        </Section>

        <Section title="Safety And Rules" icon={ShieldCheck}>
          <div className="space-y-4 text-sm">
            {codexData.safety.approvalsReviewer && (
              <div>
                <div className="text-xs font-semibold uppercase text-slate-400">
                  Approvals reviewer
                </div>
                <div className="mt-1 text-slate-700 dark:text-slate-300">
                  {codexData.safety.approvalsReviewer}
                </div>
              </div>
            )}
            <TokenList label="Approval modes" items={codexData.safety.approvalModes} />
            <TokenList label="Trust levels" items={codexData.safety.trustLevels} />
            <TokenList label="Rules allowlist" items={codexData.safety.rulesAllowlist} />
          </div>
        </Section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Work Surfaces" icon={Monitor}>
          {desktopPresence.length > 0 ? (
            <div className="space-y-2">
              {desktopPresence.map((surface, index) => (
                <div
                  key={`${String(surface.tool ?? "surface")}-${index}`}
                  className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800/50"
                >
                  <div className="font-medium text-slate-800 dark:text-slate-200">
                    {typeof surface.tool === "string"
                      ? surface.tool
                      : `Surface ${index + 1}`}
                  </div>
                  {typeof surface.present === "boolean" && (
                    <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      {surface.present ? "Detected" : "Not detected"}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              No work surface data.
            </p>
          )}
        </Section>

        <Section title="Workflow Signal" icon={Wrench}>
          {hasWorkflowSignal ? (
            <div className="flex flex-wrap gap-1.5">
              {Object.keys(codexData.workflowData ?? {}).map((key) => (
                <span
                  key={key}
                  className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                >
                  {key}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              No workflow phase signal was detected in this Codex profile.
            </p>
          )}
        </Section>
      </div>
    </div>
  );
}

function TokenList({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <div className="text-xs font-semibold uppercase text-slate-400">
        {label}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {items.map((item) => (
          <span
            key={item}
            className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300"
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}
