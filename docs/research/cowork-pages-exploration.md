# Cowork Pages — Exploration Report

**Date:** 2026-04-04
**Method:** 10-agent consensus brainstorm + 5-agent debate chamber (3 rounds) + Team Lead synthesis + iterative design refinement
**Branch:** `feat/agent-learning-network`
**Full HTML report:** `~/Documents/Claude Reports/insightful-agent-learning-network-2026-04-04.html`

---

## The Idea

A social-type site for Claude Cowork users where each person has a page and their Cowork instance can answer questions about their workflows. Not a forum — a network of agent-represented profiles.

**Positioning:** Moltbook is a Reddit for OpenClaw agents. Cowork Pages is a homepage for Claude Cowork users, where your Cowork instance can answer questions from people who found you on Twitter or GitHub.

## The Problem It Solves

The people who publicly share their Claude Code workflows on Twitter/YouTube are a tiny, self-selecting minority. The other 95% of skilled practitioners never post. Their knowledge is locked inside their repos and session logs. Currently there is no mechanism to learn from them unless you personally know them.

Cowork Pages solves the _next_ problem after discovery: "I found someone interesting on Twitter, now how do I learn from them without cold-DMing them and hoping they reply with a 20-paragraph explanation of their setup?"

## Competitive Landscape

### Moltbook (Meta-owned)

- Launched January 28, 2026 by Matt Schlicht
- Reddit-style forum for AI agents ("submolts"), humans can only view
- Runs on OpenClaw (by Peter Steinberger)
- 201,412 verified agents by late March 2026
- Acquired by Meta on March 10, 2026 (undisclosed price), team joined Meta Superintelligence Labs
- Had major security breach: Supabase misconfiguration exposed ~1.5M API tokens, 35k emails, private agent messages (disclosed by Wiz)
- **Key takeaway:** Moltbook is agent-first (humans observe). Acquired, not dead. Meta will invest in this space.

### Claude Cowork + Dispatch

- Claude Cowork = Anthropic's persistent-collaborator product
- Dispatch = feature inside Cowork, lets you message Claude from your phone while it works on your desktop (launched March 17, 2026)
- Claude Code Channels = Telegram/Discord messaging for Claude Code
- April 4, 2026: Anthropic cut off third-party agentic tools from using Claude subscriptions (OpenClaw users can no longer use Claude Pro/Max)
- **Key takeaway:** Anthropic is consolidating its ecosystem. No Claude-native social layer exists yet. Open lane.

## Design: Cowork Pages

### What a page is

Each Cowork user has a URL like `insightful.dev/@username`. The page contains:

1. **Identity strip** — name, GitHub, Twitter/X, bio, linked repos
2. **Opted-in projects** — the slice of the owner's Claude Code / Cowork work they're willing to let their agent discuss. Shown as tiles with session counts and last-activity dates.
3. **The Ask box** — "Ask [name]'s Cowork about their workflows"
4. **Public Q&A log** — past questions and answers the owner chose to publish. Google-indexable, shareable on Twitter.
5. **Pinned workflows** — optional short essays the owner wrote (or agent-drafted and owner-edited) about specific things they've figured out.

### The ask-answer flow

1. Visitor lands on page (discovered owner via Twitter thread, GitHub, etc.)
2. Visitor types a question (e.g., "How do you structure your CLAUDE.md files for monorepos?")
3. Visitor either has Insightful account (GitHub-authed, attributed) or posts anonymously with rate limits
4. Question is dispatched to owner's Cowork
5. Owner's Cowork drafts an answer grounded in actual /insights from opted-in projects
6. **Policy gate** runs:
   - _Auto-answer_ if question is about public repos and answer is under N words
   - _Queue for review_ otherwise
   - _Reject_ if it touches projects marked private
7. If auto-answered: answer appears on page, owner gets "FYI" in Telegram
8. If queued: owner sees it in dashboard + Telegram notification, reviews, edits, sends or declines
9. Answer published on page (unless owner marks it private)

### Human-in-the-loop controls

Three non-negotiable controls, all owner-side:

1. **Scope gate** — which projects the agent can reference. Default: none. Owner explicitly opts in.
2. **Answer review** — every outgoing answer can be "review before send" or "send automatically." Start reviewed, relax over time.
3. **Kill switch** — owner can revoke their agent from the platform at any time; all past answers become inaccessible.

### Discovery model

Discovery stays external. Insightful does not try to be the discovery layer. You find people through Twitter, GitHub, conference talks, word of mouth. Then you visit their Insightful page.

The only discovery feature in v1: "paste a GitHub username, get their page if they have one." No feed, no recommendations, no trending.

### Why Cowork makes this native

- **Dispatch is the incoming-question inbox.** Questions arrive in Cowork the same way any dispatched task does. No separate inbox.
- **Claude Code Channels is the notification layer.** Owners already have Telegram/Discord wired. No new tool to check.
- **/insights is already the corpus.** No new data format needed. Page agent runs RAG over existing /insights for opted-in projects.
- **Safety positioning matches Anthropic's.** "Claude asks before opening a new app" → "Your Cowork asks before answering a stranger about a private project."

### What it deliberately doesn't try to be

- **Not a feed.** No home timeline, no "what's trending."
- **Not agent-to-agent automation.** Humans type every question in v1.
- **Not a marketplace.** No credits, no payments.
- **Not anonymous.** Page owners must be real identified humans.

## Earlier Exploration: Consensus Brainstorm + Debate

Before arriving at the page model, we ran a broader exploration of an "agent learning forum" concept. Key findings that informed the final design:

### Consensus brainstorm (10 agents)

Top recommendations (3+ of 10 agreed):

1. Strict versioned schema for uploads (7/10)
2. GitHub auth + reputation/provenance system (7/10)
3. Forum-first, gate agent automation (6/10)
4. Human approval before skill adoption (5/10)
5. Provenance/outcome tracking (5/10)
6. Content decay mechanics (3/10)

Notable outliers:

- Optimize for sharing failures, not successes (Contrarian)
- Transactional credit-based exchange (Disruptor)
- Agents must "cite" before publishing (Historian)
- Real signal is intent-outcome delta (Systems Thinker)
- Dispatch as webhook notification, not autonomous browser (Pragmatist)

### Debate chamber (5 agents, 3 rounds)

Converged on: start with one domain, outcome signal is non-negotiable, validate transfer before scaling. Original plan was a 14-week closed beta scoped to TypeScript refactoring.

The page model pivot made the debate's original plan less relevant — the existential question changed from "does workflow transfer work?" to "will skilled practitioners opt in to host an agent that represents their work?"

## MVP Scope (4-6 weeks, solo-buildable)

1. Landing page: "Claim your Cowork Page" (GitHub OAuth)
2. Project opt-in flow: connects to /insights, shows projects, owner ticks boxes
3. Page rendering: identity strip + opted-in projects + Ask box + public Q&A log
4. Ask-handler: question → dispatches to owner's Cowork → RAG over opted-in /insights → draft answer
5. Policy engine: simple rules (auto / queue / reject) with sane defaults
6. Owner dashboard: pending queue, sent history, scope settings, kill switch
7. Channels integration: Telegram/Discord pings for pending questions

## Validation Plan

Find 10 people who are active on Claude Cowork's Max tier AND post about their workflows on Twitter. Ask: "If your Cowork could answer questions from people who follow your work — with you reviewing answers before they send — would you turn it on?" If 6+ say yes, the supply side exists.

This is a recruiting question, not a research question.

## Key Differentiators vs. Moltbook

| Axis                   | Moltbook                           | Cowork Pages                                     |
| ---------------------- | ---------------------------------- | ------------------------------------------------ |
| Who posts              | Agents only, humans observe        | Humans discover, agents assist                   |
| Structure              | Topic threads (submolts)           | Person-scoped pages                              |
| Trust model            | Claim-tweet verification           | GitHub auth + human-reviewed answers             |
| Content                | Agents gossip about humans         | Agents answer specific questions about real work |
| Blast radius of breach | Platform-wide (1.5M tokens leaked) | Per-page (each page is own trust boundary)       |
| Owner                  | Meta Superintelligence Labs        | Independent                                      |

## References

- [Meta acquires Moltbook (Axios)](https://www.axios.com/2026/03/10/meta-facebook-moltbook-agent-social-network)
- [Meta acquired Moltbook (TechCrunch)](https://techcrunch.com/2026/03/10/meta-acquired-moltbook-the-ai-agent-social-network-that-went-viral-because-of-fake-posts/)
- [Moltbook - Wikipedia](https://en.wikipedia.org/wiki/Moltbook)
- [Moltbook security breach (Wiz)](https://www.wiz.io/blog/exposed-moltbook-database-reveals-millions-of-api-keys)
- [Claude Dispatch vs OpenClaw (Apex Hours)](https://www.apexhours.com/claude-dispatch-vs-openclaw-the-battle-of-ai-desktop-agents/)
- [Claude Cowork Dispatch (Latent Space)](https://www.latent.space/p/ainews-claude-cowork-dispatch-anthropics)
- [Anthropic cuts third-party agent access (VentureBeat)](https://venturebeat.com/technology/anthropic-cuts-off-the-ability-to-use-claude-subscriptions-with-openclaw-and)
- [Claude Code Channels (VentureBeat)](https://venturebeat.com/orchestration/anthropic-just-shipped-an-openclaw-killer-called-claude-code-channels)
