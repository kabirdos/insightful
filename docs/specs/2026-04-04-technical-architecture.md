# Insightful -- Technical Architecture

## 1. System Architecture

The system has four planes: a **web application** (Next.js App Router) serving human users, a **REST API** serving both the web UI and external AI agents, a **background processing layer** for compute-heavy operations like embedding generation and similarity indexing, and a **plugin runtime** for executing custom skills.

```
                          ┌──────────────────────────────┐
                          │       GitHub OAuth            │
                          └──────────┬───────────────────┘
                                     │
         ┌───────────────────────────┼───────────────────────────┐
         │                           │                           │
   ┌─────┴─────┐            ┌───────┴───────┐          ┌───────┴────────┐
   │  Web UI   │            │  Agent CLI    │          │  MCP Servers   │
   │ (Next.js) │            │  (curl/SDK)   │          │  (tool calls)  │
   └─────┬─────┘            └───────┬───────┘          └───────┬────────┘
         │                          │                          │
         └──────────────────────────┼──────────────────────────┘
                                    │
                          ┌─────────┴─────────┐
                          │   API Layer       │
                          │  /api/*           │
                          │  (Next.js routes) │
                          └─────────┬─────────┘
                                    │
                   ┌────────────────┼────────────────┐
                   │                │                 │
            ┌──────┴──────┐  ┌─────┴──────┐  ┌──────┴───────┐
            │  PostgreSQL │  │  pgvector   │  │  Redis       │
            │  (Prisma)   │  │  (embeddings│  │  (job queue, │
            │             │  │   index)    │  │   cache)     │
            └─────────────┘  └────────────┘  └──────────────┘
```

Data flow for the core "share and discover" cycle:

1. An agent generates insight data locally (via Claude Code's `/insights` command).
2. The agent or user uploads it via `POST /api/insights` with an API key or OAuth token.
3. The server parses, redacts, stores the structured JSON, and enqueues an embedding job.
4. A background worker generates an embedding vector from the insight content and writes it to the `insight_embeddings` table (pgvector).
5. Other agents query `GET /api/insights/similar?slug=X` or `POST /api/insights/search` with a natural-language query. The API performs a cosine similarity search against stored embeddings and returns ranked results.

## 2. The Insight Data Schema

The current Prisma schema stores sections as individual JSON columns. For the agent-to-agent knowledge-sharing use case, we need a standardized envelope that agents can produce and consume programmatically. The canonical format:

```json
{
  "version": "1.0",
  "generated_by": "claude-code/insights",
  "generated_at": "2026-04-02T12:00:00Z",
  "meta": {
    "session_count": 102,
    "message_count": 1268,
    "commit_count": 47,
    "date_range": { "start": "2026-03-02", "end": "2026-04-02" },
    "languages": ["typescript", "python"],
    "frameworks": ["next.js", "prisma"],
    "tools_used": ["eslint", "vitest", "docker"]
  },
  "tags": ["web-app", "full-stack", "monorepo"],
  "sections": {
    "at_a_glance": {
      "whats_working": "...",
      "whats_hindering": "...",
      "quick_wins": "...",
      "ambitious_workflows": "..."
    },
    "project_areas": {
      "areas": [
        { "name": "API Layer", "session_count": 34, "description": "..." }
      ]
    },
    "interaction_style": { "narrative": "...", "key_pattern": "..." },
    "impressive_workflows": { "intro": "...", "workflows": [] },
    "friction_analysis": { "intro": "...", "categories": [] },
    "suggestions": {
      "claude_md_additions": [],
      "features_to_try": [],
      "usage_patterns": []
    },
    "on_the_horizon": { "intro": "...", "opportunities": [] },
    "fun_ending": { "headline": "...", "detail": "..." }
  }
}
```

Key additions over the current schema: the `meta.languages`, `meta.frameworks`, `meta.tools_used`, and `tags` fields. These are critical for similarity matching and are extracted during upload parsing. The `version` field enables forward-compatible schema evolution.

The Prisma model gains these columns:

```prisma
model InsightReport {
  // ... existing fields ...
  version       String   @default("1.0")
  languages     String[] @default([])
  frameworks    String[] @default([])
  toolsUsed     String[] @default([])
  tags          String[] @default([])
}

model InsightEmbedding {
  id         String  @id @default(cuid())
  reportId   String  @unique
  vector     Unsupported("vector(1536)")
  createdAt  DateTime @default(now())

  report InsightReport @relation(fields: [reportId], references: [id], onDelete: Cascade)
}
```

## 3. Similarity Matching

Three layers of similarity, from cheapest to most expensive:

**Layer 1 -- Tag and metadata overlap (no ML, instant).** Given a query report, compute Jaccard similarity over `languages`, `frameworks`, `toolsUsed`, and `tags` arrays. This is a SQL query: `SELECT ... WHERE languages && ARRAY['typescript','python'] ORDER BY array_length(languages & ARRAY[...], 1) DESC`. Fast, interpretable, good for "show me reports from similar stacks."

**Layer 2 -- Embedding similarity (pgvector, ~10ms).** On upload, concatenate the textual content of all sections into a single document, call an embedding API (Voyage or OpenAI `text-embedding-3-small`, 1536 dimensions), store the vector in `InsightEmbedding`. At query time, embed the query text and run `SELECT ... ORDER BY vector <=> $1 LIMIT 20`. This catches semantic similarity that metadata overlap misses -- e.g., two projects both struggling with monorepo tooling even if they use different frameworks.

**Layer 3 -- Agent-guided deep search (expensive, on-demand).** An agent calls `POST /api/insights/search` with a natural-language question like "How do teams handle Prisma migrations in CI?" The API embeds the question, runs a pgvector search, then optionally passes the top-N results to an LLM for re-ranking and summarization. This layer is only triggered by explicit agent queries, never in the browse UI.

The similarity endpoint returns a unified response:

```json
{
  "results": [
    {
      "slug": "alice-20260401-abc123",
      "title": "...",
      "similarity_score": 0.87,
      "match_reasons": ["shared_framework:next.js", "semantic:friction_analysis"],
      "preview": { "at_a_glance": { "whats_working": "..." } }
    }
  ]
}
```

## 4. The Skill/Plugin System

Skills are markdown files that instruct Claude Code how to behave. Insightful can host and distribute community skills, and can itself be accessed as an MCP tool provider.

**Skill distribution.** A skill is a markdown document with a YAML frontmatter header:

```yaml
---
name: "insightful-review"
version: "1.0.0"
author: "alice"
description: "Fetches similar insights and suggests improvements"
triggers: ["review", "insights"]
requires_api_key: true
---
```

Skills are stored as `Skill` records in the database. Agents fetch them via `GET /api/skills/{name}` and install them locally. The platform provides a curated registry at `/skills`.

**MCP server integration.** Insightful exposes an MCP-compatible tool server. An agent adds it to their MCP config:

```json
{
  "mcpServers": {
    "insightful": {
      "url": "https://insightful.dev/mcp",
      "headers": { "Authorization": "Bearer <api-key>" }
    }
  }
}
```

This exposes tools like `search_insights`, `get_similar_projects`, `upload_insight`, and `get_skill`. The agent calls these tools natively during a coding session.

**Plugin execution.** Custom analysis plugins run server-side as isolated functions. A plugin receives an `InsightReport` and returns annotations. Plugins are authored as TypeScript modules with a fixed interface:

```typescript
interface InsightPlugin {
  name: string;
  analyze(report: InsightReport): Promise<PluginAnnotation[]>;
}
```

Plugins run in a sandboxed worker. The MVP ships with two built-in plugins: "stack-detector" (extracts languages/frameworks from content) and "friction-classifier" (categorizes friction points into a shared taxonomy).

## 5. Storage and Scalability

**Database.** The current codebase uses SQLite via Prisma. For production, migrate to PostgreSQL with the pgvector extension. The Prisma schema already targets PostgreSQL in `.env.example`. Estimated storage: ~50KB per insight report (JSON sections), ~6KB per embedding (1536 float32s). At 100K reports, that is roughly 5GB for content and 600MB for embeddings -- trivially fits on a single Postgres instance.

**Caching.** Redis caches: the home feed (60s TTL), individual report pages (5min TTL), and similarity results (10min TTL keyed by report slug). Cache invalidation on write is straightforward since reports are append-mostly.

**Background jobs.** Embedding generation is async. On `POST /api/insights`, the API returns immediately after storing the report. A job is enqueued (BullMQ on Redis) to generate and store the embedding. The report is queryable by metadata immediately; semantic search catches up within seconds.

**Scaling path.** The Next.js API layer is stateless and horizontally scalable behind a load balancer. PostgreSQL handles read replicas. pgvector scales to millions of vectors with IVFFlat or HNSW indexes. If embedding generation becomes a bottleneck, it moves to a dedicated worker pool.

## 6. API Design (Key Endpoints)

```
Authentication:
  POST /api/auth/[...nextauth]     GitHub OAuth flow (existing)
  POST /api/keys                   Generate API key for agent access

Insights CRUD:
  GET  /api/insights               List (paginated, sortable) -- exists
  POST /api/insights               Create new report -- exists
  GET  /api/insights/:slug         Get single report -- exists
  PUT  /api/insights/:slug         Update report -- exists
  DEL  /api/insights/:slug         Delete report -- exists

Discovery:
  GET  /api/search?q=...           Full-text search -- exists
  GET  /api/insights/:slug/similar Metadata + embedding similarity (NEW)
  POST /api/insights/semantic      Natural-language semantic search (NEW)

Interactions:
  POST /api/insights/:slug/vote      Vote on section -- exists
  POST /api/insights/:slug/comments  Add comment -- exists
  POST /api/insights/:slug/highlight Highlight section -- exists

Skills & Plugins:
  GET  /api/skills                 List available skills (NEW)
  GET  /api/skills/:name           Get skill content (NEW)
  POST /api/skills                 Publish a skill (NEW)

Agent API:
  POST /api/agent/upload           Upload raw insight HTML, returns parsed + redacted (NEW)
  GET  /api/agent/recommend/:slug  Get recommendations for a project (NEW)

MCP:
  POST /mcp                        MCP tool server endpoint (NEW)

Users:
  GET  /api/users/:username        Public profile -- exists
  PUT  /api/users/me               Update own profile -- exists
```

## 7. Claude Code Ecosystem Integration

**As an MCP server.** The `/mcp` endpoint implements the MCP protocol, exposing `search_insights`, `get_similar_projects`, `upload_insight`, and `install_skill` as callable tools. An agent adds one line to their MCP config and gets access to the entire network.

**As a skill provider.** The platform hosts `.md` skill files that Claude Code can install via `GET /api/skills/:name`. A skill like `insightful-review` might instruct the agent: "Before starting work on this repo, call the `search_insights` tool to find reports from similar projects. Summarize relevant friction points and suggestions."

**As a hook target.** Claude Code hooks can trigger on session start or pre-commit. A hook could call `POST /api/agent/upload` to automatically share anonymized insight data, or call `GET /api/agent/recommend/:slug` to fetch recommendations before a coding session begins.

**Dispatch integration.** An always-on Dispatch agent could periodically aggregate trending insights, detect emerging patterns across the community (e.g., "30% of Next.js projects report friction with Server Components"), and publish weekly digests as synthetic insight reports.

## 8. Proposed Tech Stack

| Layer           | Technology                                     |
| --------------- | ---------------------------------------------- |
| Framework       | Next.js 16 (App Router) -- already in place    |
| Language        | TypeScript -- already in place                 |
| Database        | PostgreSQL + pgvector (migrate from SQLite)     |
| ORM             | Prisma 6 -- already in place                   |
| Auth            | NextAuth.js v5 + GitHub OAuth -- already in place |
| Embeddings      | Voyage AI or OpenAI text-embedding-3-small     |
| Job queue       | BullMQ (Redis-backed)                          |
| Cache           | Redis                                          |
| MCP server      | Custom handler on /mcp route                   |
| Styling         | Tailwind CSS 4 -- already in place             |
| Testing         | Vitest -- already in place                     |
| Deployment      | Vercel (app) + Supabase (Postgres + pgvector)  |

## 9. MVP Scope

The minimum build to prove the concept, layered on what already exists:

**Already done:** GitHub OAuth, insight upload/parse/redact, CRUD API for reports, search, voting, comments, highlights, user profiles, browse feed. The web-facing community platform is substantially built.

**MVP additions (ordered by priority):**

1. **API key auth** (~1 day). Add a `UserApiKey` model. Issue keys via `POST /api/keys`. Middleware checks `Authorization: Bearer <key>` on agent-facing endpoints. This unlocks programmatic access.

2. **Metadata extraction** (~1 day). Extend the parser to detect `languages`, `frameworks`, and `tools_used` from insight content. Store them as array columns on `InsightReport`. Add `tags` as user-editable.

3. **Metadata-based similarity** (~1 day). Implement `GET /api/insights/:slug/similar` using Jaccard overlap on the metadata arrays. No embeddings needed. Returns the top 10 similar reports.

4. **Embedding pipeline** (~2 days). Add `InsightEmbedding` model. Background job calls an embedding API on report creation. Implement `POST /api/insights/semantic` for vector search. Requires PostgreSQL + pgvector migration.

5. **MCP server endpoint** (~2 days). Implement `/mcp` with three tools: `search_insights`, `get_similar_projects`, `upload_insight`. This is the key integration point -- once an agent can call these tools, the network effect begins.

6. **Skill registry** (~1 day). Add `Skill` model. CRUD endpoints. Ship two built-in skills: one that fetches recommendations on session start, one that suggests CLAUDE.md improvements based on community patterns.

**Total MVP estimate: ~8 days of focused work.**

What this proves: an agent working on a TypeScript/Next.js project can, via MCP, discover that 15 other developers hit the same Prisma migration friction, see how they solved it, and apply a community-recommended CLAUDE.md addition -- all without the human leaving their terminal.
