/**
 * All homepage copy in one place.
 * Edit this file to change any text on the homepage.
 */

export const homepage = {
  // ── Hero ──────────────────────────────────────────────────
  hero: {
    headline: "See how other developers use Claude Code",
    subtext:
      "Browse real developer workflows — the tools, skills, plugins, and patterns they use across actual coding sessions. All personal data removed.",
    primaryCta: "Browse Profiles",
    secondaryCta: "Upload Your Insights",
  },

  // ── Profile sections ─────────────────────────────────────
  profiles: {
    featuredLabel: "Featured Profile",
    recentHeading: "Recent Profiles",
    emptyTitle: "No profiles shared yet",
    emptySubtext: "Be the first to share your Claude Code insights!",
    emptyCta: "Upload Your Insights",
    strengthsLabel: "Strengths:",
  },

  // ── Upgrade section (/insight-harness) ────────────────────
  upgrade: {
    heading: "Upgrade your profile with",
    skillName: "/insight-harness",
    description:
      "A superset of /insights — everything you get from /insights, plus token usage, tool breakdowns, skill inventory, and more.",
    githubUrl:
      "https://github.com/craigdossantos/claude-toolkit/tree/main/skills/insight-harness",
    githubLabel: "View on GitHub →",
    privacyNote:
      "Privacy-first: only reads tool names, skill names, and stats — never your code or messages",

    // Comparison table
    table: {
      headers: {
        feature: "What you get",
        insights: "/insights",
        harness: "/insight-harness",
      },
      shared: [
        "Sessions, messages, commits",
        "Workflow analysis & patterns",
        "Strengths, challenges, suggestions",
        "Features detected (worktrees, agents, etc.)",
      ],
      harnessOnly: [
        "Token usage (input/output/total)",
        "Tool usage breakdown (Read, Edit, Bash...)",
        "Skills & plugins inventory",
        "Hooks configuration & fire rate",
        "CLI commands & file operation style",
        "Agent dispatch patterns",
        "Models used & permission modes",
      ],
    },

    // Install options
    installTitle: "Option 1: Install the skill",
    installCommand:
      "mkdir -p ~/.claude/skills/insight-harness/scripts && curl -sL https://raw.githubusercontent.com/craigdossantos/claude-toolkit/main/skills/insight-harness/SKILL.md -o ~/.claude/skills/insight-harness/SKILL.md && curl -sL https://raw.githubusercontent.com/craigdossantos/claude-toolkit/main/skills/insight-harness/scripts/extract.py -o ~/.claude/skills/insight-harness/scripts/extract.py",
    installHint: "Paste in terminal. Then run",
    installSlashCommand: "/insight-harness",
    installSuffix: "in Claude Code.",

    promptTitle: "Option 2: One-shot prompt",
    promptCommand: "Run /insight-harness and generate my harness report",
    promptHint:
      "Paste this into Claude Code if you already have the skill installed.",
  },

  // ── How It Works ──────────────────────────────────────────
  howItWorks: {
    heading: "How It Works",
    steps: [
      {
        icon: "📊",
        title: "Run /insights in Claude Code",
        description:
          "Generate a usage report covering your sessions, messages, commits, and workflow patterns. Takes just a few seconds.",
      },
      {
        icon: "⚡",
        title: "Run /insight-harness for a complete profile",
        description:
          "Get the full data dashboard — token usage, tool breakdowns, skills, hooks, plugins, and more on top of everything in /insights.",
      },
      {
        icon: "🌐",
        title: "Share your profile",
        description:
          "Show your current usage and harness details. Upload the HTML report and get a public profile others can browse and learn from.",
      },
    ],
  },

  // ── Footer CTA ────────────────────────────────────────────
  footerCta: {
    heading: "Ready to share your harness?",
    subtext:
      "Join developers who are learning from each other's Claude Code workflows.",
    cta: "Upload Your Insights",
  },
} as const;
