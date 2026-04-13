// Renders a user's "developer setup" fields on their public profile.
// Short-circuits to null when the blob has no user-visible content.
// See docs/plans/2026-04-13-profile-setup-fields.md §6.

import Link from "next/link";
import {
  Monitor,
  Cpu,
  Keyboard,
  Code,
  TerminalSquare,
  Sparkles,
  Package,
  Globe,
} from "lucide-react";

function GithubGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="currentColor"
      aria-hidden
    >
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
    </svg>
  );
}
import type { ProfileSetup } from "@/types/profile";

interface SetupCardProps {
  setup: ProfileSetup | null | undefined;
}

type IconComponent = typeof Monitor;

interface SetupRow {
  key: keyof ProfileSetup;
  label: string;
  icon?: IconComponent;
  value: string | string[] | undefined;
}

interface SetupGroup {
  title: string;
  rows: SetupRow[];
}

function buildGroups(setup: ProfileSetup): SetupGroup[] {
  return [
    {
      title: "Hardware",
      rows: [
        { key: "os", label: "OS", icon: Monitor, value: setup.os },
        { key: "machine", label: "Machine", icon: Cpu, value: setup.machine },
        {
          key: "keyboard",
          label: "Keyboard",
          icon: Keyboard,
          value: setup.keyboard,
        },
      ],
    },
    {
      title: "Editor & Terminal",
      rows: [
        { key: "editor", label: "Editor", icon: Code, value: setup.editor },
        {
          key: "terminal",
          label: "Terminal",
          icon: TerminalSquare,
          value: setup.terminal,
        },
        { key: "shell", label: "Shell", value: setup.shell },
      ],
    },
    {
      title: "AI Stack",
      rows: [
        {
          key: "primaryAgent",
          label: "Primary agent",
          icon: Sparkles,
          value: setup.primaryAgent,
        },
        {
          key: "primaryModel",
          label: "Primary model",
          value: setup.primaryModel,
        },
        {
          key: "mcpServers",
          label: "MCP servers",
          value: setup.mcpServers,
        },
      ],
    },
    {
      title: "Workflow",
      rows: [
        {
          key: "packageManager",
          label: "Package manager",
          icon: Package,
          value: setup.packageManager,
        },
        {
          key: "dotfilesUrl",
          label: "Dotfiles",
          value: setup.dotfilesUrl,
        },
      ],
    },
  ];
}

function hasValue(v: string | string[] | undefined): boolean {
  if (!v) return false;
  if (Array.isArray(v)) return v.length > 0;
  return v.trim().length > 0;
}

function renderValue(row: SetupRow) {
  const { key, value } = row;
  if (key === "mcpServers" && Array.isArray(value)) {
    return (
      <div className="flex flex-wrap gap-1.5">
        {value.map((name) => (
          <span
            key={name}
            className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300"
          >
            {name}
          </span>
        ))}
      </div>
    );
  }
  if (key === "dotfilesUrl" && typeof value === "string") {
    const isGithub = value.includes("github.com");
    return (
      <Link
        href={value}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline dark:text-blue-400"
      >
        {isGithub ? (
          <GithubGlyph className="h-3.5 w-3.5" />
        ) : (
          <Globe className="h-3.5 w-3.5" />
        )}
        <span className="font-mono text-xs">
          {value.replace(/^https?:\/\//, "")}
        </span>
      </Link>
    );
  }
  return <span className="text-slate-800 dark:text-slate-200">{value}</span>;
}

export default function SetupCard({ setup }: SetupCardProps) {
  if (!setup) return null;

  const groups = buildGroups(setup)
    .map((g) => ({ ...g, rows: g.rows.filter((r) => hasValue(r.value)) }))
    .filter((g) => g.rows.length > 0);

  if (groups.length === 0) return null;

  return (
    <section
      aria-label="Developer setup"
      className="mb-8 rounded-lg border border-slate-200 bg-white px-5 py-4 dark:border-slate-700 dark:bg-slate-900/40"
    >
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        Setup
      </h2>
      <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
        {groups.map((group) => (
          <div key={group.title}>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
              {group.title}
            </h3>
            <dl className="space-y-1.5">
              {group.rows.map((row) => {
                const Icon = row.icon;
                return (
                  <div
                    key={row.key}
                    className="grid grid-cols-[110px_1fr] items-start gap-3 text-sm"
                  >
                    <dt className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                      {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
                      <span>{row.label}</span>
                    </dt>
                    <dd className="min-w-0">{renderValue(row)}</dd>
                  </div>
                );
              })}
            </dl>
          </div>
        ))}
      </div>
    </section>
  );
}
