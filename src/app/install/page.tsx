import Link from "next/link";
import { ArrowLeft, Code2, Terminal, Upload } from "lucide-react";

const claudeInstallCommands = [
  "/plugin marketplace add kabirdos/insight-harness",
  "/plugin install insight-harness@kabirdos-insight-harness",
];

const codexInstallCommand = `mkdir -p ~/.codex/skills/insight-harness/scripts && \\
curl -sSL https://raw.githubusercontent.com/kabirdos/insight-harness/main/skills/insight-harness/SKILL.md \\
  -o ~/.codex/skills/insight-harness/SKILL.md && \\
curl -sSL https://raw.githubusercontent.com/kabirdos/insight-harness/main/skills/insight-harness/scripts/codex_extract.py \\
  -o ~/.codex/skills/insight-harness/scripts/codex_extract.py && \\
curl -sSL https://raw.githubusercontent.com/kabirdos/insight-harness/main/skills/insight-harness/scripts/pii_scrub.py \\
  -o ~/.codex/skills/insight-harness/scripts/pii_scrub.py && \\
curl -sSL https://raw.githubusercontent.com/kabirdos/insight-harness/main/skills/insight-harness/scripts/extract.py \\
  -o ~/.codex/skills/insight-harness/scripts/extract.py`;

function CommandBlock({ command }: { command: string }) {
  return (
    <pre className="overflow-x-auto rounded-lg bg-slate-950 p-4 text-xs leading-6 text-slate-100">
      <code>{command}</code>
    </pre>
  );
}

export default function InstallPage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <section className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Home
          </Link>
          <div className="mt-8 max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400">
              Insight Harness Skill
            </p>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">
              Publish a Claude Code or Codex harness profile.
            </h1>
            <p className="mt-4 text-base leading-7 text-slate-600 dark:text-slate-300">
              The skill generates a privacy-scrubbed HTML report from local
              agent logs. Claude Code can publish directly with a token. Codex
              currently generates an uploadable HTML file from local CLI logs.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-5xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
              <Code2 className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-bold">Claude Code</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Install from the Claude plugin marketplace.
              </p>
            </div>
          </div>
          <div className="space-y-3">
            {claudeInstallCommands.map((command) => (
              <CommandBlock key={command} command={command} />
            ))}
            <CommandBlock command="/insight-harness" />
          </div>
          <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">
            For direct publish, sign in on the upload page, generate a token,
            then run `/insight-harness --publish --token=ih_...`.
          </p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
              <Terminal className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-bold">Codex</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Install the skill under `~/.codex/skills`.
              </p>
            </div>
          </div>
          <div className="space-y-3">
            <CommandBlock command={codexInstallCommand} />
            <CommandBlock command="python3 ~/.codex/skills/insight-harness/scripts/codex_extract.py --include-skills" />
          </div>
          <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">
            The report is written under `~/.codex/usage-data/`. Upload the
            generated `*-codex-harness.html` file on the upload page.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 pb-12 sm:px-6">
        <div className="flex flex-col gap-3 rounded-lg border border-blue-200 bg-blue-50 p-5 dark:border-blue-900/60 dark:bg-blue-950/30 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-bold text-blue-950 dark:text-blue-100">
              Ready to share?
            </h2>
            <p className="mt-1 text-sm text-blue-900/80 dark:text-blue-100/80">
              Upload the generated HTML, preview redactions, then publish when
              it looks right.
            </p>
          </div>
          <Link
            href="/upload"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
          >
            <Upload className="h-4 w-4" />
            Upload Report
          </Link>
        </div>
      </section>
    </main>
  );
}
