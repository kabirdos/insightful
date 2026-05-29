/**
 * All homepage copy in one place.
 * Edit this file to change any text on the homepage.
 */

export const homepage = {
  // ── Hero ──────────────────────────────────────────────────
  hero: {
    headline: "See how developers use Claude Code and Codex",
    subtext:
      "Browse real developer workflows — the tools, skills, plugins, and patterns they use across actual agent sessions. All personal data removed.",
    primaryCta: "Browse Profiles",
    secondaryCta: "Upload Your Insights",
  },

  // ── Profile sections ─────────────────────────────────────
  profiles: {
    featuredLabel: "Featured Profile",
    recentHeading: "Recent Profiles",
    emptyTitle: "No profiles shared yet",
    emptySubtext: "Be the first to share your agent harness insights!",
    emptyCta: "Upload Your Insights",
    strengthsLabel: "Strengths:",
  },

  // ── Upgrade section (/insight-harness) ────────────────────
  upgrade: {
    heading: "Upgrade your profile with",
    skillName: "/insight-harness",
    description:
      "A shareable harness profile for Claude Code and Codex — tools, skills, plugin inventory, workflow signal, and more.",
    githubUrl: "https://github.com/kabirdos/insight-harness",
    githubLabel: "View on GitHub →",
    privacyNote:
      "Privacy-first: only reads whitelisted local metadata — never your code or messages",

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

    // Option 1: Built-in /insights
    option1Title: "Option 1: Run /insights",
    option1Command: "/insights",
    option1Hint: "Built into Claude Code. Just type this and hit enter.",

    // Option 2: Enhanced /insight-harness (requires install)
    option2Title: "Option 2: Run /insight-harness",
    option2InstallCommand:
      "mkdir -p ~/.claude/skills/insight-harness/scripts && curl -sL https://raw.githubusercontent.com/craigdossantos/claude-toolkit/main/skills/insight-harness/SKILL.md -o ~/.claude/skills/insight-harness/SKILL.md && curl -sL https://raw.githubusercontent.com/craigdossantos/claude-toolkit/main/skills/insight-harness/scripts/extract.py -o ~/.claude/skills/insight-harness/scripts/extract.py",
    option2InstallHint: "Install the skill first — paste in your terminal:",
    option2RunCommand: "/insight-harness",
    option2RunHint: "Then run this in Claude Code:",
  },

  // ── How It Works ──────────────────────────────────────────
  howItWorks: {
    heading: "Three commands to a public profile",
    subheading:
      "Install once, run, upload. Claude Code and Codex reports both publish here.",
    steps: [
      {
        icon: "📦",
        title: "Install /insight-harness",
        description:
          "Install the skill for Claude Code or Codex. One-time step.",
      },
      {
        icon: "⚡",
        title: "Run /insight-harness",
        description:
          "Generate a local HTML report from Claude Code or Codex CLI metadata.",
      },
      {
        icon: "🌐",
        title: "Upload the report",
        description:
          "Drop the HTML here. Personal data is stripped before publish. You get a public profile others can browse.",
      },
    ],
  },

  // ── Footer CTA ────────────────────────────────────────────
  footerCta: {
    heading: "Ready to share your harness?",
    subtext:
      "Join developers who are learning from each other's agent workflows.",
    cta: "Upload Your Insights",
  },
} as const;
