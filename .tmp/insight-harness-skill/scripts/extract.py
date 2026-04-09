#!/usr/bin/env python3
"""
Codex insight-harness extractor.

This script builds a privacy-preserving Codex harness report from local Codex
artifacts. It intentionally uses a whitelist-only approach and never emits raw
prompt text, assistant text, tool outputs, or full shell commands.
"""

from __future__ import annotations

import argparse
import hashlib
import html
import json
import os
import re
from collections import Counter
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any


CODEX_DIR = Path.home() / ".codex"
SESSIONS_DIR = CODEX_DIR / "sessions"
SKILLS_DIR = CODEX_DIR / "skills"
PLUGINS_CACHE_DIR = CODEX_DIR / "plugins" / "cache"
DEFAULT_OUTPUT_DIR = CODEX_DIR / "usage-data"
CODING_DIR = Path.home() / "Coding"

SKILL_PATH_RE = re.compile(
    r"(/Users/[^'\"]+?/.codex/(?:skills/[^/\s]+|plugins/cache/[^/\s]+/[^/\s]+/[^/\s]+/skills/[^/\s]+)/SKILL\.md)"
)
ENV_ASSIGN_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*=")


@dataclass
class SkillEntry:
    name: str
    source: str
    description: str
    loads: int


def he(value: Any) -> str:
    return html.escape(str(value), quote=True)


def safe_read_text(path: Path) -> str | None:
    try:
        return path.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return None


def safe_json_load(path: Path) -> Any:
    text = safe_read_text(path)
    if text is None:
        return None
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return None


def parse_json_arg(raw: Any) -> dict[str, Any]:
    if isinstance(raw, dict):
        return raw
    if not isinstance(raw, str) or not raw.strip():
        return {}
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return {}
    return data if isinstance(data, dict) else {}


def parse_dt(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def extract_program_name(command: str | list[Any]) -> str | None:
    if isinstance(command, list):
        if not command:
            return None
        token = str(command[0]).strip()
        if token in {"bash", "sh", "zsh"} and len(command) >= 3:
            token = str(command[2]).strip().split()[0] if str(command[2]).strip() else token
        return os.path.basename(token) if token else None

    if not isinstance(command, str):
        return None

    for line in command.splitlines():
        stripped = line.strip()
        if stripped and not stripped.startswith("#"):
            tokens = stripped.split()
            break
    else:
        return None

    while tokens and ENV_ASSIGN_RE.match(tokens[0]):
        tokens = tokens[1:]

    if not tokens:
        return None

    token = tokens[0]
    if token.startswith("/"):
        return os.path.basename(token)
    return token


def parse_frontmatter(path: Path) -> dict[str, str] | None:
    text = safe_read_text(path)
    if not text or not text.startswith("---"):
        return None
    end = text.find("---", 3)
    if end == -1:
        return None
    meta: dict[str, str] = {}
    for line in text[3:end].splitlines():
        if ":" not in line:
            continue
        key, _, value = line.partition(":")
        meta[key.strip()] = value.strip().strip('"').strip("'")
    if "name" not in meta:
        meta["name"] = path.parent.name
    meta.setdefault("description", "")
    return meta


def load_installed_skills() -> dict[str, SkillEntry]:
    result: dict[str, SkillEntry] = {}

    for skill_file in SKILLS_DIR.glob("*/SKILL.md"):
        meta = parse_frontmatter(skill_file)
        if not meta:
            continue
        source = "system" if skill_file.parent.parent.name == ".system" else "core"
        result[meta["name"]] = SkillEntry(
            name=meta["name"],
            source=source,
            description=meta.get("description", "")[:160],
            loads=0,
        )

    for skill_file in PLUGINS_CACHE_DIR.glob("*/*/*/skills/*/SKILL.md"):
        meta = parse_frontmatter(skill_file)
        if not meta:
            continue
        parts = skill_file.parts
        plugin_name = parts[-4]
        display_name = f"{plugin_name}:{meta['name']}"
        result[display_name] = SkillEntry(
            name=display_name,
            source="plugin",
            description=meta.get("description", "")[:160],
            loads=0,
        )

    return result


def load_plugins() -> list[dict[str, str]]:
    plugins: list[dict[str, str]] = []
    for manifest in PLUGINS_CACHE_DIR.glob("*/*/*/.codex-plugin/plugin.json"):
        data = safe_json_load(manifest)
        if not isinstance(data, dict):
            continue
        plugins.append(
            {
                "name": str(data.get("name", manifest.parent.parent.name)),
                "version": str(data.get("version", "")),
                "description": str(data.get("description", ""))[:200],
                "display_name": str(
                    data.get("interface", {}).get("displayName", data.get("name", ""))
                ),
            }
        )
    plugins.sort(key=lambda item: item["name"])
    return plugins


def analyze_project_ecosystem() -> dict[str, int]:
    counts = {
        "projects": 0,
        "agents_md": 0,
        "claude_md": 0,
        "handoff": 0,
        "workflows": 0,
        "memory": 0,
    }
    if not CODING_DIR.exists():
        return counts

    for path in CODING_DIR.iterdir():
        if not path.is_dir() or path.name.startswith("."):
            continue
        counts["projects"] += 1
        if (path / "AGENTS.md").exists():
            counts["agents_md"] += 1
        if (path / "CLAUDE.md").exists():
            counts["claude_md"] += 1
        if (path / "agent" / "HANDOFF.md").exists():
            counts["handoff"] += 1
        if (path / "agent" / "WORKFLOWS.md").exists():
            counts["workflows"] += 1
        if (path / "agent" / "MEMORY.md").exists():
            counts["memory"] += 1
    return counts


def session_is_recent(path: Path, cutoff: datetime) -> bool:
    try:
        mtime = datetime.fromtimestamp(path.stat().st_mtime, tz=timezone.utc)
    except OSError:
        return False
    return mtime >= cutoff


def normalize_skill_path(path_str: str) -> str | None:
    path = Path(path_str)
    parts = path.parts
    if "plugins" in parts and "skills" in parts:
        try:
            plugin_name = parts[parts.index("cache") + 2]
            skill_name = parts[parts.index("skills") + 1]
            return f"{plugin_name}:{skill_name}"
        except (ValueError, IndexError):
            return None
    if "skills" in parts:
        try:
            return parts[parts.index("skills") + 1]
        except (ValueError, IndexError):
            return None
    return None


def process_command_for_skills(command: str | list[Any], skill_loads: Counter[str]) -> str | None:
    command_name = extract_program_name(command)
    if isinstance(command, list):
        text = " ".join(str(item) for item in command)
    else:
        text = command or ""
    for match in SKILL_PATH_RE.findall(text):
        skill_name = normalize_skill_path(match)
        if skill_name:
            skill_loads[skill_name] += 1
    return command_name


def _classify_tool_phase(tool_name: str, cmd_name: str | None = None) -> str:
    """Classify a tool call into a workflow phase.

    PRIVACY: Only read tool name — never read tool arguments
    except for shell commands (first token only via extract_program_name)

    Phases:
    - exploration: Read, Grep, Glob, WebSearch, WebFetch, curl, wget
    - implementation: Edit, Write, NotebookEdit, npm/npx/node/bun/pnpm/docker (non-test)
    - testing: Bash with test commands (pytest, jest, vitest, etc.)
    - shipping: Bash with git/gh commands
    - orchestration: Agent, Skill, TaskCreate, TaskUpdate
    - other: everything else (Bash with non-classified commands, etc.)
    """
    EXPLORATION_TOOLS = {"Read", "Grep", "Glob", "WebSearch", "WebFetch", "ToolSearch"}
    IMPLEMENTATION_TOOLS = {"Edit", "Write", "NotebookEdit"}
    ORCHESTRATION_TOOLS = {"Agent", "Skill", "TaskCreate", "TaskUpdate", "EnterPlanMode"}
    TEST_COMMANDS = {"pytest", "jest", "vitest", "mocha", "rspec", "test", "cargo"}
    SHIP_COMMANDS = {"git", "gh"}
    IMPL_COMMANDS = {"npm", "npx", "node", "bun", "pnpm", "docker", "docker-compose"}
    EXPLORE_COMMANDS = {"curl", "wget"}

    if tool_name in EXPLORATION_TOOLS:
        return "exploration"
    if tool_name in IMPLEMENTATION_TOOLS:
        return "implementation"
    if tool_name in ORCHESTRATION_TOOLS:
        return "orchestration"
    if tool_name == "Bash" and cmd_name:
        if cmd_name in TEST_COMMANDS:
            return "testing"
        if cmd_name in SHIP_COMMANDS:
            return "shipping"
        if cmd_name in EXPLORE_COMMANDS:
            return "exploration"
        if cmd_name in IMPL_COMMANDS:
            return "implementation"
    return "other"


def collect_report_data(days: int) -> dict[str, Any]:
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)

    tool_usage: Counter[str] = Counter()
    command_usage: Counter[str] = Counter()
    skill_loads: Counter[str] = Counter()
    mcp_servers: Counter[str] = Counter()
    spawn_agent_types: Counter[str] = Counter()
    spawn_agent_models: Counter[str] = Counter()
    sandbox_modes: Counter[str] = Counter()
    approval_policies: Counter[str] = Counter()
    collaboration_modes: Counter[str] = Counter()
    models: Counter[str] = Counter()
    originators: Counter[str] = Counter()
    cli_versions: Counter[str] = Counter()
    phases: Counter[str] = Counter()
    project_fingerprints: set[str] = set()
    active_days: set[str] = set()

    # Skill invocation tracking (from Skill tool calls)
    skill_invocations: Counter[str] = Counter()
    session_skill_sequences: list[list[str]] = []
    # Agent dispatch tracking (from Agent tool calls)
    agent_dispatches: Counter[str] = Counter()

    # Phase transition tracking
    phase_transitions: Counter[str] = Counter()
    prev_phase_in_turn: str | None = None
    phase_call_counts: Counter[str] = Counter()
    session_phase_sequences: list[list[str]] = []

    user_messages = 0
    agent_messages = 0
    reasoning_items = 0
    plan_updates = 0
    images_viewed = 0
    spawn_agent_total = 0
    sessions_scanned = 0
    first_seen: datetime | None = None
    last_seen: datetime | None = None

    for session_file in SESSIONS_DIR.rglob("*.jsonl"):
        if not session_is_recent(session_file, cutoff):
            continue

        sessions_scanned += 1
        session_seen_at: datetime | None = None
        session_phases_seen: list[str] = []
        session_skills_seen: list[str] = []

        try:
            handle = session_file.open(encoding="utf-8", errors="replace")
        except OSError:
            continue

        with handle:
            for line in handle:
                try:
                    record = json.loads(line)
                except json.JSONDecodeError:
                    continue

                if record.get("type") == "session_meta":
                    payload = record.get("payload", {})
                    if isinstance(payload, dict):
                        session_seen_at = parse_dt(str(payload.get("timestamp", ""))) or session_seen_at
                        originators[str(payload.get("originator", "unknown"))] += 1
                        cli_versions[str(payload.get("cli_version", "unknown"))] += 1
                        cwd = str(payload.get("cwd", ""))
                        if cwd:
                            project_fingerprints.add(hashlib.sha256(cwd.encode()).hexdigest()[:12])

                ts = parse_dt(str(record.get("timestamp", ""))) or session_seen_at
                if ts:
                    active_days.add(ts.date().isoformat())
                    first_seen = ts if first_seen is None or ts < first_seen else first_seen
                    last_seen = ts if last_seen is None or ts > last_seen else last_seen

                record_type = str(record.get("type", ""))
                payload = record.get("payload", {}) if isinstance(record.get("payload"), dict) else {}

                if record_type == "turn_context":
                    sandbox = payload.get("sandbox_policy", {})
                    if isinstance(sandbox, dict):
                        sandbox_modes[str(sandbox.get("type", "unknown"))] += 1
                    approval_policies[str(payload.get("approval_policy", "unknown"))] += 1
                    collaboration = payload.get("collaboration_mode", {})
                    if isinstance(collaboration, dict):
                        collaboration_modes[str(collaboration.get("mode", "unknown"))] += 1
                    models[str(payload.get("model", "unknown"))] += 1
                    cwd = str(payload.get("cwd", ""))
                    if cwd:
                        project_fingerprints.add(hashlib.sha256(cwd.encode()).hexdigest()[:12])
                    continue

                if record_type == "event_msg":
                    event_type = str(payload.get("type", ""))
                    if event_type == "user_message":
                        user_messages += 1
                        prev_phase_in_turn = None
                    elif event_type == "agent_message":
                        agent_messages += 1
                        phases[str(payload.get("phase", "unknown"))] += 1
                    elif event_type == "task_started":
                        collaboration_modes[str(payload.get("collaboration_mode_kind", "default"))] += 1
                    continue

                item = payload if record_type == "response_item" else record
                item_type = str(item.get("type", ""))

                if item_type == "reasoning":
                    reasoning_items += 1
                    continue

                if item_type != "function_call":
                    continue

                name = str(item.get("name", "unknown"))
                tool_usage[name] += 1

                args = parse_json_arg(item.get("arguments"))

                # Skill invocation tracking (Skill tool -> input.skill)
                if name == "Skill":
                    skill_name = str(args.get("skill", "")).strip()
                    if skill_name:
                        skill_invocations[skill_name] += 1
                        session_skills_seen.append(skill_name)

                # Agent dispatch tracking (Agent tool -> input.description)
                if name == "Agent":
                    desc = str(args.get("description", "")).strip()[:60]
                    if desc:
                        agent_dispatches[desc] += 1

                if name == "exec_command":
                    command_name = process_command_for_skills(args.get("cmd"), skill_loads)
                    if command_name:
                        command_usage[command_name] += 1
                elif name == "shell_command":
                    command_name = process_command_for_skills(args.get("command"), skill_loads)
                    if command_name:
                        command_usage[command_name] += 1
                elif name == "shell":
                    command_name = process_command_for_skills(args.get("command"), skill_loads)
                    if command_name:
                        command_usage[command_name] += 1
                elif name == "view_image":
                    images_viewed += 1
                elif name == "update_plan":
                    plan_updates += 1
                elif name == "spawn_agent":
                    spawn_agent_total += 1
                    spawn_agent_types[str(args.get("agent_type", "default"))] += 1
                    spawn_agent_models[str(args.get("model", "inherit"))] += 1

                if name.startswith("mcp__"):
                    parts = name.split("__")
                    if len(parts) >= 2:
                        mcp_servers[parts[1]] += 1

                # Phase classification
                _cmd_name_for_phase: str | None = None
                if name in {"exec_command", "shell_command", "shell"}:
                    _cmd_name_for_phase = extract_program_name(
                        args.get("cmd") or args.get("command") or ""
                    )
                current_phase = _classify_tool_phase(name, _cmd_name_for_phase)
                phase_call_counts[current_phase] += 1

                if prev_phase_in_turn is not None and prev_phase_in_turn != current_phase:
                    phase_transitions[f"{prev_phase_in_turn}->{current_phase}"] += 1
                prev_phase_in_turn = current_phase

                if not session_phases_seen or session_phases_seen[-1] != current_phase:
                    session_phases_seen.append(current_phase)

        if session_phases_seen:
            session_phase_sequences.append(session_phases_seen)
        if session_skills_seen:
            session_skill_sequences.append(session_skills_seen)

    installed_skills = load_installed_skills()
    for skill_name, count in skill_loads.items():
        if skill_name in installed_skills:
            installed_skills[skill_name].loads = count
        else:
            installed_skills[skill_name] = SkillEntry(
                name=skill_name,
                source="unknown",
                description="Loaded from session history",
                loads=count,
            )

    skill_inventory = sorted(
        installed_skills.values(),
        key=lambda item: (-item.loads, item.name.lower()),
    )

    plugins = load_plugins()
    ecosystem = analyze_project_ecosystem()

    # Phase statistics
    total_phase_calls = sum(phase_call_counts.values()) or 1
    phase_pcts = {k: round(v / total_phase_calls * 100) for k, v in phase_call_counts.most_common()}

    sessions_that_test_before_ship = 0
    sessions_that_explore_before_implement = 0
    for seq in session_phase_sequences:
        if "testing" in seq and "shipping" in seq:
            if seq.index("testing") < seq.index("shipping"):
                sessions_that_test_before_ship += 1
        if "exploration" in seq and "implementation" in seq:
            if seq.index("exploration") < seq.index("implementation"):
                sessions_that_explore_before_implement += 1

    total_with_phases = len(session_phase_sequences) or 1
    test_before_ship_pct = round(sessions_that_test_before_ship / total_with_phases * 100)
    explore_before_impl_pct = round(sessions_that_explore_before_implement / total_with_phases * 100)

    tool_calls_total = sum(tool_usage.values())
    autonomy_ratio = round(user_messages / agent_messages, 3) if agent_messages else 0.0

    if autonomy_ratio <= 0.18 and spawn_agent_total > 0:
        autonomy_label = "Fire-and-Forget"
        autonomy_desc = "Long autonomous runs with low user interruption and visible delegation."
    elif autonomy_ratio <= 0.45:
        autonomy_label = "Directive"
        autonomy_desc = "You steer Codex with short interventions while it carries the execution."
    else:
        autonomy_label = "Collaborative"
        autonomy_desc = "The work pattern is back-and-forth with frequent user steering."

    summary = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "days": days,
        "sessions_scanned": sessions_scanned,
        "active_days": len(active_days),
        "projects_touched": len(project_fingerprints),
        "tool_calls_total": tool_calls_total,
        "installed_skills": len(skill_inventory),
        "loaded_skills": sum(1 for entry in skill_inventory if entry.loads > 0),
        "plugins": len(plugins),
        "spawn_agent_total": spawn_agent_total,
        "plan_updates": plan_updates,
        "images_viewed": images_viewed,
        "user_messages": user_messages,
        "agent_messages": agent_messages,
        "reasoning_items": reasoning_items,
        "first_seen": first_seen.isoformat() if first_seen else "",
        "last_seen": last_seen.isoformat() if last_seen else "",
        "autonomy_label": autonomy_label,
    }
    integrity_hash = hashlib.sha256(
        json.dumps(summary, sort_keys=True).encode("utf-8")
    ).hexdigest()

    return {
        "summary": summary,
        "integrity_hash": integrity_hash,
        "autonomy": {
            "label": autonomy_label,
            "description": autonomy_desc,
            "ratio": autonomy_ratio,
        },
        "tool_usage": dict(tool_usage.most_common(20)),
        "command_usage": dict(command_usage.most_common(20)),
        "skill_inventory": skill_inventory,
        "plugins": plugins,
        "spawn_agent_types": dict(spawn_agent_types.most_common(10)),
        "spawn_agent_models": dict(spawn_agent_models.most_common(10)),
        "sandbox_modes": dict(sandbox_modes),
        "approval_policies": dict(approval_policies),
        "collaboration_modes": dict(collaboration_modes),
        "models": dict(models.most_common(10)),
        "originators": dict(originators.most_common(10)),
        "cli_versions": dict(cli_versions.most_common(10)),
        "agent_message_phases": dict(phases),
        "mcp_servers": dict(mcp_servers.most_common(10)),
        "ecosystem": ecosystem,
        # Tool transitions (top 30 most common A->B pairs)
        # Skill invocations (top 20 most common skill names)
        "skill_invocations": dict(skill_invocations.most_common(20)),
        # Agent dispatches (top 15 most common dispatch descriptions)
        "agent_dispatches": dict(agent_dispatches.most_common(15)),
        # Workflow patterns (top 10 most common skill sequences)
        "workflow_patterns": _compute_workflow_patterns(session_skill_sequences),
        # Phase transitions (top 20 most common phase->phase pairs)
        "phase_transitions": dict(phase_transitions.most_common(20)),
        # Phase call distribution (percentage per phase)
        "phase_distribution": phase_pcts,
        # Phase pattern stats
        "phase_stats": {
            "test_before_ship_pct": test_before_ship_pct,
            "explore_before_impl_pct": explore_before_impl_pct,
            "total_sessions_with_phases": len(session_phase_sequences),
        },
    }


def _render_workflow_patterns(patterns: list[dict[str, Any]]) -> str:
    """Render workflow patterns as HTML list items."""
    if not patterns:
        return '<p class="empty">No patterns detected</p>'
    rows: list[str] = []
    for pat in patterns:
        seq = pat.get("sequence", [])
        count = pat.get("count", 0)
        label = " &rarr; ".join(he(s) for s in seq)
        rows.append(
            f'<div class="bar-row">'
            f'<div class="bar-label">{label}</div>'
            f'<div class="bar-value">{count}</div>'
            f'</div>'
        )
    return "\n        ".join(rows)


def _compute_workflow_patterns(
    session_skill_sequences: list[list[str]],
) -> list[dict[str, Any]]:
    """Find common skill sequences across sessions (top 10)."""
    pattern_counts: Counter[str] = Counter()
    for seq in session_skill_sequences:
        # Deduplicate consecutive repeats to get the workflow shape
        deduped: list[str] = []
        for s in seq:
            if not deduped or deduped[-1] != s:
                deduped.append(s)
        if len(deduped) >= 2:
            key = " -> ".join(deduped)
            pattern_counts[key] += 1
    return [
        {"sequence": k.split(" -> "), "count": v}
        for k, v in pattern_counts.most_common(10)
    ]


def stat_card(value: str, label: str, note: str = "") -> str:
    note_html = f'<div class="stat-note">{he(note)}</div>' if note else ""
    return (
        f'<div class="stat"><div class="stat-value">{he(value)}</div>'
        f'<div class="stat-label">{he(label)}</div>{note_html}</div>'
    )


def render_bar_rows(data: dict[str, int]) -> str:
    if not data:
        return '<p class="empty">No data available</p>'
    max_value = max(data.values()) or 1
    rows = []
    for label, value in data.items():
        width = max(4, int(value / max_value * 100))
        rows.append(
            "<div class=\"bar-row\">"
            f"<div class=\"bar-label\">{he(label)}</div>"
            f"<div class=\"bar-track\"><div class=\"bar-fill\" style=\"width:{width}%\"></div></div>"
            f"<div class=\"bar-value\">{he(value)}</div>"
            "</div>"
        )
    return "".join(rows)


def render_kv(data: dict[str, Any]) -> str:
    if not data:
        return '<p class="empty">No data available</p>'
    items = []
    for key, value in data.items():
        items.append(
            f"<div class=\"kv-item\"><span>{he(key)}</span><strong>{he(value)}</strong></div>"
        )
    return "".join(items)


def render_skills_table(skills: list[SkillEntry]) -> str:
    if not skills:
        return '<p class="empty">No skills found</p>'

    rows = []
    for skill in skills:
        badge_class = {
            "system": "badge-system",
            "core": "badge-core",
            "plugin": "badge-plugin",
        }.get(skill.source, "badge-unknown")

        rows.append(
            "<tr>"
            f"<td><div class=\"skill-name\">{he(skill.name)}</div>"
            f"<div class=\"skill-meta\">{he(skill.description or 'No description')}</div></td>"
            f"<td><span class=\"badge {badge_class}\">{he(skill.source)}</span></td>"
            f"<td class=\"num\">{he(skill.loads)}</td>"
            "</tr>"
        )
    return (
        "<table><thead><tr><th>Skill</th><th>Source</th><th>Loads</th></tr></thead>"
        f"<tbody>{''.join(rows)}</tbody></table>"
    )


def render_plugins(plugins: list[dict[str, str]]) -> str:
    if not plugins:
        return '<p class="empty">No plugins found</p>'
    cards = []
    for plugin in plugins:
        cards.append(
            "<div class=\"plugin-card\">"
            f"<div class=\"plugin-title\">{he(plugin['display_name'] or plugin['name'])}</div>"
            f"<div class=\"plugin-meta\">v{he(plugin['version'] or 'unknown')}</div>"
            f"<div class=\"plugin-desc\">{he(plugin['description'] or 'No description')}</div>"
            "</div>"
        )
    return "".join(cards)


def generate_html(report: dict[str, Any]) -> str:
    summary = report["summary"]
    autonomy = report["autonomy"]
    start = summary["first_seen"][:10] if summary["first_seen"] else "unknown"
    end = summary["last_seen"][:10] if summary["last_seen"] else "unknown"

    stat_html = "".join(
        [
            stat_card(summary["sessions_scanned"], "Sessions"),
            stat_card(summary["active_days"], "Active Days"),
            stat_card(summary["projects_touched"], "Projects"),
            stat_card(summary["tool_calls_total"], "Tool Calls"),
            stat_card(summary["loaded_skills"], "Skills Loaded", f"{summary['installed_skills']} installed"),
            stat_card(summary["plugins"], "Plugins"),
            stat_card(summary["spawn_agent_total"], "Subagents"),
            stat_card(summary["plan_updates"], "Plan Updates"),
        ]
    )

    feature_pills = []
    for label, active, value in [
        ("Subagents", summary["spawn_agent_total"] > 0, f"{summary['spawn_agent_total']}"),
        ("Planning", summary["plan_updates"] > 0, f"{summary['plan_updates']}"),
        ("Vision", summary["images_viewed"] > 0, f"{summary['images_viewed']}"),
        ("MCP", bool(report["mcp_servers"]), f"{len(report['mcp_servers'])}"),
        ("Plugins", summary["plugins"] > 0, f"{summary['plugins']}"),
    ]:
        klass = "pill on" if active else "pill"
        feature_pills.append(f'<span class="{klass}">{he(label)} ({he(value)})</span>')

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Codex Insight Harness</title>
  <style>
    :root {{
      --bg: #f5f2ea;
      --panel: #fffdf8;
      --ink: #1f2430;
      --muted: #667085;
      --line: #ddd5c7;
      --accent: #0f766e;
      --accent-soft: #d9f3ee;
      --blue: #2563eb;
      --shadow: 0 16px 40px rgba(31, 36, 48, 0.08);
    }}
    * {{ box-sizing: border-box; }}
    body {{
      margin: 0;
      font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background:
        radial-gradient(circle at top left, rgba(15,118,110,0.08), transparent 28%),
        radial-gradient(circle at top right, rgba(37,99,235,0.07), transparent 24%),
        var(--bg);
      color: var(--ink);
      line-height: 1.5;
    }}
    .container {{
      max-width: 1180px;
      margin: 0 auto;
      padding: 32px 20px 56px;
    }}
    .hero {{
      background: linear-gradient(135deg, rgba(255,253,248,0.98), rgba(242,248,246,0.96));
      border: 1px solid var(--line);
      border-radius: 24px;
      padding: 28px;
      box-shadow: var(--shadow);
      margin-bottom: 20px;
    }}
    h1, h2, h3, p {{ margin: 0; }}
    h1 {{ font-size: 2.2rem; line-height: 1.05; letter-spacing: -0.04em; }}
    .subtitle {{
      margin-top: 10px;
      color: var(--muted);
      font-size: 1rem;
    }}
    .limit-note {{
      margin-top: 14px;
      padding: 12px 14px;
      border-radius: 14px;
      background: #fff7e8;
      border: 1px solid #f1d19c;
      color: #7a4c06;
      font-size: 0.92rem;
    }}
    .stats-grid {{
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 12px;
      margin-top: 22px;
    }}
    .stat {{
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 18px;
      padding: 16px;
    }}
    .stat-value {{
      font-size: 1.8rem;
      font-weight: 700;
      letter-spacing: -0.04em;
    }}
    .stat-label {{
      margin-top: 4px;
      color: var(--muted);
      font-size: 0.86rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }}
    .stat-note {{
      margin-top: 6px;
      color: var(--muted);
      font-size: 0.78rem;
    }}
    .autonomy-box {{
      margin-top: 18px;
      padding: 18px;
      border-radius: 18px;
      border: 1px solid var(--line);
      background: linear-gradient(135deg, rgba(15,118,110,0.09), rgba(37,99,235,0.06));
    }}
    .autonomy-label {{
      display: inline-block;
      padding: 4px 10px;
      border-radius: 999px;
      background: white;
      border: 1px solid rgba(15,118,110,0.18);
      color: var(--accent);
      font-weight: 700;
      font-size: 0.82rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }}
    .autonomy-desc {{
      margin-top: 10px;
      color: var(--ink);
    }}
    .pill-row {{
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 14px;
    }}
    .pill {{
      border-radius: 999px;
      border: 1px solid var(--line);
      background: #fbfaf7;
      color: var(--muted);
      padding: 7px 11px;
      font-size: 0.84rem;
    }}
    .pill.on {{
      background: var(--accent-soft);
      color: #0f5d57;
      border-color: rgba(15,118,110,0.18);
    }}
    .grid {{
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 18px;
      margin-top: 20px;
    }}
    .card {{
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 20px;
      padding: 20px;
      box-shadow: var(--shadow);
    }}
    .card h2 {{
      font-size: 1.05rem;
      margin-bottom: 14px;
      letter-spacing: -0.02em;
    }}
    .bar-row {{
      display: grid;
      grid-template-columns: 120px 1fr 56px;
      align-items: center;
      gap: 10px;
      margin-bottom: 10px;
      font-size: 0.92rem;
    }}
    .bar-label {{
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }}
    .bar-track {{
      height: 12px;
      border-radius: 999px;
      background: #ece8df;
      overflow: hidden;
    }}
    .bar-fill {{
      height: 100%;
      border-radius: 999px;
      background: linear-gradient(90deg, var(--accent), var(--blue));
    }}
    .bar-value {{
      text-align: right;
      color: var(--muted);
      font-variant-numeric: tabular-nums;
    }}
    .kv-grid {{
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 10px;
    }}
    .kv-item {{
      border: 1px solid var(--line);
      border-radius: 14px;
      padding: 12px;
      display: flex;
      justify-content: space-between;
      gap: 12px;
      background: #fcfbf8;
      font-size: 0.92rem;
    }}
    table {{
      width: 100%;
      border-collapse: collapse;
      font-size: 0.92rem;
    }}
    th, td {{
      text-align: left;
      padding: 12px 10px;
      border-top: 1px solid var(--line);
      vertical-align: top;
    }}
    th {{
      color: var(--muted);
      font-size: 0.8rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      border-top: none;
      padding-top: 0;
    }}
    .num {{
      text-align: right;
      font-variant-numeric: tabular-nums;
    }}
    .skill-name {{
      font-weight: 600;
      margin-bottom: 4px;
    }}
    .skill-meta {{
      color: var(--muted);
      font-size: 0.84rem;
    }}
    .badge {{
      display: inline-block;
      padding: 4px 8px;
      border-radius: 999px;
      font-size: 0.76rem;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      font-weight: 700;
    }}
    .badge-system {{ background: #eee9ff; color: #5b3fb4; }}
    .badge-core {{ background: #e4f3ff; color: #1659b7; }}
    .badge-plugin {{ background: #e7f7ef; color: #0f6b49; }}
    .badge-unknown {{ background: #efefef; color: #555; }}
    .plugin-grid {{
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 12px;
    }}
    .plugin-card {{
      border: 1px solid var(--line);
      background: #fcfbf8;
      border-radius: 16px;
      padding: 14px;
    }}
    .plugin-title {{
      font-weight: 700;
      margin-bottom: 4px;
    }}
    .plugin-meta {{
      color: var(--muted);
      font-size: 0.84rem;
      margin-bottom: 6px;
    }}
    .plugin-desc {{
      color: var(--muted);
      font-size: 0.86rem;
    }}
    .footnote {{
      margin-top: 18px;
      color: var(--muted);
      font-size: 0.82rem;
    }}
    .empty {{
      color: var(--muted);
      font-size: 0.92rem;
    }}
    @media (max-width: 900px) {{
      .grid {{ grid-template-columns: 1fr; }}
      .bar-row {{ grid-template-columns: 90px 1fr 44px; }}
    }}
  </style>
</head>
<body>
  <div class="container">
    <section class="hero">
      <h1>Codex Insight Harness</h1>
      <p class="subtitle">{he(summary['sessions_scanned'])} sessions across {he(summary['active_days'])} active days | {he(start)} to {he(end)}</p>
      <div class="limit-note">Codex session logs currently do not expose reliable token totals, so this report intentionally omits token usage claims.</div>
      <div class="stats-grid">{stat_html}</div>
      <div class="autonomy-box">
        <div class="autonomy-label">{he(autonomy['label'])}</div>
        <p class="autonomy-desc">{he(autonomy['description'])}</p>
        <div class="pill-row">{''.join(feature_pills)}</div>
      </div>
    </section>

    <section class="grid">
      <div class="card">
        <h2>Tool Usage</h2>
        {render_bar_rows(report['tool_usage'])}
      </div>
      <div class="card">
        <h2>CLI Commands</h2>
        {render_bar_rows(report['command_usage'])}
      </div>
      <div class="card">
        <h2>Skills</h2>
        {render_skills_table(report['skill_inventory'])}
      </div>
      <div class="card">
        <h2>Plugins</h2>
        <div class="plugin-grid">{render_plugins(report['plugins'])}</div>
      </div>
      <div class="card">
        <h2>Agent Dispatch</h2>
        <div class="kv-grid">{render_kv(report['spawn_agent_types'])}</div>
        <div class="footnote">Models used for spawned agents</div>
        <div class="kv-grid" style="margin-top:10px">{render_kv(report['spawn_agent_models'])}</div>
      </div>
      <div class="card">
        <h2>Environment</h2>
        <div class="footnote" style="margin-top:0;margin-bottom:10px">Sandbox modes</div>
        <div class="kv-grid">{render_kv(report['sandbox_modes'])}</div>
        <div class="footnote">Approval policies</div>
        <div class="kv-grid" style="margin-top:10px">{render_kv(report['approval_policies'])}</div>
        <div class="footnote">Models and collaboration modes</div>
        <div class="kv-grid" style="margin-top:10px">{render_kv(report['models'])}</div>
      </div>
      <div class="card">
        <h2>Session Shape</h2>
        <div class="kv-grid">
          {render_kv({
            'user_messages': summary['user_messages'],
            'agent_messages': summary['agent_messages'],
            'reasoning_items': summary['reasoning_items'],
            'autonomy_ratio': autonomy['ratio'],
            'images_viewed': summary['images_viewed'],
          })}
        </div>
        <div class="footnote">Agent message phases</div>
        <div class="kv-grid" style="margin-top:10px">{render_kv(report['agent_message_phases'])}</div>
      </div>
      <div class="card">
        <h2>MCP and Runtime</h2>
        <div class="footnote" style="margin-top:0;margin-bottom:10px">MCP server usage</div>
        <div class="kv-grid">{render_kv(report['mcp_servers'])}</div>
        <div class="footnote">Originators and CLI versions</div>
        <div class="kv-grid" style="margin-top:10px">{render_kv(report['originators'])}</div>
        <div class="kv-grid" style="margin-top:10px">{render_kv(report['cli_versions'])}</div>
      </div>
      <div class="card">
        <h2>Project Ecosystem</h2>
        <div class="kv-grid">{render_kv(report['ecosystem'])}</div>
        <p class="footnote">These are existence checks only. The extractor does not read repository content from your projects.</p>
      </div>
      <div class="card">
        <h2>Workflow Phases</h2>
        <div class="footnote" style="margin-top:0;margin-bottom:10px">{report.get('phase_stats', {}).get('total_sessions_with_phases', 0)} sessions analyzed</div>
        <div class="kv-grid">{render_kv(report.get('phase_distribution', {}))}</div>
        <div class="footnote" style="margin-top:10px">Phase transitions</div>
        {render_bar_rows(report.get('phase_transitions', {}))}
        <div class="footnote" style="margin-top:10px">
          <strong>{report.get('phase_stats', {}).get('explore_before_impl_pct', 0)}%</strong> explore before implementing &middot;
          <strong>{report.get('phase_stats', {}).get('test_before_ship_pct', 0)}%</strong> test before shipping
        </div>
      </div>
      <div class="card">
        <h2>Skill Workflow</h2>
        <div class="footnote" style="margin-top:0;margin-bottom:10px">Skill invocations</div>
        {render_bar_rows(report.get('skill_invocations', {}))}
        <div class="footnote" style="margin-top:10px">Agent dispatches</div>
        {render_bar_rows(report.get('agent_dispatches', {}))}
        <div class="footnote" style="margin-top:10px">Common workflow patterns</div>
        {_render_workflow_patterns(report.get('workflow_patterns', []))}
      </div>
    </section>
  </div>
  <script type="application/json" id="codex-insight-harness-integrity">{he(report['integrity_hash'])}</script>
</body>
</html>"""


def write_report(html_text: str, output_dir: Path) -> Path:
    output_dir.mkdir(parents=True, exist_ok=True)
    filename = f"insight-harness-codex-{datetime.now().strftime('%Y%m%d-%H%M%S')}.html"
    path = output_dir / filename
    path.write_text(html_text, encoding="utf-8")
    return path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate a Codex insight-harness report.")
    parser.add_argument("--days", type=int, default=30, help="Lookback window in days.")
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path(os.environ.get("INSIGHT_HARNESS_OUTPUT_DIR", DEFAULT_OUTPUT_DIR)),
        help="Directory for the generated HTML report.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    report = collect_report_data(days=args.days)
    html_text = generate_html(report)
    path = write_report(html_text, args.output_dir)
    print(path)


if __name__ == "__main__":
    main()
