# Agent Directory — Wiring Notes

## File Roles

| File                     | Purpose                                                                      | Loaded                  |
| ------------------------ | ---------------------------------------------------------------------------- | ----------------------- |
| `/CLAUDE.md`             | Tiny constitution (project, commands, invariants, architecture, conventions) | Always (Claude Code)    |
| `/AGENTS.md`             | Open-standard agent guidance entry point                                     | On start                |
| `/agent/CONSTITUTION.md` | Tool-agnostic mirror of CLAUDE.md                                            | Inject for Codex/Gemini |
| `/agent/WORKFLOWS.md`    | Workflow policy — MUST read before starting work                             | On start                |
| `/agent/MEMORY.md`       | Append-only learnings from sessions                                          | Selectively loaded      |
| `/agent/LEARNINGS.md`    | Distilled promotions from MEMORY.md                                          | Selectively loaded      |
| `/agent/HANDOFF.md`      | Point-in-time session snapshot                                               | Read on session start   |

## Wiring by Tool

- **Claude Code:** `CLAUDE.md` is always loaded. Read `/agent/WORKFLOWS.md` and `/agent/HANDOFF.md` on session start (configured in `~/.claude/CLAUDE.md`).
- **Codex / Gemini:** Inject `/agent/CONSTITUTION.md` as system context. Retrieve `MEMORY.md` and `LEARNINGS.md` selectively when relevant.
- **HANDOFF.md:** Written by `/agent-handoff` command at end of session. Read on next session start for continuity.
