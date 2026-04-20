/**
 * Seed script: create realistic demo profiles with /insights and /insight-harness reports.
 *
 * All demo users have githubId starting with "demo-" for easy cleanup.
 * Run:  npx tsx prisma/seed-demos.ts
 * Cleanup:  npx tsx prisma/seed-demos.ts --cleanup
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import {
  computeDefaultAgentDispatch,
  computeDefaultBranchPrefixes,
  computeDefaultHookFrequency,
  computeDefaultPerModelTokens,
  defaultProjectSeedFor,
} from "./seed-helpers";

const prisma = new PrismaClient();

// ── Demo Users ─────────────────────────────────────────────────────────

const DEMO_USERS = [
  {
    githubId: "demo-mika",
    username: "mika-tanaka",
    displayName: "Mika Tanaka",
    bio: "Staff engineer at a fintech startup. TypeScript + React + Node. Claude Code power user since day one.",
    avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=mika",
    githubUrl: "https://github.com/mika-tanaka",
    linkedinUrl: "https://linkedin.com/in/mika-tanaka",
  },
  {
    githubId: "demo-jordan",
    username: "jordan-reeves",
    displayName: "Jordan Reeves",
    bio: "Indie hacker building SaaS products. Ship fast, iterate faster. 3 products launched with Claude Code.",
    avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=jordan",
    githubUrl: "https://github.com/jordan-reeves",
    twitterUrl: "https://x.com/jordanreeves",
  },
  {
    githubId: "demo-priya",
    username: "priya-sharma",
    displayName: "Priya Sharma",
    bio: "ML engineer exploring agent-native development. Python + FastAPI. Obsessed with custom skills and hooks.",
    avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=priya",
    githubUrl: "https://github.com/priya-sharma",
  },
  {
    githubId: "demo-marcus",
    username: "marcus-chen",
    displayName: "Marcus Chen",
    bio: "DevOps lead. Terraform, K8s, CI/CD. Using Claude Code to automate infrastructure and incident response.",
    avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=marcus",
    githubUrl: "https://github.com/marcus-chen",
    websiteUrl: "https://marcuschen.dev",
  },
  {
    githubId: "demo-elena",
    username: "elena-volkov",
    displayName: "Elena Volkov",
    bio: "Full-stack freelancer. Rails + React. 8 years shipping production apps, now 2x faster with Claude Code.",
    avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=elena",
    githubUrl: "https://github.com/elena-volkov",
    twitterUrl: "https://x.com/elenavolkov",
    linkedinUrl: "https://linkedin.com/in/elena-volkov",
  },
  {
    githubId: "demo-sam",
    username: "sam-okafor",
    displayName: "Sam Okafor",
    bio: "Junior developer learning fast. First job in tech. Claude Code is my pair programming partner.",
    avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=sam",
  },
];

// ── Report templates ─────────────────────────────────────────────────

function insightsReport(
  authorId: string,
  username: string,
  opts: {
    sessions: number;
    messages: number;
    commits: number;
    dateStart: string;
    dateEnd: string;
    days: number;
    linesAdded: number;
    linesRemoved: number;
    whatsWorking: string;
    whatsHindering: string;
    quickWins: string;
    ambitiousWorkflows: string;
    narrative: string;
    keyPattern: string;
    projects: { name: string; sessions: number; description: string }[];
    workflows: { title: string; description: string }[];
    frictionIntro: string;
    frictions: {
      category: string;
      description: string;
      examples: string[];
    }[];
    funHeadline: string;
    funDetail: string;
    detectedSkills?: string[];
  },
) {
  const slug = `${opts.dateEnd.replace(/-/g, "")}-demo`;
  return {
    authorId,
    title: `${username}'s Claude Code Insights - ${new Date(opts.dateEnd + "T00:00:00").toLocaleDateString("en-US", { month: "short", year: "numeric" })}`,
    slug,
    reportType: "insights",
    sessionCount: opts.sessions,
    messageCount: opts.messages,
    commitCount: opts.commits,
    dateRangeStart: opts.dateStart,
    dateRangeEnd: opts.dateEnd,
    dayCount: opts.days,
    linesAdded: opts.linesAdded,
    linesRemoved: opts.linesRemoved,
    detectedSkills: opts.detectedSkills ?? [],
    atAGlance: {
      whats_working: opts.whatsWorking,
      whats_hindering: opts.whatsHindering,
      quick_wins: opts.quickWins,
      ambitious_workflows: opts.ambitiousWorkflows,
    },
    interactionStyle: {
      narrative: opts.narrative,
      key_pattern: opts.keyPattern,
    },
    projectAreas: { areas: opts.projects },
    impressiveWorkflows: {
      intro: `Across ${opts.sessions} sessions, several standout workflows emerged.`,
      impressive_workflows: opts.workflows,
    },
    frictionAnalysis: {
      intro: opts.frictionIntro,
      categories: opts.frictions,
    },
    suggestions: {
      claude_md_additions: [],
      features_to_try: [],
      usage_patterns: [],
    },
    onTheHorizon: { intro: "", opportunities: [] },
    funEnding: { headline: opts.funHeadline, detail: opts.funDetail },
  };
}

function harnessReport(
  authorId: string,
  username: string,
  opts: {
    sessions: number;
    messages: number;
    commits: number;
    dateStart: string;
    dateEnd: string;
    days: number;
    linesAdded: number;
    linesRemoved: number;
    tokens: number;
    lifetimeTokens: number;
    durationHours: number;
    avgSession: number;
    skills: number;
    hooks: number;
    prs: number;
    autonomyLabel: string;
    detectedSkills?: string[];
    // Harness data
    toolUsage: Record<string, number>;
    skillInventory: {
      name: string;
      calls: number;
      source: string;
      description: string;
    }[];
    hookDefs: { event: string; matcher: string; script: string }[];
    plugins: {
      name: string;
      version: string;
      marketplace: string;
      active: boolean;
    }[];
    featurePills: { name: string; active: boolean; value: string }[];
    models: Record<string, number>;
    languages: Record<string, number>;
    cliTools: Record<string, number>;
    fileOpStyle: {
      readPct: number;
      editPct: number;
      writePct: number;
      grepCount: number;
      globCount: number;
      style: string;
    };
    // Workflow data — drives the Workflow chain on the homepage card
    workflowPatterns: { sequence: string[]; count: number }[];
    skillInvocations: Record<string, number>;
    // Optional richer fields — if omitted, we compute reasonable defaults
    agentDispatch?: {
      totalAgents: number;
      types: Record<string, number>;
      models: Record<string, number>;
      backgroundPct: number;
      customAgents: string[];
    } | null;
    mcpServers?: Record<string, number>;
    permissionModes?: Record<string, number>;
    hookFrequency?: Record<string, number>;
    extraWriteupSections?: { title: string; contentHtml: string }[];
    branchPrefixes?: Record<string, number>;
    // Insights sections
    whatsWorking: string;
    narrative: string;
    keyPattern: string;
    projects: { name: string; sessions: number; description: string }[];
    funHeadline: string;
    funDetail: string;
  },
) {
  const slug = `${opts.dateEnd.replace(/-/g, "")}-harness-demo`;
  return {
    authorId,
    title: `${username}'s Insight Harness - ${new Date(opts.dateEnd + "T00:00:00").toLocaleDateString("en-US", { month: "short", year: "numeric" })}`,
    slug,
    reportType: "insight-harness",
    sessionCount: opts.sessions,
    messageCount: opts.messages,
    commitCount: opts.commits,
    dateRangeStart: opts.dateStart,
    dateRangeEnd: opts.dateEnd,
    dayCount: opts.days,
    linesAdded: opts.linesAdded,
    linesRemoved: opts.linesRemoved,
    totalTokens: opts.tokens,
    durationHours: opts.durationHours,
    avgSessionMinutes: opts.avgSession,
    prCount: opts.prs,
    autonomyLabel: opts.autonomyLabel,
    detectedSkills: opts.detectedSkills ?? [],
    atAGlance: {
      whats_working: opts.whatsWorking,
      whats_hindering: "",
      quick_wins: "",
      ambitious_workflows: "",
    },
    interactionStyle: {
      narrative: opts.narrative,
      key_pattern: opts.keyPattern,
    },
    projectAreas: { areas: opts.projects },
    impressiveWorkflows: { intro: "", impressive_workflows: [] },
    frictionAnalysis: { intro: "", categories: [] },
    suggestions: {
      claude_md_additions: [],
      features_to_try: [],
      usage_patterns: [],
    },
    onTheHorizon: { intro: "", opportunities: [] },
    funEnding: { headline: opts.funHeadline, detail: opts.funDetail },
    harnessData: {
      stats: {
        totalTokens: opts.tokens,
        lifetimeTokens: opts.lifetimeTokens,
        durationHours: opts.durationHours,
        avgSessionMinutes: opts.avgSession,
        skillsUsedCount: opts.skills,
        hooksCount: opts.hooks,
        prCount: opts.prs,
        sessionCount: opts.sessions,
        commitCount: opts.commits,
      },
      autonomy: {
        label: opts.autonomyLabel,
        description: `1 human turn per ${opts.autonomyLabel === "Fire-and-Forget" ? "12" : opts.autonomyLabel === "Directive" ? "5" : "3"} Claude turns`,
        userMessages: Math.round(opts.messages * 0.3),
        assistantMessages: Math.round(opts.messages * 0.7),
        turnCount: opts.messages,
        errorRate: `${(Math.random() * 3 + 0.5).toFixed(1)}%`,
      },
      featurePills: opts.featurePills,
      toolUsage: opts.toolUsage,
      skillInventory: opts.skillInventory,
      hookDefinitions: opts.hookDefs,
      hookFrequency:
        opts.hookFrequency ?? computeDefaultHookFrequency(opts.hookDefs),
      plugins: opts.plugins,
      harnessFiles: [
        "~/.claude/CLAUDE.md (42 lines)",
        "2 project CLAUDE.md files",
        "1 HANDOFF.md file",
      ],
      fileOpStyle: opts.fileOpStyle,
      // Helper auto-populates agentDispatch for users whose detectedSkills
      // include parallel_agents or subagents — matches the real extractor.
      agentDispatch:
        opts.agentDispatch === undefined
          ? computeDefaultAgentDispatch(
              opts.detectedSkills ?? [],
              opts.sessions,
            )
          : opts.agentDispatch,
      cliTools: opts.cliTools,
      languages: opts.languages,
      models: opts.models,
      // 4-way breakdown for the USD cost estimator's accurate Path 1.
      // Sums to opts.tokens so the stored totalTokens and the sum of
      // perModelTokens stay consistent (the backfill script relies on
      // this invariant to recompute totalTokens from perModelTokens).
      perModelTokens: computeDefaultPerModelTokens(opts.tokens, opts.models),
      permissionModes: opts.permissionModes ?? { plan: 60, auto: 40 },
      mcpServers: opts.mcpServers ?? {},
      gitPatterns: {
        prCount: opts.prs,
        commitCount: opts.commits,
        linesAdded: `${(opts.linesAdded / 1000).toFixed(1)}K`,
        branchPrefixes:
          opts.branchPrefixes ?? computeDefaultBranchPrefixes(opts.commits),
      },
      versions: ["1.0.16", "1.0.15"],
      writeupSections: [
        {
          title: "How This Harness Works",
          contentHtml: `<p>This developer runs a <strong>${opts.autonomyLabel.toLowerCase()}</strong> workflow — ${opts.autonomyLabel === "Fire-and-Forget" ? "launching tasks and letting Claude work autonomously with minimal supervision" : opts.autonomyLabel === "Directive" ? "providing clear instructions and reviewing outputs methodically" : "collaborating closely with Claude in a conversational back-and-forth"}.</p>`,
        },
        ...(opts.extraWriteupSections ?? []),
      ],
      workflowData: {
        skillInvocations: opts.skillInvocations,
        agentDispatches: {},
        workflowPatterns: opts.workflowPatterns,
        phaseTransitions: {},
        phaseDistribution: {},
        phaseStats: {
          testBeforeShipPct: 40,
          exploreBeforeImplPct: 60,
          totalSessionsWithPhases: opts.sessions,
        },
      },
      integrityHash: "demo-" + Math.random().toString(36).substring(2, 10),
    },
  };
}

// ── Build all reports ──────────────────────────────────────────────────

async function seed() {
  console.log("Creating demo users...");

  const users: Record<string, { id: string }> = {};
  for (const u of DEMO_USERS) {
    users[u.username] = await prisma.user.upsert({
      where: { githubId: u.githubId },
      update: {},
      create: u,
    });
    console.log(`  ✓ ${u.displayName} (@${u.username})`);
  }

  console.log("\nCreating reports...");

  const reports = [
    // ── Mika: /insights report ─────────────────────────
    insightsReport(users["mika-tanaka"].id, "mika-tanaka", {
      sessions: 142,
      messages: 2340,
      commits: 198,
      dateStart: "2026-03-01",
      dateEnd: "2026-03-31",
      days: 30,
      linesAdded: 28400,
      linesRemoved: 9200,
      detectedSkills: [
        "parallel_agents",
        "custom_skills",
        "hooks",
        "plan_mode",
        "worktrees",
      ],
      whatsWorking:
        "Exceptional parallel agent usage for feature development. Consistently launches 5-8 agents for independent tasks, achieving 3x throughput on multi-component features. Custom skills for code review and deployment verification are saving significant time.",
      whatsHindering:
        "Large file refactoring sessions stall when context windows fill up. Claude loses track of the overall refactoring plan on files over 500 lines. Workaround of splitting files first adds overhead.",
      quickWins:
        "Add a CLAUDE.md rule to automatically split files over 300 lines before refactoring. Your 12 stalled refactoring sessions cost ~4 hours total.",
      ambitiousWorkflows:
        "Your custom /deploy-verify skill could evolve into a full CI/CD copilot that monitors deploys, catches regressions, and auto-rollbacks.",
      narrative:
        "You are a high-velocity orchestrator who treats Claude Code as a development team rather than a single assistant. Your parallel agent usage is in the top 1% — you routinely spawn 5-8 concurrent agents for feature branches, test suites, and code reviews. Your workflow is strongly plan-first: you enter plan mode, design the approach, then execute with worktrees for isolation. This discipline shows in your remarkably low error rate.",
      keyPattern:
        "Key pattern: Plan-first orchestrator who parallelizes aggressively and uses worktrees for safe experimentation.",
      projects: [
        {
          name: "Fintech Payment Gateway",
          sessions: 52,
          description:
            "Building a PCI-compliant payment processing system with Stripe integration, webhooks, and real-time transaction monitoring.",
        },
        {
          name: "Internal Admin Dashboard",
          sessions: 38,
          description:
            "React admin panel with role-based access, real-time analytics charts, and audit logging.",
        },
        {
          name: "API SDK Generator",
          sessions: 28,
          description:
            "Automated SDK generation from OpenAPI specs, producing typed clients in TypeScript and Python.",
        },
        {
          name: "Claude Code Plugins",
          sessions: 24,
          description:
            "Custom Claude Code plugins and skills for team-specific workflows.",
        },
      ],
      workflows: [
        {
          title: "Parallel Feature Development",
          description:
            "Spawns separate agents for frontend, backend, and tests simultaneously. Each agent works in its own worktree. Synthesis agent merges and resolves conflicts at the end.",
        },
        {
          title: "Automated Code Review Pipeline",
          description:
            "Custom /review skill that launches 4 specialized agents (security, performance, accessibility, style) in parallel, then synthesizes findings into a single review comment.",
        },
      ],
      frictionIntro:
        "Main friction points are around large file handling and occasional agent coordination failures.",
      frictions: [
        {
          category: "Large File Context Loss",
          description:
            "Files over 500 lines cause Claude to lose track of the refactoring plan. The model forgets changes it already made.",
          examples: [
            "Payment processor refactor stalled 3 times at 600 lines",
            "Admin dashboard component lost state tracking after 450 lines",
          ],
        },
        {
          category: "Agent Merge Conflicts",
          description:
            "Parallel agents occasionally modify the same files, creating merge conflicts in the synthesis step.",
          examples: [
            "Two agents both modified the API response types",
            "Shared utility function edited by 3 concurrent agents",
          ],
        },
      ],
      funHeadline: "Claude named a variable 'thisIsDefinitelyNotAHack'",
      funDetail:
        "During a late-night session optimizing the payment retry logic, Claude created a temporary workaround and named the function thisIsDefinitelyNotAHack(). It survived code review and made it to staging.",
    }),

    // ── Mika: /insight-harness report ──────────────────
    harnessReport(users["mika-tanaka"].id, "mika-tanaka", {
      sessions: 142,
      messages: 2340,
      commits: 198,
      dateStart: "2026-03-01",
      dateEnd: "2026-03-31",
      days: 30,
      linesAdded: 28400,
      linesRemoved: 9200,
      // Full-throughput 30d total (Option B — input + output + cache_read +
      // cache_creation). Old value was ~4.2M input+output only; heavy
      // agentic Fire-and-Forget usage pushes that 15-20x with cache traffic.
      tokens: 72_000_000,
      // Lifetime ≈ 3.3× last-30d — Mika is a long-tenure power user, so
      // most historical sessions sit behind the 30-day window.
      lifetimeTokens: 240_000_000,
      durationHours: 86,
      avgSession: 36,
      skills: 18,
      hooks: 6,
      prs: 34,
      autonomyLabel: "Fire-and-Forget",
      detectedSkills: [
        "parallel_agents",
        "custom_skills",
        "hooks",
        "plan_mode",
        "worktrees",
        "subagents",
      ],
      toolUsage: {
        Read: 4200,
        Edit: 2800,
        Bash: 3100,
        Grep: 1900,
        Glob: 1400,
        Write: 800,
        Agent: 420,
        Skill: 180,
      },
      skillInventory: [
        {
          name: "commit",
          calls: 89,
          source: "custom",
          description: "Commit with conventional format",
        },
        {
          name: "review",
          calls: 34,
          source: "custom",
          description: "4-agent parallel code review",
        },
        {
          name: "deploy-verify",
          calls: 22,
          source: "custom",
          description: "Post-deploy smoke test runner",
        },
        {
          name: "brainstorm",
          calls: 18,
          source: "plugin",
          description: "Multi-perspective brainstorming",
        },
      ],
      hookDefs: [
        {
          event: "PostToolUse:Write",
          matcher: "*.ts",
          script: "prettier --write $FILE",
        },
        {
          event: "PostToolUse:Edit",
          matcher: "*.ts",
          script: "prettier --write $FILE",
        },
        {
          event: "PreCommit",
          matcher: "(all)",
          script: "npm run lint && npm run test",
        },
        {
          event: "PostToolUse:Bash",
          matcher: "rm|git reset|git checkout",
          script: "echo 'Destructive command detected' && exit 1",
        },
      ],
      plugins: [
        {
          name: "compound-engineering",
          version: "2.1.0",
          marketplace: "anthropic",
          active: true,
        },
        {
          name: "superpowers",
          version: "1.8.0",
          marketplace: "anthropic",
          active: true,
        },
      ],
      featurePills: [
        { name: "Status Line", active: true, value: "" },
        { name: "Task Agents", active: true, value: "28%" },
        { name: "MCP", active: true, value: "12%" },
        { name: "Web Search", active: true, value: "5%" },
        { name: "Sub-Agents", active: true, value: "420" },
        { name: "Plan Mode", active: true, value: "34" },
        { name: "Compactions", active: true, value: "18" },
      ],
      models: {
        "claude-sonnet-4-6": 890,
        "claude-opus-4-6": 240,
        "claude-haiku-4-5": 120,
      },
      languages: {
        TypeScript: 680,
        JavaScript: 120,
        Python: 45,
        JSON: 180,
        YAML: 60,
        CSS: 90,
      },
      cliTools: {
        npm: 340,
        git: 280,
        npx: 120,
        node: 85,
        prettier: 220,
        eslint: 180,
      },
      fileOpStyle: {
        readPct: 42,
        editPct: 38,
        writePct: 20,
        grepCount: 1900,
        globCount: 1400,
        style: "Surgical Editor",
      },
      whatsWorking:
        "Exceptional parallel agent usage — top 1% of Claude Code users by agent dispatch volume.",
      narrative:
        "High-velocity orchestrator using Claude as a development team.",
      keyPattern: "Plan-first orchestrator who parallelizes aggressively.",
      projects: [
        {
          name: "Fintech Payment Gateway",
          sessions: 52,
          description: "PCI-compliant payment processing with Stripe",
        },
        {
          name: "Internal Admin Dashboard",
          sessions: 38,
          description: "React admin with RBAC and analytics",
        },
      ],
      workflowPatterns: [
        {
          sequence: [
            "superpowers:writing-plans",
            "superpowers:dispatching-parallel-agents",
            "superpowers:executing-plans",
            "pr-review-toolkit:code-reviewer",
          ],
          count: 32,
        },
        {
          sequence: [
            "compound-engineering:ce-brainstorm",
            "superpowers:writing-plans",
          ],
          count: 14,
        },
      ],
      skillInvocations: {
        "superpowers:writing-plans": 52,
        "superpowers:dispatching-parallel-agents": 38,
        "superpowers:executing-plans": 45,
        "superpowers:using-git-worktrees": 24,
        "pr-review-toolkit:code-reviewer": 34,
        "compound-engineering:ce-brainstorm": 18,
        "commit-commands:commit": 89,
      },
      mcpServers: {
        claude_ai_GitHub: 184,
        stripe: 92,
        linear: 38,
      },
      permissionModes: { plan: 35, auto: 60, acceptEdits: 5 },
      hookFrequency: {
        "PostToolUse:Write": 142,
        "PostToolUse:Edit": 218,
        PreCommit: 34,
        "PostToolUse:Bash": 61,
      },
      extraWriteupSections: [
        {
          title: "Parallel Orchestration Pattern",
          contentHtml:
            "<p>Mika routinely dispatches 5–8 concurrent agents per feature. Each works in an isolated worktree; a synthesis agent reconciles the results and produces a single PR. This pattern is in the top 1% of parallel-agent usage across the corpus.</p>",
        },
        {
          title: "Hook-Guarded Autonomy",
          contentHtml:
            "<p>Fire-and-Forget autonomy is safe here because of disciplined hooks. A PreCommit hook runs lint + tests before any commit, and a PostToolUse:Bash hook blocks destructive commands like <code>rm -rf</code> and <code>git reset --hard</code>.</p>",
        },
      ],
      branchPrefixes: {
        "feat/": 88,
        "fix/": 62,
        "chore/": 28,
        "refactor/": 20,
      },
      funHeadline: "Claude named a variable 'thisIsDefinitelyNotAHack'",
      funDetail: "It survived code review and made it to staging.",
    }),

    // ── Jordan: /insights report ───────────────────────
    insightsReport(users["jordan-reeves"].id, "jordan-reeves", {
      sessions: 89,
      messages: 1120,
      commits: 156,
      dateStart: "2026-03-05",
      dateEnd: "2026-04-04",
      days: 30,
      linesAdded: 18900,
      linesRemoved: 4200,
      detectedSkills: ["custom_skills", "hooks", "headless_mode"],
      whatsWorking:
        "Incredible shipping velocity. You launched 2 complete MVPs in a single month, going from idea to deployed product in under 2 weeks each. Your use of headless mode for overnight feature builds is a power-user pattern that most developers haven't discovered.",
      whatsHindering:
        "Design iteration loops are the main bottleneck. You spend significant time going back and forth on CSS and layout, often cycling through 5-6 versions before settling. The visual side of development is where the most time is lost.",
      quickWins:
        "Adopt a design system (shadcn/ui or similar) and add it to CLAUDE.md. Your 18 CSS iteration sessions would shrink dramatically with pre-built, composable components.",
      ambitiousWorkflows:
        "Your headless overnight builds could become a full product factory — queue up 3-4 features before bed, wake up to implemented code with tests.",
      narrative:
        "You are a rapid-fire shipper who prioritizes getting products to users above all else. Your sessions are fast-paced and output-focused — you rarely pause for planning, preferring to iterate in code. This ship-first mentality is reflected in your high commit count (156 in 30 days) and your willingness to use headless mode for overnight builds. You're one of the few developers who treats Claude Code as a 24/7 production line.",
      keyPattern:
        "Key pattern: Ship-first builder who maximizes output through headless overnight builds and fast iteration.",
      projects: [
        {
          name: "SaaS Waitlist Builder",
          sessions: 34,
          description:
            "Complete waitlist management SaaS with Stripe payments, email sequences, and analytics dashboard.",
        },
        {
          name: "AI Recipe Generator",
          sessions: 28,
          description:
            "Consumer app that generates recipes from pantry photos using vision APIs, with meal planning and shopping lists.",
        },
        {
          name: "Personal Site v4",
          sessions: 15,
          description:
            "Portfolio site rebuild with blog, project showcase, and contact form.",
        },
      ],
      workflows: [
        {
          title: "Overnight Headless Builds",
          description:
            "Queues 2-3 feature implementations before bed using headless mode. Wakes up to completed features with tests, reviews the diff, and ships by morning.",
        },
        {
          title: "MVP Speed Runs",
          description:
            "Goes from idea to deployed product in 10-14 days by maintaining a strict scope, using templates, and letting Claude handle boilerplate while focusing on the core differentiator.",
        },
      ],
      frictionIntro: "Design iteration is the primary friction point.",
      frictions: [
        {
          category: "CSS Iteration Loops",
          description:
            "Visual design decisions take 5-6 rounds to converge. Claude's first-pass CSS is functional but rarely matches the desired aesthetic.",
          examples: [
            "Landing page hero took 8 iterations to get right",
            "Card layout spacing adjusted 6 times across 2 sessions",
          ],
        },
      ],
      funHeadline: "Claude built an entire feature while you were sleeping",
      funDetail:
        "Left a headless session running overnight to add Stripe integration. Woke up to a fully working payment flow, complete with webhook handling and a receipt email template. Zero bugs in production.",
    }),

    // ── Priya: /insight-harness report ─────────────────
    harnessReport(users["priya-sharma"].id, "priya-sharma", {
      sessions: 67,
      messages: 980,
      commits: 78,
      dateStart: "2026-03-10",
      dateEnd: "2026-04-06",
      days: 27,
      linesAdded: 12300,
      linesRemoved: 3800,
      // Directive / SaaS builder — moderate caching, ~15x scale-up.
      tokens: 42_000_000,
      // Lifetime ≈ 2.7× — consistent focused SaaS work over several months.
      lifetimeTokens: 115_000_000,
      durationHours: 52,
      avgSession: 47,
      skills: 24,
      hooks: 8,
      prs: 18,
      autonomyLabel: "Collaborative",
      detectedSkills: [
        "custom_skills",
        "hooks",
        "mcp_servers",
        "plan_mode",
        "subagents",
        "playwright",
      ],
      toolUsage: {
        Read: 2100,
        Edit: 1400,
        Bash: 2800,
        Grep: 1200,
        Glob: 800,
        Write: 600,
        Agent: 180,
      },
      skillInventory: [
        {
          name: "test-browser",
          calls: 42,
          source: "plugin",
          description: "Playwright browser testing",
        },
        {
          name: "brainstorm",
          calls: 28,
          source: "plugin",
          description: "Multi-agent brainstorming",
        },
        {
          name: "debug",
          calls: 24,
          source: "custom",
          description: "Systematic debugging workflow",
        },
        {
          name: "insight-harness",
          calls: 8,
          source: "custom",
          description: "Generate harness profile",
        },
        {
          name: "prd",
          calls: 6,
          source: "plugin",
          description: "Product requirements doc",
        },
      ],
      hookDefs: [
        {
          event: "PostToolUse:Write",
          matcher: "*.py",
          script: "ruff format $FILE",
        },
        {
          event: "PostToolUse:Edit",
          matcher: "*.py",
          script: "ruff format $FILE",
        },
        {
          event: "PreCommit",
          matcher: "(all)",
          script: "ruff check . && pytest --tb=short",
        },
        {
          event: "PostToolUse:Bash",
          matcher: "rm -rf|drop|delete",
          script: "echo 'Blocked destructive command' && exit 1",
        },
        {
          event: "SessionStart",
          matcher: "(all)",
          script: "cat agent/HANDOFF.md",
        },
      ],
      plugins: [
        {
          name: "compound-engineering",
          version: "2.1.0",
          marketplace: "anthropic",
          active: true,
        },
        {
          name: "superpowers",
          version: "1.8.0",
          marketplace: "anthropic",
          active: true,
        },
      ],
      featurePills: [
        { name: "Status Line", active: true, value: "" },
        { name: "Task Agents", active: true, value: "18%" },
        { name: "MCP", active: true, value: "22%" },
        { name: "Web Search", active: true, value: "8%" },
        { name: "Sub-Agents", active: true, value: "180" },
        { name: "Plan Mode", active: true, value: "28" },
        { name: "Compactions", active: false, value: "0" },
      ],
      models: {
        "claude-opus-4-6": 520,
        "claude-sonnet-4-6": 380,
        "claude-haiku-4-5": 80,
      },
      languages: {
        Python: 480,
        TypeScript: 120,
        YAML: 90,
        JSON: 60,
        Markdown: 45,
      },
      cliTools: {
        python3: 280,
        pytest: 220,
        ruff: 180,
        pip: 90,
        git: 250,
        docker: 120,
      },
      fileOpStyle: {
        readPct: 38,
        editPct: 30,
        writePct: 32,
        grepCount: 1200,
        globCount: 800,
        style: "Full-File Writer",
      },
      whatsWorking:
        "Deep integration of MCP servers and Playwright testing. Your browser-test-driven workflow catches UI regressions that unit tests miss entirely.",
      narrative:
        "Collaborative ML engineer who thinks through problems with Claude before coding.",
      keyPattern:
        "Collaborative thinker who uses Claude for design discussions before implementation.",
      projects: [
        {
          name: "ML Pipeline Orchestrator",
          sessions: 28,
          description:
            "FastAPI service orchestrating ML model training, evaluation, and deployment pipelines",
        },
        {
          name: "Agent Framework",
          sessions: 22,
          description:
            "Custom agent framework for autonomous task execution with tool use and memory",
        },
        {
          name: "Data Labeling Tool",
          sessions: 17,
          description:
            "Internal tool for data annotation with active learning and model-assisted labeling",
        },
      ],
      workflowPatterns: [
        {
          sequence: [
            "compound-engineering:ce-brainstorm",
            "compound-engineering:ce-plan",
            "superpowers:test-driven-development",
            "pr-review-toolkit:silent-failure-hunter",
          ],
          count: 21,
        },
        {
          sequence: [
            "compound-engineering:ce-plan",
            "pr-review-toolkit:code-reviewer",
          ],
          count: 12,
        },
      ],
      skillInvocations: {
        "compound-engineering:ce-brainstorm": 28,
        "compound-engineering:ce-plan": 32,
        "superpowers:test-driven-development": 21,
        "pr-review-toolkit:silent-failure-hunter": 14,
        "pr-review-toolkit:code-reviewer": 19,
        "anthropics:claude-api": 11,
      },
      mcpServers: {
        anthropic_api: 126,
        hugging_face: 48,
        wandb: 22,
      },
      permissionModes: { plan: 70, auto: 25, dontAsk: 5 },
      hookFrequency: {
        "PostToolUse:Write": 82,
        "PreToolUse:Bash": 18,
      },
      extraWriteupSections: [
        {
          title: "Custom Skill Workshop",
          contentHtml:
            "<p>Priya maintains an extensive library of custom skills focused on ML pipelines: data validation, model evaluation, and experiment tracking. Each skill is treated as a first-class artifact with its own tests.</p>",
        },
        {
          title: "Silent-Failure Hunting",
          contentHtml:
            "<p>Heavy use of <code>pr-review-toolkit:silent-failure-hunter</code> on every PR. Priya has surfaced 12 silent-catch patterns in her codebase this month alone.</p>",
        },
      ],
      branchPrefixes: {
        "feat/": 34,
        "fix/": 28,
        "experiment/": 14,
        "data/": 8,
      },
      funHeadline: "Claude wrote a haiku in a docstring",
      funDetail:
        "While documenting a data pipeline function, Claude added: 'Data flows like water / Through pipes of transformation / Clean output emerges'. The team voted to keep it.",
    }),

    // ── Marcus: /insights report ───────────────────────
    insightsReport(users["marcus-chen"].id, "marcus-chen", {
      sessions: 56,
      messages: 780,
      commits: 124,
      dateStart: "2026-03-08",
      dateEnd: "2026-04-05",
      days: 28,
      linesAdded: 8900,
      linesRemoved: 2100,
      detectedSkills: ["hooks", "plan_mode"],
      whatsWorking:
        "Infrastructure automation workflows are extremely efficient. Your Terraform module generation has an 85% first-pass success rate, and your Kubernetes manifest templating saves hours of manual YAML writing. The disciplined plan-first approach to infrastructure changes prevents costly mistakes.",
      whatsHindering:
        "Multi-cloud complexity is causing friction. Sessions involving cross-cloud resource management (AWS + GCP) take 2x longer than single-cloud sessions due to API differences and IAM complexity.",
      quickWins:
        "Create a CLAUDE.md section with your team's cloud resource naming conventions and IAM patterns. The 9 sessions where Claude guessed wrong on naming would have been avoided.",
      ambitiousWorkflows:
        "Build a Claude-powered infrastructure drift detector that compares Terraform state against live resources and generates PRs for any discrepancies.",
      narrative:
        "You are a meticulous infrastructure engineer who uses Claude Code as a senior SRE assistant. Every session starts with clear context about the target environment, existing resources, and constraints. Your commit-per-session ratio (124/56 = 2.2) is remarkably high — you ship efficiently and rarely need rework. You prefer plan mode for infrastructure changes, which is wise given the blast radius of IaC mistakes.",
      keyPattern:
        "Key pattern: Cautious infrastructure automator who provides rich context and uses plan mode to prevent costly mistakes.",
      projects: [
        {
          name: "Cloud Platform Migration",
          sessions: 22,
          description:
            "Migrating services from AWS to a multi-cloud setup with Terraform and Kubernetes.",
        },
        {
          name: "CI/CD Pipeline Overhaul",
          sessions: 18,
          description:
            "Rebuilding the entire CI/CD pipeline with GitHub Actions, ArgoCD, and automated canary deployments.",
        },
        {
          name: "Monitoring Stack",
          sessions: 16,
          description:
            "Prometheus + Grafana + PagerDuty monitoring with custom dashboards and alert rules.",
        },
      ],
      workflows: [
        {
          title: "Terraform Module Factory",
          description:
            "Generates production-ready Terraform modules from 2-3 sentence descriptions, including variables, outputs, tests, and documentation. 85% first-pass accuracy.",
        },
        {
          title: "Incident Response Automation",
          description:
            "Generates runbooks from post-mortem docs, creates monitoring alerts, and proposes infrastructure fixes in under 10 minutes.",
        },
      ],
      frictionIntro:
        "Multi-cloud complexity and security scanning integration are the primary friction sources.",
      frictions: [
        {
          category: "Multi-Cloud Complexity",
          description:
            "Cross-cloud sessions take 2x longer due to API differences between AWS and GCP.",
          examples: [
            "IAM role translation between AWS and GCP took 3 attempts",
            "Network peering config required manual correction for GCP-specific syntax",
          ],
        },
        {
          category: "Security Scan Integration",
          description:
            "Integrating Trivy and Snyk scan results into the deployment pipeline has been inconsistent.",
          examples: [
            "False positives in container scanning blocked 4 deployments",
            "Dependency vulnerability remediation generated breaking changes",
          ],
        },
      ],
      funHeadline:
        "Claude tried to delete the production database 'to simplify things'",
      funDetail:
        "While cleaning up unused resources in the staging environment, Claude proposed a Terraform plan that would have dropped the production database. The pre-commit hook caught it. Everyone got a reminder about environment isolation.",
    }),

    // ── Elena: /insight-harness report ─────────────────
    harnessReport(users["elena-volkov"].id, "elena-volkov", {
      sessions: 98,
      messages: 1560,
      commits: 167,
      dateStart: "2026-03-03",
      dateEnd: "2026-04-02",
      days: 30,
      linesAdded: 22100,
      linesRemoved: 8400,
      // Heavy agent work + long-context embeddings → aggressive caching.
      tokens: 65_000_000,
      // Lifetime ≈ 3.0× — heavy agent + long-context embedding usage
      // accumulates large cache_read volumes over time.
      lifetimeTokens: 195_000_000,
      durationHours: 72,
      avgSession: 44,
      skills: 12,
      hooks: 4,
      prs: 28,
      autonomyLabel: "Directive",
      detectedSkills: ["custom_skills", "hooks", "code_review", "worktrees"],
      toolUsage: {
        Read: 3400,
        Edit: 2600,
        Bash: 2200,
        Grep: 1800,
        Glob: 1100,
        Write: 700,
        Agent: 240,
      },
      skillInventory: [
        {
          name: "commit",
          calls: 78,
          source: "custom",
          description: "Conventional commit with changelog",
        },
        {
          name: "simplify",
          calls: 34,
          source: "plugin",
          description: "Code simplification review",
        },
        {
          name: "code-review",
          calls: 28,
          source: "plugin",
          description: "PR code review",
        },
        {
          name: "test-browser",
          calls: 18,
          source: "plugin",
          description: "Playwright browser tests",
        },
      ],
      hookDefs: [
        {
          event: "PostToolUse:Write",
          matcher: "*.rb",
          script: "rubocop -A $FILE",
        },
        {
          event: "PostToolUse:Edit",
          matcher: "*.rb",
          script: "rubocop -A $FILE",
        },
        {
          event: "PreCommit",
          matcher: "(all)",
          script: "bundle exec rspec --fail-fast",
        },
      ],
      plugins: [
        {
          name: "compound-engineering",
          version: "2.1.0",
          marketplace: "anthropic",
          active: true,
        },
      ],
      featurePills: [
        { name: "Status Line", active: true, value: "" },
        { name: "Task Agents", active: true, value: "14%" },
        { name: "MCP", active: false, value: "0%" },
        { name: "Web Search", active: true, value: "3%" },
        { name: "Sub-Agents", active: true, value: "240" },
        { name: "Plan Mode", active: true, value: "22" },
        { name: "Compactions", active: true, value: "8" },
      ],
      models: { "claude-sonnet-4-6": 720, "claude-opus-4-6": 340 },
      languages: {
        Ruby: 520,
        TypeScript: 280,
        JavaScript: 180,
        CSS: 120,
        HTML: 80,
        SQL: 60,
      },
      cliTools: {
        bundle: 280,
        rails: 220,
        rspec: 200,
        rubocop: 180,
        git: 260,
        node: 120,
        npm: 90,
      },
      fileOpStyle: {
        readPct: 44,
        editPct: 40,
        writePct: 16,
        grepCount: 1800,
        globCount: 1100,
        style: "Surgical Editor",
      },
      whatsWorking:
        "Clean, disciplined Rails workflow. Your commit-to-PR ratio is excellent and your use of the /simplify skill keeps code maintainable across multiple client projects.",
      narrative:
        "Directive freelancer who provides clear specs and lets Claude implement while she reviews.",
      keyPattern:
        "Experienced freelancer who uses Claude as a disciplined implementation partner.",
      projects: [
        {
          name: "E-commerce Platform",
          sessions: 38,
          description:
            "Rails 8 e-commerce with Hotwire, Stripe, and inventory management",
        },
        {
          name: "Client Portal",
          sessions: 32,
          description:
            "Multi-tenant client portal with document sharing and project tracking",
        },
        {
          name: "Marketing Site",
          sessions: 28,
          description:
            "Responsive marketing site with CMS, blog, and SEO optimization",
        },
      ],
      workflowPatterns: [
        {
          sequence: [
            "compound-engineering:frontend-design",
            "superpowers:writing-plans",
            "superpowers:executing-plans",
            "commit-commands:commit-push-pr",
          ],
          count: 38,
        },
        {
          sequence: [
            "superpowers:writing-plans",
            "pr-review-toolkit:code-reviewer",
          ],
          count: 19,
        },
      ],
      skillInvocations: {
        "compound-engineering:frontend-design": 42,
        "superpowers:writing-plans": 35,
        "superpowers:executing-plans": 48,
        "commit-commands:commit-push-pr": 54,
        "pr-review-toolkit:code-reviewer": 26,
        "anthropics:claude-api": 8,
      },
      mcpServers: {
        stripe: 64,
        cloudflare: 31,
        claude_ai_GitHub: 88,
      },
      permissionModes: { plan: 55, auto: 40, acceptEdits: 5 },
      hookFrequency: {
        "PostToolUse:Write": 108,
        "PostToolUse:Edit": 164,
        PreCommit: 42,
      },
      extraWriteupSections: [
        {
          title: "Ship-First Freelancer Pattern",
          contentHtml:
            "<p>Elena ships 2-3 client projects per month. Her workflow balances directive planning (to stay on scope) with frontend-design skill invocations for rapid UI iteration. Stripe integrations are hook-verified before any commit.</p>",
        },
      ],
      branchPrefixes: { "feat/": 72, "fix/": 24, "client/": 18, "deploy/": 6 },
      funHeadline:
        "Claude apologized for a 'strongly-worded' code review comment",
      funDetail:
        "After writing 'This pattern will cause problems at scale and should be refactored immediately' in a review, Claude followed up with 'I apologize if that came across as harsh. The code works, but here are some gentler suggestions...'",
    }),

    // ── Sam: /insights report (junior dev) ─────────────
    insightsReport(users["sam-okafor"].id, "sam-okafor", {
      sessions: 34,
      messages: 620,
      commits: 28,
      dateStart: "2026-03-15",
      dateEnd: "2026-04-05",
      days: 21,
      linesAdded: 4200,
      linesRemoved: 800,
      detectedSkills: ["plan_mode"],
      whatsWorking:
        "Excellent learning trajectory. You've gone from basic file edits to multi-component features in 3 weeks. Your use of plan mode shows thoughtful development habits forming early. The questions you ask Claude are getting more specific and architectural over time.",
      whatsHindering:
        "Debugging is still slow — you often describe symptoms rather than providing error messages or logs, which leads to Claude guessing at the problem. Copy-pasting the actual error output would speed things up significantly.",
      quickWins:
        "When you hit an error, always paste the full error message and stack trace into Claude. Your 8 debugging sessions that took over an hour could have been resolved in 15 minutes with better error context.",
      ambitiousWorkflows:
        "Start using Claude's Grep and Read tools to explore unfamiliar codebases before making changes. Understanding the existing code structure will help you make better architectural decisions.",
      narrative:
        "You are an enthusiastic junior developer who is rapidly improving with Claude Code as a learning partner. Your sessions show a clear growth arc — early sessions involved simple tasks like adding buttons and fixing typos, while recent sessions tackle full feature implementations with multiple files. You ask thoughtful questions about why Claude makes certain choices, which accelerates your learning. Your commit frequency is lower than average, but each commit is more deliberate.",
      keyPattern:
        "Key pattern: Growth-oriented junior developer who uses Claude as a patient teacher and pair programming partner.",
      projects: [
        {
          name: "Task Manager App",
          sessions: 18,
          description:
            "A full-stack task management app built as a learning project. React frontend, Express backend, PostgreSQL.",
        },
        {
          name: "Personal Portfolio",
          sessions: 10,
          description:
            "Portfolio website with project showcase, blog section, and contact form.",
        },
        {
          name: "CLI Quiz Game",
          sessions: 6,
          description:
            "A command-line trivia game built to practice Node.js fundamentals.",
        },
      ],
      workflows: [
        {
          title: "Learn-by-Building",
          description:
            "Each new concept is learned by building a real feature. Claude explains the concept, implements it, then Sam modifies it to verify understanding. This hands-on approach is building solid foundations.",
        },
      ],
      frictionIntro:
        "Debugging efficiency and error reporting are the main areas for improvement.",
      frictions: [
        {
          category: "Vague Error Descriptions",
          description:
            "8 debugging sessions lasted over an hour because the error was described as 'it doesn't work' rather than sharing the actual error output.",
          examples: [
            "'The page is broken' led to 45 minutes of guessing — the actual error was a missing import",
            "'The API doesn't work' turned out to be a CORS issue visible in the browser console",
          ],
        },
      ],
      funHeadline: "Claude taught Sam what a 'monad' is using pizza toppings",
      funDetail:
        "When Sam asked about functional programming concepts, Claude explained monads as 'wrapping a pizza in a box — you can transform the pizza inside without opening the box'. Sam reportedly told their entire bootcamp cohort.",
    }),

    // ── Jordan: /insight-harness report ────────────────
    harnessReport(users["jordan-reeves"].id, "jordan-reeves", {
      sessions: 89,
      messages: 1120,
      commits: 156,
      dateStart: "2026-03-05",
      dateEnd: "2026-04-02",
      days: 28,
      linesAdded: 22100,
      linesRemoved: 6800,
      // Infra / incident tooling — collaborative, plenty of context reuse.
      tokens: 48_000_000,
      // Lifetime ≈ 2.5× — steady collaborative use across incident response work.
      lifetimeTokens: 120_000_000,
      durationHours: 54,
      avgSession: 28,
      skills: 9,
      hooks: 2,
      prs: 18,
      autonomyLabel: "Directive",
      detectedSkills: [
        "headless_mode",
        "custom_skills",
        "plan_mode",
        "parallel_agents",
      ],
      toolUsage: {
        Read: 2200,
        Edit: 1900,
        Bash: 2400,
        Write: 1100,
        Grep: 800,
        Glob: 600,
      },
      skillInventory: [
        {
          name: "deploy",
          calls: 48,
          source: "custom",
          description: "Ship to Vercel + run smoke tests",
        },
        {
          name: "headless-build",
          calls: 31,
          source: "custom",
          description: "Queue overnight feature builds",
        },
        {
          name: "scope-check",
          calls: 22,
          source: "custom",
          description: "Prevent scope creep on MVPs",
        },
      ],
      hookDefs: [
        {
          event: "PostToolUse:Write",
          matcher: "*.ts",
          script: "prettier --write $FILE",
        },
      ],
      plugins: [
        {
          name: "superpowers",
          version: "1.4.2",
          marketplace: "official",
          active: true,
        },
        {
          name: "commit-commands",
          version: "0.9.1",
          marketplace: "community",
          active: true,
        },
      ],
      featurePills: [
        { name: "Headless", active: true, value: "overnight" },
        { name: "Plan Mode", active: true, value: "MVP" },
      ],
      models: { opus: 620000, sonnet: 2100000, haiku: 380000 },
      languages: { TypeScript: 62, Python: 12, Shell: 26 },
      cliTools: { git: 340, vercel: 48, gh: 82 },
      fileOpStyle: {
        readPct: 30,
        editPct: 40,
        writePct: 30,
        grepCount: 420,
        globCount: 190,
        style: "ship-first",
      },
      workflowPatterns: [
        {
          sequence: [
            "superpowers:writing-plans",
            "superpowers:executing-plans",
            "commit-commands:commit-push-pr",
          ],
          count: 42,
        },
        {
          sequence: [
            "superpowers:dispatching-parallel-agents",
            "commit-commands:commit-push-pr",
          ],
          count: 15,
        },
      ],
      skillInvocations: {
        "superpowers:writing-plans": 38,
        "superpowers:executing-plans": 52,
        "superpowers:dispatching-parallel-agents": 19,
        "commit-commands:commit-push-pr": 64,
        "commit-commands:commit": 41,
      },
      whatsWorking:
        "Fastest shipper in the demo set. Overnight headless builds convert plans into shipped features without human supervision for hours at a time.",
      narrative:
        "Jordan is an indie hacker who lives on 'ship it' energy. Launches headless builds overnight, reviews diffs over coffee, and pushes straight to production.",
      keyPattern:
        "Key pattern: Plan → headless execute → ship. Minimal review loop, maximum throughput.",
      projects: [
        {
          name: "Lemonstand (SaaS)",
          sessions: 34,
          description: "B2B invoicing SaaS shipped solo in 14 days",
        },
        {
          name: "FormKit Clone",
          sessions: 22,
          description: "OSS form builder — 1.2k stars in 3 weeks",
        },
      ],
      mcpServers: {
        vercel: 48,
        supabase: 34,
        stripe: 24,
        claude_ai_GitHub: 72,
      },
      permissionModes: { plan: 40, auto: 50, acceptEdits: 10 },
      hookFrequency: {
        "PostToolUse:Write": 98,
      },
      extraWriteupSections: [
        {
          title: "Headless Overnight Builds",
          contentHtml:
            "<p>Jordan's signature move: queue a feature build before bed, wake up to a shipped PR. The headless-build skill combined with scope-check protection lets Claude run autonomously for 4-6 hours without breaking the MVP.</p>",
        },
      ],
      branchPrefixes: { "feat/": 84, "fix/": 42, "ship/": 28 },
      funHeadline: "Claude shipped a feature while Jordan was at the gym",
      funDetail:
        "Left a headless session running on a Stripe integration. Came back 90 minutes later to a working payment flow, webhook handling, and a Vercel deploy.",
    }),

    // ── Marcus: /insight-harness report ────────────────
    harnessReport(users["marcus-chen"].id, "marcus-chen", {
      sessions: 56,
      messages: 780,
      commits: 42,
      dateStart: "2026-03-08",
      dateEnd: "2026-04-04",
      days: 27,
      linesAdded: 8900,
      linesRemoved: 3100,
      // Freelance / Rails — collaborative, medium cache ratio.
      tokens: 32_000_000,
      // Lifetime ≈ 2.25× — part-time freelance cadence, lower tenure than
      // the heavy full-time personas.
      lifetimeTokens: 72_000_000,
      durationHours: 38,
      avgSession: 25,
      skills: 7,
      hooks: 4,
      prs: 11,
      autonomyLabel: "Collaborative",
      detectedSkills: ["hooks", "subagents", "mcp_servers", "plan_mode"],
      toolUsage: {
        Read: 1600,
        Edit: 1100,
        Bash: 1800,
        Grep: 700,
        Write: 320,
      },
      skillInventory: [
        {
          name: "tf-review",
          calls: 28,
          source: "custom",
          description: "Terraform plan pre-flight check",
        },
        {
          name: "k8s-debug",
          calls: 19,
          source: "custom",
          description: "Kubernetes incident triage",
        },
        {
          name: "incident",
          calls: 14,
          source: "custom",
          description: "Incident postmortem generator",
        },
      ],
      hookDefs: [
        {
          event: "PreToolUse:Bash",
          matcher: "terraform apply|kubectl apply",
          script: "echo 'Destructive k8s/tf apply — confirming'",
        },
        {
          event: "PostToolUse:Edit",
          matcher: "*.tf",
          script: "terraform fmt $FILE",
        },
      ],
      plugins: [
        {
          name: "superpowers",
          version: "1.4.2",
          marketplace: "official",
          active: true,
        },
        {
          name: "pr-review-toolkit",
          version: "2.0.3",
          marketplace: "community",
          active: true,
        },
        {
          name: "anthropics",
          version: "1.2.0",
          marketplace: "official",
          active: true,
        },
      ],
      featurePills: [
        { name: "Hooks", active: true, value: "k8s guard" },
        { name: "MCP", active: true, value: "grafana" },
      ],
      models: { opus: 1100000, sonnet: 1200000, haiku: 100000 },
      languages: {
        HCL: 41,
        YAML: 29,
        Go: 18,
        Python: 12,
      },
      cliTools: { git: 180, kubectl: 320, terraform: 180, gh: 45 },
      fileOpStyle: {
        readPct: 55,
        editPct: 30,
        writePct: 15,
        grepCount: 620,
        globCount: 140,
        style: "read-heavy",
      },
      workflowPatterns: [
        {
          sequence: [
            "compound-engineering:ce-plan",
            "superpowers:subagent-driven-development",
            "pr-review-toolkit:code-reviewer",
          ],
          count: 24,
        },
        {
          sequence: [
            "superpowers:dispatching-parallel-agents",
            "pr-review-toolkit:silent-failure-hunter",
          ],
          count: 11,
        },
      ],
      skillInvocations: {
        "compound-engineering:ce-plan": 32,
        "superpowers:subagent-driven-development": 28,
        "superpowers:dispatching-parallel-agents": 19,
        "pr-review-toolkit:code-reviewer": 24,
        "pr-review-toolkit:silent-failure-hunter": 18,
        "anthropics:claude-api": 9,
      },
      whatsWorking:
        "Infrastructure-as-code workflows benefit heavily from hook-guarded destructive operations. Subagent delegation for parallel Terraform plans saves 30-40% of review time.",
      narrative:
        "Marcus is a DevOps lead who treats Claude Code as a cautious-but-fast collaborator. Hooks gate dangerous operations. Subagents handle parallel infra checks. Reviews are deliberate.",
      keyPattern:
        "Key pattern: Plan-heavy, hook-guarded, subagent-delegated infrastructure automation.",
      projects: [
        {
          name: "Terraform Monorepo",
          sessions: 28,
          description: "50+ modules across 4 AWS accounts, shared CI/CD",
        },
        {
          name: "Grafana On-Call Dashboard",
          sessions: 14,
          description: "Incident triage dashboard with SLO burn alerts",
        },
      ],
      mcpServers: {
        grafana: 28,
        aws_cli: 54,
        kubernetes: 72,
        claude_ai_GitHub: 48,
      },
      permissionModes: { plan: 78, auto: 15, acceptEdits: 7 },
      hookFrequency: {
        "PreToolUse:Bash": 89,
        "PostToolUse:Edit": 56,
      },
      extraWriteupSections: [
        {
          title: "Infrastructure-as-Code Discipline",
          contentHtml:
            "<p>Marcus treats every <code>terraform apply</code> and <code>kubectl apply</code> as a potential production incident. PreToolUse:Bash hooks force an explicit confirmation step before any destructive infra operation. This has caught two near-miss prod changes this month.</p>",
        },
        {
          title: "Subagent-Delegated Review",
          contentHtml:
            "<p>Heavy use of <code>superpowers:subagent-driven-development</code> to run parallel infrastructure checks — one subagent plans the change, another reviews the Terraform diff, a third checks for drift against the live state.</p>",
        },
      ],
      branchPrefixes: { "feat/": 18, "fix/": 12, "infra/": 14, "incident/": 4 },
      funHeadline: "A hook saved Marcus from deleting prod (twice)",
      funDetail:
        "PreToolUse:Bash hook matched `terraform apply` against the prod account and blocked execution until a confirmation file existed. Once on a Monday morning, once on a Friday afternoon. Both times it was the right call.",
    }),

    // ── Sam: /insight-harness report ───────────────────
    harnessReport(users["sam-okafor"].id, "sam-okafor", {
      sessions: 34,
      messages: 620,
      commits: 28,
      dateStart: "2026-03-15",
      dateEnd: "2026-04-05",
      days: 21,
      linesAdded: 4200,
      linesRemoved: 800,
      // New to Claude Code, short exploratory sessions, lighter caching.
      tokens: 9_500_000,
      // Lifetime ≈ 1.1× — Sam only started recently, so the 30-day window
      // IS most of his lifetime usage. A "new user" marker visually.
      lifetimeTokens: 10_500_000,
      durationHours: 18,
      avgSession: 22,
      skills: 4,
      hooks: 1,
      prs: 6,
      autonomyLabel: "Collaborative",
      detectedSkills: ["plan_mode", "code_review"],
      toolUsage: {
        Read: 1400,
        Edit: 620,
        Bash: 380,
        Grep: 420,
        Write: 140,
      },
      skillInventory: [
        {
          name: "explain-this",
          calls: 31,
          source: "custom",
          description: "Line-by-line code explanation for learning",
        },
        {
          name: "first-pr",
          calls: 8,
          source: "custom",
          description: "Guided walkthrough for opening a pull request",
        },
      ],
      hookDefs: [
        {
          event: "PostToolUse:Write",
          matcher: "*.js",
          script: "prettier --write $FILE",
        },
      ],
      plugins: [
        {
          name: "superpowers",
          version: "1.4.2",
          marketplace: "official",
          active: true,
        },
        {
          name: "pr-review-toolkit",
          version: "2.0.3",
          marketplace: "community",
          active: true,
        },
      ],
      featurePills: [
        { name: "Plan Mode", active: true, value: "always" },
        { name: "Review", active: true, value: "learning" },
      ],
      models: { sonnet: 680000, haiku: 100000 },
      languages: { JavaScript: 48, TypeScript: 32, CSS: 20 },
      cliTools: { git: 62, gh: 14 },
      fileOpStyle: {
        readPct: 62,
        editPct: 22,
        writePct: 16,
        grepCount: 380,
        globCount: 70,
        style: "read-first",
      },
      workflowPatterns: [
        {
          sequence: [
            "superpowers:brainstorming",
            "superpowers:writing-plans",
            "superpowers:test-driven-development",
            "pr-review-toolkit:code-reviewer",
          ],
          count: 14,
        },
      ],
      skillInvocations: {
        "superpowers:brainstorming": 18,
        "superpowers:writing-plans": 24,
        "superpowers:test-driven-development": 16,
        "pr-review-toolkit:code-reviewer": 22,
      },
      whatsWorking:
        "Growth trajectory is clear. Each week's commits show more confident architectural decisions. Using plan mode consistently before any non-trivial change.",
      narrative:
        "Sam is a junior developer learning fast. Plan-first habits are already forming. Reviews are treated as learning opportunities rather than checklists.",
      keyPattern:
        "Key pattern: Plan → TDD → review. Every change is explained before it's made.",
      projects: [
        {
          name: "Bootcamp Capstone",
          sessions: 22,
          description: "Full-stack task tracker for final project review",
        },
        {
          name: "Portfolio Site",
          sessions: 12,
          description: "Next.js personal site with blog and case studies",
        },
      ],
      mcpServers: {},
      permissionModes: { plan: 88, auto: 5, acceptEdits: 7 },
      hookFrequency: {
        "PostToolUse:Write": 48,
      },
      extraWriteupSections: [
        {
          title: "Learning-First Pattern",
          contentHtml:
            "<p>Sam uses <code>/explain-this</code> on every non-trivial file before making changes. Plan mode is almost always engaged — Sam treats Claude as a patient teacher rather than an autocomplete. This read-first discipline is unusually mature for a junior developer.</p>",
        },
      ],
      branchPrefixes: { "feat/": 14, "fix/": 10, "learn/": 4 },
      funHeadline: "Sam's first PR got merged in 4 days",
      funDetail:
        "Used the `/first-pr` skill to draft the description, added tests without being asked, and got a rare 'LGTM ship it' from the senior reviewer on first pass.",
    }),
  ];

  for (const data of reports) {
    const { slug, authorId } = data;
    await prisma.insightReport.upsert({
      where: { authorId_slug: { authorId, slug } },
      update: {},
      create: data,
    });
    console.log(`  ✓ ${slug} (${data.reportType})`);
  }

  console.log("\nCreating project libraries for demo users...");
  // For each demo user, build a library of Projects and attach each
  // library project to every report that user owns via the junction
  // table. This gives demo profiles a realistic cross-report library
  // that propagates retroactively on edit (Decision 1 in the spec).
  for (const demoUser of DEMO_USERS) {
    const userRow = users[demoUser.username];
    const library = defaultProjectSeedFor(demoUser.githubId);
    const createdProjects = [];
    for (const seed of library) {
      // Use upsert-by-composite so reruns don't duplicate. Since we
      // have no natural unique constraint on (userId, name), we use
      // findFirst + create to avoid adding a constraint for seed-only
      // convenience.
      const existing = await prisma.project.findFirst({
        where: { userId: userRow.id, name: seed.name },
      });
      const project =
        existing ??
        (await prisma.project.create({
          data: {
            userId: userRow.id,
            name: seed.name,
            description: seed.description,
            githubUrl: seed.githubUrl,
            liveUrl: seed.liveUrl,
          },
        }));
      createdProjects.push(project);
    }

    const userReports = await prisma.insightReport.findMany({
      where: { authorId: userRow.id },
      select: { id: true },
    });
    for (const report of userReports) {
      for (let i = 0; i < createdProjects.length; i++) {
        const project = createdProjects[i];
        // Upsert the junction row by the unique (reportId, projectId)
        await prisma.reportProject.upsert({
          where: {
            reportId_projectId: {
              reportId: report.id,
              projectId: project.id,
            },
          },
          update: {},
          create: {
            reportId: report.id,
            projectId: project.id,
            position: i,
          },
        });
      }
    }
    console.log(
      `  ✓ @${demoUser.username}: ${createdProjects.length} projects, ${userReports.length} reports linked`,
    );
  }

  console.log(
    `\nDone! Created ${DEMO_USERS.length} users and ${reports.length} reports.`,
  );
  console.log(
    "\nTo clean up later, run: npx tsx prisma/seed-demos.ts --cleanup",
  );
}

async function cleanup() {
  console.log("Cleaning up demo data...");

  // Delete reports by demo users first (FK constraint)
  const demoUsers = await prisma.user.findMany({
    where: { githubId: { startsWith: "demo-" } },
    select: { id: true, username: true },
  });

  const ids = demoUsers.map((u) => u.id);
  if (ids.length === 0) {
    console.log("No demo users found.");
    return;
  }

  // Delete all related records
  const reportIds = await prisma.insightReport.findMany({
    where: { authorId: { in: ids } },
    select: { id: true },
  });
  const rids = reportIds.map((r) => r.id);

  if (rids.length > 0) {
    await prisma.sectionVote.deleteMany({ where: { reportId: { in: rids } } });
    await prisma.sectionHighlight.deleteMany({
      where: { reportId: { in: rids } },
    });
    await prisma.comment.deleteMany({ where: { reportId: { in: rids } } });
    await prisma.authorAnnotation.deleteMany({
      where: { reportId: { in: rids } },
    });
    // Junction rows for the persistent-projects model. Note the
    // Project rows themselves are removed below via the User cascade
    // (Project.userId → User onDelete: Cascade).
    await prisma.reportProject.deleteMany({
      where: { reportId: { in: rids } },
    });
  }

  const delReports = await prisma.insightReport.deleteMany({
    where: { authorId: { in: ids } },
  });
  const delUsers = await prisma.user.deleteMany({ where: { id: { in: ids } } });

  console.log(
    `Deleted ${delReports.count} reports and ${delUsers.count} users:`,
  );
  for (const u of demoUsers) {
    console.log(`  ✗ @${u.username}`);
  }
}

async function main() {
  try {
    if (process.argv.includes("--cleanup")) {
      await cleanup();
    } else {
      await seed();
    }
  } finally {
    await prisma.$disconnect();
  }
}

main();
