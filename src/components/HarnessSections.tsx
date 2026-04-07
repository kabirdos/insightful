import type { HarnessData } from "@/types/insights";
import CollapsibleSection from "./CollapsibleSection";

interface HarnessSectionsProps {
  harnessData: HarnessData;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function BarChart({
  data,
  color = "bg-blue-500",
}: {
  data: Record<string, number>;
  color?: string;
}) {
  const entries = Object.entries(data)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12);
  if (entries.length === 0)
    return <p className="text-sm text-slate-400 italic">No data</p>;
  const max = entries[0][1];

  return (
    <div className="space-y-1.5">
      {entries.map(([label, value]) => (
        <div key={label} className="flex items-center gap-2">
          <div className="w-24 truncate text-xs font-mono text-slate-600 dark:text-slate-400">
            {label}
          </div>
          <div className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
            <div
              className={`h-full rounded-full ${color}`}
              style={{ width: `${Math.max(3, (value / max) * 100)}%` }}
            />
          </div>
          <div className="w-12 text-right text-xs font-mono text-slate-400">
            {formatNumber(value)}
          </div>
        </div>
      ))}
    </div>
  );
}

function DataTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: (string | number)[][];
}) {
  if (rows.length === 0)
    return <p className="text-sm text-slate-400 italic">None</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 dark:border-slate-700">
            {headers.map((h) => (
              <th
                key={h}
                className="pb-2 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-400"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              className="border-b border-slate-100 dark:border-slate-800"
            >
              {row.map((cell, j) => (
                <td
                  key={j}
                  className={`py-2 pr-4 text-slate-600 dark:text-slate-400 ${j === 0 ? "font-mono text-xs" : "text-xs"}`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PluginCards({ plugins }: { plugins: HarnessData["plugins"] }) {
  if (plugins.length === 0)
    return <p className="text-sm text-slate-400 italic">No plugins</p>;
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {plugins.map((p) => (
        <div
          key={p.name}
          className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/50"
        >
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs font-semibold text-slate-700 dark:text-slate-300">
              {p.name}
            </span>
            <span
              className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                p.active
                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                  : "bg-slate-100 text-slate-400 dark:bg-slate-800"
              }`}
            >
              {p.active ? "on" : "off"}
            </span>
          </div>
          {(p.version || p.marketplace) && (
            <div className="mt-0.5 text-[11px] text-slate-400">
              {p.version && `v${p.version}`}
              {p.version && p.marketplace && " · "}
              {p.marketplace}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function HarnessSections({ harnessData }: HarnessSectionsProps) {
  const {
    toolUsage,
    skillInventory,
    hookDefinitions,
    hookFrequency,
    plugins,
    harnessFiles,
    fileOpStyle,
    agentDispatch,
    cliTools,
    languages,
    models,
    permissionModes,
    mcpServers,
    gitPatterns,
    versions,
    writeupSections,
  } = harnessData;

  return (
    <div className="space-y-4">
      {/* Skills Inventory */}
      {skillInventory.length > 0 && (
        <CollapsibleSection
          icon=""
          title="Skills & Commands"
          defaultOpen={false}
        >
          <DataTable
            headers={["Skill", "Source", "Calls"]}
            rows={skillInventory.map((s) => [s.name, s.source, s.calls])}
          />
        </CollapsibleSection>
      )}

      {/* Tool Usage */}
      {Object.keys(toolUsage).length > 0 && (
        <CollapsibleSection icon="" title="Tool Usage" defaultOpen={false}>
          <BarChart data={toolUsage} color="bg-blue-500" />
        </CollapsibleSection>
      )}

      {/* Hooks */}
      {hookDefinitions.length > 0 && (
        <CollapsibleSection icon="" title="Hooks & Safety" defaultOpen={false}>
          <DataTable
            headers={["Event", "Matcher", "Script"]}
            rows={hookDefinitions.map((h) => [h.event, h.matcher, h.script])}
          />
          {Object.keys(hookFrequency).length > 0 && (
            <div className="mt-4">
              <h4 className="mb-2 text-xs font-semibold text-slate-500">
                Execution Frequency
              </h4>
              <BarChart data={hookFrequency} color="bg-amber-500" />
            </div>
          )}
        </CollapsibleSection>
      )}

      {/* Plugins */}
      {plugins.length > 0 && (
        <CollapsibleSection icon="" title="Plugins" defaultOpen={false}>
          <PluginCards plugins={plugins} />
        </CollapsibleSection>
      )}

      {/* File Operation Style */}
      {fileOpStyle.style && (
        <CollapsibleSection
          icon=""
          title="File Operation Style"
          defaultOpen={false}
        >
          <div className="flex flex-wrap gap-6">
            <div className="text-center">
              <div className="font-mono text-sm font-semibold text-slate-700 dark:text-slate-300">
                {fileOpStyle.readPct}:{fileOpStyle.editPct}:
                {fileOpStyle.writePct}
              </div>
              <div className="text-[10px] text-slate-400">
                Read : Edit : Write
              </div>
            </div>
            <div className="text-center">
              <div className="font-mono text-sm font-semibold text-slate-700 dark:text-slate-300">
                {fileOpStyle.grepCount}:{fileOpStyle.globCount}
              </div>
              <div className="text-[10px] text-slate-400">Grep : Glob</div>
            </div>
            <div className="text-center">
              <div className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                {fileOpStyle.style}
              </div>
              <div className="text-[10px] text-slate-400">Style</div>
            </div>
          </div>
        </CollapsibleSection>
      )}

      {/* Agent Dispatch */}
      {agentDispatch && agentDispatch.totalAgents > 0 && (
        <CollapsibleSection
          icon=""
          title={`Agent Dispatch (${agentDispatch.totalAgents} agents)`}
          defaultOpen={false}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            {Object.keys(agentDispatch.types).length > 0 && (
              <div>
                <h4 className="mb-2 text-xs font-semibold text-slate-500">
                  Agent Types
                </h4>
                <BarChart data={agentDispatch.types} color="bg-indigo-500" />
              </div>
            )}
            {Object.keys(agentDispatch.models).length > 0 && (
              <div>
                <h4 className="mb-2 text-xs font-semibold text-slate-500">
                  Model Tiering
                </h4>
                <BarChart data={agentDispatch.models} color="bg-purple-500" />
                {agentDispatch.backgroundPct > 0 && (
                  <p className="mt-1 text-xs text-slate-400">
                    {agentDispatch.backgroundPct}% run in background
                  </p>
                )}
              </div>
            )}
          </div>
          {agentDispatch.customAgents.length > 0 && (
            <div className="mt-3">
              <h4 className="mb-1 text-xs font-semibold text-slate-500">
                Custom Agents
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {agentDispatch.customAgents.map((a) => (
                  <span
                    key={a}
                    className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-400"
                  >
                    {a}
                  </span>
                ))}
              </div>
            </div>
          )}
        </CollapsibleSection>
      )}

      {/* CLI Tools */}
      {Object.keys(cliTools).length > 0 && (
        <CollapsibleSection icon="" title="CLI Tools" defaultOpen={false}>
          <BarChart data={cliTools} color="bg-teal-500" />
        </CollapsibleSection>
      )}

      {/* Languages & Models side by side */}
      {(Object.keys(languages).length > 0 ||
        Object.keys(models).length > 0) && (
        <CollapsibleSection
          icon=""
          title="Languages & Models"
          defaultOpen={false}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            {Object.keys(languages).length > 0 && (
              <div>
                <h4 className="mb-2 text-xs font-semibold text-slate-500">
                  Languages
                </h4>
                <BarChart data={languages} color="bg-green-500" />
              </div>
            )}
            {Object.keys(models).length > 0 && (
              <div>
                <h4 className="mb-2 text-xs font-semibold text-slate-500">
                  Models
                </h4>
                <BarChart data={models} color="bg-purple-500" />
              </div>
            )}
          </div>
        </CollapsibleSection>
      )}

      {/* Permission Modes & MCP */}
      {(Object.keys(permissionModes).length > 0 ||
        Object.keys(mcpServers).length > 0) && (
        <CollapsibleSection
          icon=""
          title="Permissions & MCP"
          defaultOpen={false}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            {Object.keys(permissionModes).length > 0 && (
              <div>
                <h4 className="mb-2 text-xs font-semibold text-slate-500">
                  Permission Modes
                </h4>
                {Object.entries(permissionModes)
                  .sort((a, b) => b[1] - a[1])
                  .map(([mode, pct]) => (
                    <div
                      key={mode}
                      className="flex justify-between border-b border-slate-100 py-1 dark:border-slate-800"
                    >
                      <span className="font-mono text-xs text-slate-600 dark:text-slate-400">
                        {mode}
                      </span>
                      <span className="text-xs text-slate-400">{pct}%</span>
                    </div>
                  ))}
              </div>
            )}
            {Object.keys(mcpServers).length > 0 && (
              <div>
                <h4 className="mb-2 text-xs font-semibold text-slate-500">
                  MCP Servers
                </h4>
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
                        {formatNumber(calls)} calls
                      </span>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </CollapsibleSection>
      )}

      {/* Git Patterns */}
      {(gitPatterns.prCount > 0 || gitPatterns.commitCount > 0) && (
        <CollapsibleSection icon="" title="Git Patterns" defaultOpen={false}>
          <div className="mb-3 flex flex-wrap gap-4 text-sm text-slate-600 dark:text-slate-400">
            <span>
              <strong className="text-slate-900 dark:text-slate-100">
                {gitPatterns.prCount}
              </strong>{" "}
              PRs
            </span>
            <span>
              <strong className="text-slate-900 dark:text-slate-100">
                {gitPatterns.commitCount}
              </strong>{" "}
              commits
            </span>
            {gitPatterns.linesAdded !== "0" && (
              <span>
                <strong className="text-slate-900 dark:text-slate-100">
                  {gitPatterns.linesAdded}
                </strong>{" "}
                lines added
              </span>
            )}
          </div>
          {Object.keys(gitPatterns.branchPrefixes).length > 0 && (
            <div>
              <h4 className="mb-1 text-xs font-semibold text-slate-500">
                Branch Conventions
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(gitPatterns.branchPrefixes)
                  .sort((a, b) => b[1] - a[1])
                  .map(([prefix, count]) => (
                    <span
                      key={prefix}
                      className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-400"
                    >
                      {prefix} ({count})
                    </span>
                  ))}
              </div>
            </div>
          )}
        </CollapsibleSection>
      )}

      {/* Harness Files */}
      {harnessFiles.length > 0 && (
        <CollapsibleSection
          icon=""
          title="Harness File Ecosystem"
          defaultOpen={false}
        >
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
        </CollapsibleSection>
      )}

      {/* Versions */}
      {versions.length > 0 && (
        <CollapsibleSection
          icon=""
          title="Claude Code Versions"
          defaultOpen={false}
        >
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
        </CollapsibleSection>
      )}

      {/* Writeup Sections */}
      {writeupSections.length > 0 && (
        <CollapsibleSection
          icon=""
          title="Writeup Analysis"
          defaultOpen={false}
        >
          <div className="space-y-6">
            {writeupSections.map((section) => (
              <div key={section.title}>
                <h4 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                  {section.title}
                </h4>
                <div
                  className="prose prose-sm max-w-none text-slate-600 dark:text-slate-400 [&_p]:mb-2 [&_li]:mb-1 [&_.tip]:rounded-r-lg [&_.tip]:border-l-[3px] [&_.tip]:border-blue-500 [&_.tip]:bg-blue-50 [&_.tip]:p-3 [&_.tip]:text-sm [&_.tip]:text-blue-700 dark:[&_.tip]:bg-blue-950/30 dark:[&_.tip]:text-blue-400"
                  dangerouslySetInnerHTML={{ __html: section.contentHtml }}
                />
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}
    </div>
  );
}
