---
name: insight-harness
description: Generate a privacy-preserving Codex harness profile from the last 30 days of local Codex activity. Summarizes tool usage, command patterns, skills, plugins, models, subagent usage, workspace patterns, and environment posture. Use when the user asks for "insight harness", "my codex setup", "codex harness report", "what skills do I use in Codex", or "show my Codex profile".
---

# Insight Harness

Generate a Codex-native harness report from local Codex data over the last 30 days.

This is the Codex equivalent of the Claude `insight-harness` skill, adapted to
Codex's actual local data model.

## What It Reads

The extractor uses a whitelist-only approach against:

- `~/.codex/sessions/**/*.jsonl`
- `~/.codex/skills/**/SKILL.md`
- `~/.codex/plugins/cache/**/.codex-plugin/plugin.json`
- `~/Coding/*` for file existence checks only

## Privacy Guarantees

What IS extracted:

- Tool names and counts
- Tool transition sequences (which tool follows which — tool names only, no arguments)
- Workflow phase classifications derived from tool names and command first-tokens
- Shell command program names only
- Skill names and how often their `SKILL.md` files were loaded
- Plugin manifests, versions, and bundled skill names
- Model, sandbox, approval, collaboration mode, and session metadata
- Subagent type/model metadata
- Counts of project instruction files such as `AGENTS.md`, `CLAUDE.md`, and `agent/HANDOFF.md`

What is NEVER retained in the report:

- Prompt text
- Assistant response text
- Full shell commands or arguments
- File contents from project repositories
- Tool outputs
- Secrets, tokens, env var values, or credentials

## Known Limits

- Current Codex session logs do not expose reliable token usage totals, so this
  report does not claim token consumption stats.
- Skill usage is inferred from `SKILL.md` loads, which is a strong proxy for
  actual use but not a perfect ground truth.

## Workflow Data

- **Workflow phases** — classifies tool usage into phases (exploration, implementation, testing, shipping, orchestration) and shows the distribution across sessions
- **Phase transitions** — tracks how you move between workflow phases (e.g., exploration -> implementation), with statistics on disciplined patterns like "test before ship"
- **Tool transitions** — tracks sequential tool usage patterns within turns (e.g., Read -> Edit), showing your most common tool flows

## How to Run

Run:

```bash
python3 ~/.codex/skills/insight-harness/scripts/extract.py
```

Optional flags:

```bash
python3 ~/.codex/skills/insight-harness/scripts/extract.py --days 30
python3 ~/.codex/skills/insight-harness/scripts/extract.py --output-dir /tmp
```

The script prints the generated HTML file path.

If the user wants it opened in a browser, open the generated file after
approval. Then report:

1. Where the file was saved
2. A short top-level summary
3. The main caveat that token totals are not currently available from Codex logs
