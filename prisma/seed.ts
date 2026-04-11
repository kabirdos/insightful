import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Create demo users
  const alice = await prisma.user.upsert({
    where: { githubId: "demo-alice" },
    update: {},
    create: {
      githubId: "demo-alice",
      username: "alice-codes",
      displayName: "Alice Chen",
      avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=alice",
      bio: "Full-stack dev building with Claude Code daily. TypeScript + React enthusiast.",
    },
  });

  const bob = await prisma.user.upsert({
    where: { githubId: "demo-bob" },
    update: {},
    create: {
      githubId: "demo-bob",
      username: "bob-builder",
      displayName: "Bob Martinez",
      avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=bob",
      bio: "Backend engineer using Claude for infrastructure automation.",
    },
  });

  const carol = await prisma.user.upsert({
    where: { githubId: "demo-carol" },
    update: {},
    create: {
      githubId: "demo-carol",
      username: "carol-dev",
      displayName: "Carol Nguyen",
      avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=carol",
      bio: "Indie hacker shipping products fast with AI-assisted coding.",
    },
  });

  // Create demo insight reports
  const report1 = await prisma.insightReport.upsert({
    where: { slug: "alice-codes-20260315-demo1" },
    update: {},
    create: {
      authorId: alice.id,
      title: "78 sessions · 892 messages · 67 commits",
      slug: "alice-codes-20260315-demo1",
      sessionCount: 78,
      messageCount: 892,
      commitCount: 67,
      dateRangeStart: "2026-02-15",
      dateRangeEnd: "2026-03-15",
      atAGlance: {
        whats_working:
          "Excellent use of parallel agents for test generation. Built comprehensive test suites across 3 projects simultaneously, achieving 90%+ coverage on new features. The pattern of spawning dedicated test agents per module is highly effective.",
        whats_hindering:
          "CSS debugging loops are eating significant time. 23 sessions involved multiple rounds of fixing responsive layouts. Consider using a design system or component library to reduce styling friction.",
        quick_wins:
          "Try using Claude's headless mode for running lint + test suites before each commit. Your 34 buggy_code friction events suggest catching issues earlier would save substantial rework time.",
        ambitious_workflows:
          "Your parallel agent pattern for test generation could be extended to code review. Spawn review agents that check for security, performance, and accessibility in parallel after each feature implementation.",
      },
      interactionStyle: {
        narrative:
          "You are a methodical builder who uses Claude Code as a test-driven development partner. Your sessions follow a consistent pattern: spec out the feature, write tests first, then implement until tests pass. When tests fail, you debug systematically rather than making random changes. Your heavy use of the Agent tool (245 calls) shows you've mastered parallel execution for independent tasks.",
        key_pattern:
          "Test-first developer who leverages parallel agents for comprehensive test coverage and treats Claude as a TDD pair programming partner.",
      },
      projectAreas: {
        areas: [
          {
            name: "[redacted] Dashboard App",
            session_count: 32,
            description:
              "Building a real-time analytics dashboard with WebSocket updates, chart components, and role-based access control. Heavy focus on testing and responsive design.",
          },
          {
            name: "[redacted] API Gateway",
            session_count: 25,
            description:
              "Designing and implementing a microservices API gateway with rate limiting, authentication middleware, and request routing. Focus on performance and reliability.",
          },
          {
            name: "Open Source CLI Tool",
            session_count: 21,
            description:
              "Creating a developer CLI tool for project scaffolding with templates, plugin system, and interactive prompts. Published to npm with comprehensive documentation.",
          },
        ],
      },
      impressiveWorkflows: {
        intro:
          "Across 78 sessions, you've developed several standout workflows that maximize Claude Code's capabilities.",
        impressive_workflows: [
          {
            title: "Parallel Test Generation Pipeline",
            description:
              "You consistently spawn 5-7 test agents in parallel, each responsible for a module's test suite. This generates comprehensive test coverage in minutes rather than hours, and your modules consistently hit 90%+ coverage.",
          },
          {
            title: "Spec-to-Implementation Loop",
            description:
              "Your workflow of writing detailed specs in markdown, then having Claude implement against the spec while running tests continuously, produces remarkably clean first-pass implementations with minimal rework.",
          },
        ],
      },
      frictionAnalysis: {
        intro:
          "Your main friction points center around CSS/responsive design and environment configuration.",
        categories: [
          {
            category: "CSS Responsive Design Loops",
            description:
              "23 sessions involved multiple rounds of responsive layout fixes. Claude often gets mobile breakpoints wrong on the first pass, requiring 3-4 correction cycles.",
            examples: [
              "Grid layout broke on tablet viewport requiring 4 fix attempts",
              "Mobile nav menu z-index issues across 3 separate sessions",
            ],
          },
          {
            category: "Environment Configuration Drift",
            description:
              "Development and production env vars falling out of sync caused deployment failures in 8 sessions.",
            examples: [
              "Missing API keys in production that existed locally",
              "Different database connection string formats between environments",
            ],
          },
        ],
      },
      suggestions: {
        claude_md_additions: [
          {
            addition:
              "Always test responsive layouts at mobile (375px), tablet (768px), and desktop (1280px) breakpoints before considering CSS work complete.",
            why: "23 sessions had CSS responsive issues — codifying breakpoint testing would catch these earlier.",
            prompt_scaffold: "Add under ## UI Development section",
          },
        ],
        features_to_try: [
          {
            feature: "Hooks",
            one_liner: "Auto-run shell commands at specific lifecycle events.",
            why_for_you:
              "Your 34 buggy_code events could be reduced by auto-running tests after each edit.",
            example_code:
              '{ "hooks": { "postEdit": ["npm test -- --changed"] } }',
          },
        ],
        usage_patterns: [
          {
            title: "Standardize your TDD loop",
            suggestion:
              "Your most successful sessions follow spec-first, test-first patterns. Make this the default.",
            detail:
              "Sessions using TDD had 3x fewer buggy_code events than sessions without upfront tests.",
            copyable_prompt:
              "Before implementing: 1) Write the spec as comments, 2) Generate test file from spec, 3) Implement until all tests pass, 4) Refactor.",
          },
        ],
      },
      onTheHorizon: {
        intro:
          "Your TDD workflow positions you well for next-generation Claude capabilities.",
        opportunities: [
          {
            title: "Self-Healing Test Suites",
            whats_possible:
              "Claude can detect flaky tests, diagnose root causes, and fix them autonomously — running the full suite in a loop until stable.",
            how_to_try:
              "Use Agent tool to spawn a test-healing agent that runs tests, identifies flaky ones, and fixes them.",
            copyable_prompt:
              "Find all flaky tests in the suite. For each: run it 5 times, identify the instability cause, fix the root issue, verify stability.",
          },
        ],
      },
      funEnding: {
        headline:
          'Claude tried to refactor the entire codebase "while it was at it"',
        detail:
          "During a simple button color change, Claude decided the entire component library needed a refactor and started rewriting 15 files before being stopped. The button color was changed to blue.",
      },
    },
  });

  const report2 = await prisma.insightReport.upsert({
    where: { slug: "bob-builder-20260320-demo2" },
    update: {},
    create: {
      authorId: bob.id,
      title: "45 sessions · 534 messages · 89 commits",
      slug: "bob-builder-20260320-demo2",
      sessionCount: 45,
      messageCount: 534,
      commitCount: 89,
      dateRangeStart: "2026-02-20",
      dateRangeEnd: "2026-03-20",
      atAGlance: {
        whats_working:
          "Infrastructure-as-code workflows are extremely productive. You've automated Terraform plan reviews, Kubernetes manifest generation, and CI/CD pipeline creation with impressive accuracy. Claude handles your DevOps tasks like a senior SRE.",
        whats_hindering:
          "Docker build optimization sessions take too long. Multi-stage builds with complex dependency chains cause Claude to propose suboptimal layer ordering, requiring manual correction. Also, security scanning integration has been inconsistent.",
        quick_wins:
          "Add your Dockerfile best practices to CLAUDE.md — layer ordering rules, multi-stage patterns, and cache mount instructions. This would eliminate the repeated corrections you're making.",
        ambitious_workflows:
          "Consider using Claude to implement a GitOps workflow where infrastructure changes are proposed as PRs, reviewed by a Claude agent for security/cost implications, and auto-applied after approval.",
      },
      interactionStyle: {
        narrative:
          "You are an infrastructure-focused engineer who uses Claude Code primarily for DevOps automation. Your sessions are highly focused — typically one clear objective per session with minimal scope creep. You provide detailed context about your infrastructure (cloud provider, region, existing resources) upfront, which leads to higher first-pass accuracy. Your commit-to-session ratio (89/45 = 1.98) is remarkably high, indicating efficient, focused work.",
        key_pattern:
          "Focused DevOps automator who provides rich infrastructure context and achieves high commit-per-session efficiency.",
      },
      projectAreas: {
        areas: [
          {
            name: "[redacted] Cloud Platform",
            session_count: 20,
            description:
              "Managing and automating cloud infrastructure across multiple environments. Terraform modules, Kubernetes deployments, and monitoring setup.",
          },
          {
            name: "[redacted] CI/CD Pipeline",
            session_count: 15,
            description:
              "Building and optimizing continuous integration and deployment pipelines. GitHub Actions workflows, Docker builds, and automated testing.",
          },
          {
            name: "Monitoring & Alerting",
            session_count: 10,
            description:
              "Setting up comprehensive monitoring with Prometheus, Grafana dashboards, and PagerDuty alerting rules.",
          },
        ],
      },
      impressiveWorkflows: {
        intro:
          "Your DevOps workflows demonstrate exceptional efficiency and automation depth.",
        impressive_workflows: [
          {
            title: "Terraform Module Generator",
            description:
              "You've developed a workflow where Claude generates complete Terraform modules from high-level descriptions, including variables, outputs, documentation, and testing with Terratest. Modules are production-ready on first pass 80% of the time.",
          },
          {
            title: "Incident Response Automation",
            description:
              "Built an automated incident response system where Claude generates runbooks from post-mortem documents, creates monitoring alerts, and proposes infrastructure fixes — reducing mean time to resolution.",
          },
        ],
      },
      frictionAnalysis: {
        intro:
          "Friction is concentrated in Docker optimization and security tooling integration.",
        categories: [
          {
            category: "Docker Build Optimization",
            description:
              "Multi-stage Docker builds with complex dependencies consistently produce suboptimal layer ordering, requiring 2-3 manual corrections per session.",
            examples: [
              "Node.js build layers not caching package.json separately",
              "Python wheels rebuilt unnecessarily due to wrong COPY ordering",
            ],
          },
        ],
      },
      suggestions: {
        claude_md_additions: [
          {
            addition:
              "For Dockerfiles: always separate dependency installation from code copying. COPY package*.json first, then RUN install, then COPY the rest.",
            why: "Repeated corrections for Docker layer caching — this pattern should be automatic.",
            prompt_scaffold: "Add under ## Docker section",
          },
        ],
        features_to_try: [
          {
            feature: "Custom Skills",
            one_liner:
              "Reusable prompts as markdown files triggered with /command.",
            why_for_you:
              "Your Terraform module generation workflow would benefit from a standardized /terraform-module skill.",
            example_code:
              "mkdir -p .claude/skills/terraform && cat > .claude/skills/terraform/SKILL.md << 'EOF'\n# Terraform Module Generator\n1. Accept module name and description\n2. Generate main.tf, variables.tf, outputs.tf\n3. Add README with usage examples\n4. Generate basic Terratest\nEOF",
          },
        ],
        usage_patterns: [
          {
            title: "Front-load infrastructure context",
            suggestion:
              "Your best sessions start with detailed context about existing infra.",
            detail:
              "Sessions with upfront context had 2x fewer wrong_approach events.",
            copyable_prompt:
              "Context: Cloud provider: [X], Region: [Y], Existing resources: [Z]. I need to [describe task].",
          },
        ],
      },
      onTheHorizon: {
        intro:
          "Infrastructure automation is one of the highest-leverage areas for AI-assisted development.",
        opportunities: [
          {
            title: "Autonomous Infrastructure Drift Detection",
            whats_possible:
              "Claude can continuously compare your Terraform state with actual cloud resources, detect drift, and propose corrective changes as PRs.",
            how_to_try:
              "Schedule a Claude headless mode job that runs terraform plan and creates issues for any detected drift.",
            copyable_prompt:
              "Run terraform plan for all modules. For each module with changes: create a GitHub issue describing the drift, propose a fix, and estimate blast radius.",
          },
        ],
      },
      funEnding: {
        headline:
          'Claude accidentally proposed deleting the production database "for cleanup"',
        detail:
          "During a routine Terraform refactor, Claude included a destroy block for the production RDS instance in its plan, cheerfully noting it would 'clean up unused resources.' The plan review caught it, but not before a brief moment of panic.",
      },
    },
  });

  const report3 = await prisma.insightReport.upsert({
    where: { slug: "carol-dev-20260325-demo3" },
    update: {},
    create: {
      authorId: carol.id,
      title: "156 sessions · 2,100 messages · 201 commits",
      slug: "carol-dev-20260325-demo3",
      sessionCount: 156,
      messageCount: 2100,
      commitCount: 201,
      dateRangeStart: "2026-02-25",
      dateRangeEnd: "2026-03-25",
      atAGlance: {
        whats_working:
          "Incredible shipping velocity — 201 commits across 156 sessions shows you're using Claude as a true force multiplier. Your ability to go from idea to deployed product in single-day sprints is remarkable. The brainstorm-to-code pipeline using skills and parallel agents is a masterclass in AI-assisted product development.",
        whats_hindering:
          "Scope creep during implementation sessions. What starts as 'add a login button' becomes 'redesign the entire auth flow with social providers, 2FA, and admin dashboard.' Claude enables this by being willing to take on any scope, but it leads to half-finished features and context window exhaustion.",
        quick_wins:
          "Before each session, write a 1-sentence scope statement and stick to it. Your sessions that had clear, narrow goals (like 'fix the payment webhook') completed 3x faster than open-ended ones.",
        ambitious_workflows:
          "You're already pushing the boundaries of what's possible. Consider building a personal 'ship tracker' that logs each deploy, tracks user metrics, and feeds data back into your Claude sessions for context-aware product decisions.",
      },
      interactionStyle: {
        narrative:
          "You are a rapid-fire product builder who treats Claude Code as a co-founder. Your sessions are intense bursts of creation — brainstorming product ideas, building MVPs, iterating on user feedback, and shipping to production, sometimes multiple products in a single day. You rarely pause to plan extensively; instead, you trust your instincts and Claude's ability to course-correct. This produces impressive output volume but occasionally leads to technical debt that accumulates across projects.",
        key_pattern:
          "Rapid-shipping indie hacker who uses Claude as a co-founder, prioritizing speed and iteration over upfront planning.",
      },
      projectAreas: {
        areas: [
          {
            name: "[redacted] SaaS App",
            session_count: 65,
            description:
              "Building and launching a B2B SaaS application from scratch. Full-stack Next.js with payments, onboarding flows, dashboard, and email notifications. Shipped to production and onboarded first paying customers.",
          },
          {
            name: "[redacted] Mobile App",
            session_count: 45,
            description:
              "React Native mobile application with real-time features, push notifications, and offline sync. Iterative UX improvements based on beta tester feedback.",
          },
          {
            name: "Personal Website & Blog",
            session_count: 25,
            description:
              "Portfolio site with integrated blog, project showcases, and newsletter signup. Multiple redesigns to find the right aesthetic.",
          },
          {
            name: "Open Source Contributions",
            session_count: 21,
            description:
              "Contributing to various open source projects — bug fixes, documentation improvements, and new feature PRs. Using Claude for code review before submitting.",
          },
        ],
      },
      impressiveWorkflows: {
        intro:
          "Your shipping velocity across 156 sessions is genuinely impressive. Here are the workflows that stood out.",
        impressive_workflows: [
          {
            title: "Zero-to-Production Sprint",
            description:
              "You completed full product launches in single-day sprints — from initial brainstorm to deployed, payment-enabled SaaS — multiple times. The combination of skills, parallel agents, and your product instincts creates a remarkably fast feedback loop.",
          },
          {
            title: "User Feedback Integration Loop",
            description:
              "Your workflow of collecting beta tester feedback, triaging it in Claude, implementing fixes, and deploying updates within hours demonstrates a tight product iteration cycle that most teams take weeks to achieve.",
          },
          {
            title: "Multi-Project Context Switching",
            description:
              "You maintain productive sessions across 4+ concurrent projects without losing context. Your use of project-specific CLAUDE.md files and clear session goals enables rapid context switching that would typically cause significant productivity loss.",
          },
        ],
      },
      frictionAnalysis: {
        intro:
          "Your main friction comes from scope management and the consequences of moving fast.",
        categories: [
          {
            category: "Scope Creep During Implementation",
            description:
              "42 sessions expanded well beyond their initial goal. Features grew 3-5x in complexity during implementation, often exhausting the context window before completion.",
            examples: [
              "'Add a settings page' became 'redesign settings with sections, permissions, import/export, and audit log'",
              "'Fix mobile layout' expanded to 'complete responsive redesign with new navigation patterns'",
            ],
          },
          {
            category: "Technical Debt Accumulation",
            description:
              "The speed-first approach leaves behind inconsistent patterns, duplicate code, and missing error handling that creates friction in later sessions.",
            examples: [
              "3 different auth patterns across the same project from iterative changes",
              "Error handling missing in 40% of API routes, causing silent failures in production",
            ],
          },
        ],
      },
      suggestions: {
        claude_md_additions: [
          {
            addition:
              "Each session must have a single, specific goal defined before starting. Do not expand scope beyond the original goal without explicit user approval.",
            why: "42 sessions had scope creep — a hard constraint would prevent Claude from enabling unbounded expansion.",
            prompt_scaffold: "Add at the top of CLAUDE.md as Rule #1",
          },
        ],
        features_to_try: [
          {
            feature: "Headless Mode",
            one_liner: "Run Claude non-interactively from scripts.",
            why_for_you:
              "Automate your deployment and QA flows that currently require manual session management.",
            example_code:
              "claude -p 'Run all tests, fix failures, and deploy to staging' --allowedTools 'Edit,Read,Bash'",
          },
        ],
        usage_patterns: [
          {
            title: "Define session scope upfront",
            suggestion:
              "Write a 1-sentence goal for every session before starting.",
            detail: "Scoped sessions completed 3x faster with fewer bugs.",
            copyable_prompt:
              "Session goal: [ONE SENTENCE]. Do not expand beyond this scope. If you see related improvements, note them for a future session but do not implement them now.",
          },
        ],
      },
      onTheHorizon: {
        intro:
          "Your rapid-shipping style is perfectly positioned for the next wave of AI capabilities.",
        opportunities: [
          {
            title: "Autonomous Product Iteration Agent",
            whats_possible:
              "A Claude agent that monitors your deployed app's error logs, user analytics, and support tickets, then automatically proposes and implements fixes — creating a self-improving product loop.",
            how_to_try:
              "Set up a scheduled Claude headless job that checks error tracking, analyzes patterns, and creates fix PRs.",
            copyable_prompt:
              "Check the error tracking dashboard. For each error occurring more than 5 times: diagnose the root cause, implement a fix, write a test to prevent regression, and create a PR with full context.",
          },
        ],
      },
      funEnding: {
        headline:
          "Claude suggested 'shipping it' as the solution to a critical bug",
        detail:
          "When asked to fix a data validation error that was corrupting user records, Claude's first suggestion was to 'ship the fix to production immediately to stop the bleeding.' The fix was correct, but the confidence with which it proposed deploying untested code to a production database was both impressive and terrifying.",
      },
    },
  });

  // Add some votes
  const sectionKeys = [
    "impressive_workflows.0",
    "impressive_workflows.1",
    "friction_analysis.0",
    "at_a_glance",
    "interaction_style",
    "suggestions.features_to_try.0",
    "on_the_horizon.0",
    "fun_ending",
  ];

  // Cross-vote between users
  for (const key of sectionKeys.slice(0, 3)) {
    await prisma.sectionVote.upsert({
      where: {
        userId_reportId_sectionKey: {
          userId: bob.id,
          reportId: report1.id,
          sectionKey: key,
        },
      },
      update: {},
      create: { userId: bob.id, reportId: report1.id, sectionKey: key },
    });
  }

  for (const key of sectionKeys.slice(0, 5)) {
    await prisma.sectionVote.upsert({
      where: {
        userId_reportId_sectionKey: {
          userId: carol.id,
          reportId: report1.id,
          sectionKey: key,
        },
      },
      update: {},
      create: { userId: carol.id, reportId: report1.id, sectionKey: key },
    });
  }

  for (const key of sectionKeys.slice(0, 4)) {
    await prisma.sectionVote.upsert({
      where: {
        userId_reportId_sectionKey: {
          userId: alice.id,
          reportId: report2.id,
          sectionKey: key,
        },
      },
      update: {},
      create: { userId: alice.id, reportId: report2.id, sectionKey: key },
    });
  }

  for (const key of sectionKeys.slice(0, 6)) {
    await prisma.sectionVote.upsert({
      where: {
        userId_reportId_sectionKey: {
          userId: alice.id,
          reportId: report3.id,
          sectionKey: key,
        },
      },
      update: {},
      create: { userId: alice.id, reportId: report3.id, sectionKey: key },
    });
    await prisma.sectionVote.upsert({
      where: {
        userId_reportId_sectionKey: {
          userId: bob.id,
          reportId: report3.id,
          sectionKey: key,
        },
      },
      update: {},
      create: { userId: bob.id, reportId: report3.id, sectionKey: key },
    });
  }

  // Add comments
  await prisma.comment.create({
    data: {
      authorId: bob.id,
      reportId: report1.id,
      body: "The parallel test generation pipeline is brilliant! I've been doing tests sequentially like a caveman. Going to try spawning multiple test agents on my next project.",
    },
  });

  await prisma.comment.create({
    data: {
      authorId: carol.id,
      reportId: report1.id,
      body: "Love the spec-to-implementation loop. I've been winging it and the difference in code quality is obvious. Time to adopt TDD with Claude.",
      sectionKey: "impressive_workflows.1",
    },
  });

  await prisma.comment.create({
    data: {
      authorId: alice.id,
      reportId: report2.id,
      body: "The Terraform module generator workflow is exactly what I need for my infra work. Do you have a CLAUDE.md snippet for the prompts you use?",
    },
  });

  await prisma.comment.create({
    data: {
      authorId: carol.id,
      reportId: report2.id,
      body: "That fun ending about the production database is too real. I've had similar near-misses with Claude and destructive operations.",
      sectionKey: "fun_ending",
    },
  });

  await prisma.comment.create({
    data: {
      authorId: bob.id,
      reportId: report3.id,
      body: "156 sessions in a month is incredible output. The scope creep analysis resonates — I struggle with the same thing when Claude is so willing to take on more work.",
    },
  });

  // Add projects to each demo user's library and attach them to the
  // report via the ReportProject junction.
  const aliceCliProject = await prisma.project.create({
    data: {
      userId: alice.id,
      name: "CLI Scaffolding Tool",
      githubUrl: "https://github.com/demo/cli-scaffold",
      description:
        "The open source CLI tool mentioned in the insights — project scaffolding with templates and plugins.",
    },
  });
  await prisma.reportProject.create({
    data: {
      reportId: report1.id,
      projectId: aliceCliProject.id,
      position: 0,
    },
  });

  const carolPortfolioProject = await prisma.project.create({
    data: {
      userId: carol.id,
      name: "Personal Portfolio",
      liveUrl: "https://example.com",
      description:
        "The portfolio site built during these sessions — multiple redesigns to find the right look.",
    },
  });
  await prisma.reportProject.create({
    data: {
      reportId: report3.id,
      projectId: carolPortfolioProject.id,
      position: 0,
    },
  });

  // Add author annotations
  await prisma.authorAnnotation.create({
    data: {
      reportId: report1.id,
      sectionKey: "impressive_workflows.0",
      body: "The key to making parallel test agents work is giving each one a clear module boundary. I use the project's folder structure to define agent scope — one agent per src/ subdirectory.",
    },
  });

  await prisma.authorAnnotation.create({
    data: {
      reportId: report3.id,
      sectionKey: "friction_analysis.0",
      body: "I've since started using a session scope template that has dramatically reduced scope creep. The trick is writing it down BEFORE opening Claude Code, not after you've already started.",
    },
  });

  // Add highlights
  await prisma.sectionHighlight.create({
    data: {
      userId: bob.id,
      reportId: report1.id,
      sectionKey: "impressive_workflows.0",
    },
  });
  await prisma.sectionHighlight.create({
    data: {
      userId: carol.id,
      reportId: report1.id,
      sectionKey: "impressive_workflows.0",
    },
  });
  await prisma.sectionHighlight.create({
    data: {
      userId: alice.id,
      reportId: report3.id,
      sectionKey: "impressive_workflows.0",
    },
  });

  console.log("Seed data created successfully!");
  console.log(
    `  - 3 users: ${alice.username}, ${bob.username}, ${carol.username}`,
  );
  console.log(
    `  - 3 insight reports with votes, comments, annotations, and highlights`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
