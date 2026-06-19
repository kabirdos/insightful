"use client";

import type { HarnessData } from "@/types/insights";
import { filterList, filterRecord } from "@/lib/item-visibility";
import CollapsibleSection from "@/components/CollapsibleSection";
import ToolUsageTreemap from "@/components/ToolUsageTreemap";
import CliToolsDonut from "@/components/CliToolsDonut";
import MiniBarChart from "@/components/MiniBarChart";

interface TechnicalDetailSectionProps {
  harnessData: HarnessData;
  hiddenSet: Set<string>;
}

/**
 * The six low-signal-for-humans, high-signal-for-agents sections — tool usage,
 * CLI commands, MCP servers, languages, versions, and harness files — collapsed
 * into a single closed disclosure at the bottom of the Dashboard.
 *
 * The full data still ships to agents via the profile's machine-readable JSON
 * payload, so nothing is lost by hiding it from the default human scroll. The
 * per-section visibility flags (hide/strip pipeline) and per-item filters are
 * preserved exactly — this is a presentational regrouping, not a model change.
 *
 * Renders nothing when every inner section is hidden or empty, so an empty
 * disclosure never appears.
 */
export default function TechnicalDetailSection({
  harnessData,
  hiddenSet,
}: TechnicalDetailSectionProps) {
  // Filter once, then drive both the empty-state guard and rendering off the
  // filtered results. filterRecord/filterList already return empty when the
  // whole section is hidden, so this also covers section-level hides. Using
  // filtered (not raw) lengths means a section whose every item is individually
  // hidden contributes no empty chrome, and an all-hidden disclosure never
  // appears at all.
  const toolUsage = filterRecord(harnessData.toolUsage, hiddenSet, "toolUsage");
  const cliTools = filterRecord(harnessData.cliTools, hiddenSet, "cliTools");
  const languages = filterRecord(harnessData.languages, hiddenSet, "languages");
  const mcpServers = filterRecord(
    harnessData.mcpServers,
    hiddenSet,
    "mcpServers",
  );
  const versions = filterList(
    harnessData.versions,
    hiddenSet,
    "versions",
    (v) => v,
  );
  const harnessFiles = filterList(
    harnessData.harnessFiles,
    hiddenSet,
    "harnessFiles",
    (f) => f,
  );

  const showToolUsage = Object.keys(toolUsage).length > 0;
  const showCliTools = Object.keys(cliTools).length > 0;
  const showLanguages = Object.keys(languages).length > 0;
  const showMcp = Object.keys(mcpServers).length > 0;
  const showVersions = versions.length > 0;
  const showHarnessFiles = harnessFiles.length > 0;

  const hasAny =
    showToolUsage ||
    showCliTools ||
    showLanguages ||
    showMcp ||
    showVersions ||
    showHarnessFiles;

  if (!hasAny) return null;

  return (
    <CollapsibleSection
      icon="🔧"
      iconBgClass="bg-slate-100 dark:bg-slate-800"
      title="Full technical detail"
      summary="Tool usage, CLI commands, MCP servers, languages, versions, and harness files — also available to agents via this profile's JSON payload."
      defaultOpen={false}
    >
      <div className="space-y-6">
        {showToolUsage && <ToolUsageTreemap toolUsage={toolUsage} />}

        {showCliTools && <CliToolsDonut cliTools={cliTools} />}

        {showLanguages && (
          <div>
            <h4 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
              Languages
            </h4>
            <MiniBarChart
              data={Object.entries(languages)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 12)
                .map(([label, value]) => ({ label, value }))}
              title=""
              color="bg-green-500"
            />
          </div>
        )}

        {showMcp && (
          <div>
            <h4 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
              MCP Servers
            </h4>
            <div className="space-y-1">
              {Object.entries(mcpServers)
                .sort((a, b) => b[1] - a[1])
                .map(([server, calls]) => (
                  <div
                    key={server}
                    className="flex justify-between border-b border-slate-100 py-1 dark:border-slate-800"
                  >
                    <span className="font-mono text-xs text-slate-600 dark:text-slate-400">
                      {server}
                    </span>
                    <span className="text-xs text-slate-400">
                      {calls.toLocaleString()} calls
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )}

        {showVersions && (
          <div>
            <h4 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
              Claude Code Versions
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {versions.map((v) => (
                <span
                  key={v}
                  className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-400"
                >
                  {v}
                </span>
              ))}
            </div>
          </div>
        )}

        {showHarnessFiles && (
          <div>
            <h4 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
              Harness File Ecosystem
            </h4>
            <div className="space-y-1">
              {harnessFiles.map((f) => (
                <div
                  key={f}
                  className="border-b border-slate-100 py-1 font-mono text-xs text-slate-600 dark:border-slate-800 dark:text-slate-400"
                >
                  {f}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </CollapsibleSection>
  );
}
