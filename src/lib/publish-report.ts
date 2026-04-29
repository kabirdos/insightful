/**
 * Server-side report-publish helper used by the bearer-auth direct-POST
 * path of /api/upload (Unit 7 of Wave 3b plan).
 *
 * The browser flow has historically split this work between the client
 * (`src/app/upload/page.tsx:handlePublish` — title fallback, section
 * snake→camel mapping, redaction application) and the server
 * (`POST /api/insights` — DB transaction, project link upsert). For the
 * bearer path the same logic must run server-side. Per Decision 10 in
 * the plan, this helper consolidates the publish-side transformations
 * so future Unit 9 can refactor `handlePublish` to call it too.
 *
 * Pragmatic scope (per task notes): this helper only needs to satisfy
 * the bearer path right now. It does NOT yet handle the inline-project
 * link enrichment that `POST /api/insights` performs — bearer-path
 * drafts are created with `projectIds: []` and the user attaches
 * projects on the edit page. Unit 9 will widen this helper if needed.
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { applyRedactions } from "@/lib/redaction";
import { normalizeHarnessData } from "@/types/insights";
import type {
  InsightsData,
  ParsedInsightsReport,
  RedactionItem,
} from "@/types/insights";

/**
 * Maps the snake_case keys used in InsightsData to the camelCase
 * fields stored on the InsightReport row. Identical to the mapping
 * in `src/app/upload/page.tsx:handlePublish` so the bearer path
 * produces drafts with the same shape as the browser path.
 */
const SECTION_KEY_MAP: Record<keyof InsightsData, string> = {
  at_a_glance: "atAGlance",
  interaction_style: "interactionStyle",
  project_areas: "projectAreas",
  what_works: "impressiveWorkflows",
  friction_analysis: "frictionAnalysis",
  suggestions: "suggestions",
  on_the_horizon: "onTheHorizon",
  fun_ending: "funEnding",
};

/**
 * Slug shape used by both browser and bearer paths. Format:
 * `<YYYYMMDD>-<random>` keeps reports chronologically sortable in
 * URL listings while staying short enough to type.
 */
function generateSlug(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const shortId = Math.random().toString(36).substring(2, 8);
  return `${date}-${shortId}`;
}

/**
 * Build the auto-generated title used when the caller didn't supply
 * one. Mirrors `handlePublish`'s "<First>'s {Insight Harness | Claude
 * Code Insights} - {Mon YYYY}" format. The bearer path doesn't have a
 * session.user.name so we fall back to the username (the first segment
 * of which is the closest analogue to a "first name").
 */
function buildAutoTitle(args: {
  username: string;
  isHarness: boolean;
  dateRangeEnd?: string | null;
}): string {
  const firstName = args.username.split(/[-_]/)[0] || args.username;
  let titleDate: string;
  if (args.dateRangeEnd) {
    const d = new Date(args.dateRangeEnd + "T00:00:00");
    titleDate = d.toLocaleDateString("en-US", {
      month: "short",
      year: "numeric",
    });
  } else {
    titleDate = new Date().toLocaleDateString("en-US", {
      month: "short",
      year: "numeric",
    });
  }
  return args.isHarness
    ? `${firstName}'s Insight Harness - ${titleDate}`
    : `${firstName}'s Claude Code Insights - ${titleDate}`;
}

export interface PublishReportArgs {
  userId: string;
  username: string;
  parsed: ParsedInsightsReport;
  /** Caller-supplied redactions; bearer path defaults to []. */
  redactions: RedactionItem[];
  /** Caller-supplied project ids; bearer path defaults to []. */
  projectIds: string[];
  /** Caller-supplied hidden harness section keys; bearer path defaults to []. */
  hiddenHarnessSections: string[];
  /**
   * Whether the new row should be persisted as a draft. The bearer
   * path always passes true. Browser publish keeps the existing
   * `false` semantics for compatibility (Unit 9 will revisit).
   */
  isDraft: boolean;
  /** Optional caller-supplied title; falls back to buildAutoTitle. */
  title?: string;
}

export interface PublishedReport {
  id: string;
  slug: string;
  authorId: string;
  isDraft: boolean;
}

/**
 * Apply redactions, map section keys, generate a fallback title, then
 * insert the InsightReport row inside a transaction so a partial
 * failure rolls back cleanly.
 *
 * Returns the minimal fields the bearer path needs to redirect the
 * caller to the edit page. Callers that want the full row should
 * issue their own follow-up read with the desired include shape.
 */
export async function publishReport(
  args: PublishReportArgs,
): Promise<PublishedReport> {
  const { userId, username, parsed, redactions, projectIds, isDraft } = args;

  // 1. Redaction. applyRedactions is a pure function on InsightsData —
  // empty list returns a deep clone unchanged.
  const redactedData = applyRedactions(parsed.data, redactions);

  // 2. Section-map snake → camel. The Prisma fields are camelCase;
  // the parser emits snake_case to mirror the JSON-serialized shape
  // the skill produces.
  const sectionFields: Record<string, unknown> = {};
  for (const [dataKey, prismaKey] of Object.entries(SECTION_KEY_MAP)) {
    sectionFields[prismaKey] =
      redactedData[dataKey as keyof InsightsData] ?? null;
  }

  // 3. Title fallback.
  const isHarness = parsed.reportType === "insight-harness";
  const title =
    args.title ||
    buildAutoTitle({
      username,
      isHarness,
      dateRangeEnd: parsed.stats.dateRangeEnd,
    });

  // 4. Slug. Random, collision-prone but practically unique enough at
  // current scale; the unique constraint is on `(authorId, slug)` so
  // a repeat slug under the same author is the only failure mode.
  const slug = generateSlug();

  // 5. Insert. Inside a transaction so any future hookup of project
  // junctions rolls back atomically. For now the bearer path passes
  // an empty projectIds list — the user picks projects on the edit
  // page after the draft renders.
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.insightReport.create({
      data: {
        authorId: userId,
        title,
        slug,
        isDraft,
        sessionCount: parsed.stats.sessionCount ?? null,
        messageCount: parsed.stats.messageCount ?? null,
        commitCount: parsed.stats.commitCount ?? null,
        dateRangeStart: parsed.stats.dateRangeStart ?? null,
        dateRangeEnd: parsed.stats.dateRangeEnd ?? null,
        linesAdded: parsed.stats.linesAdded ?? null,
        linesRemoved: parsed.stats.linesRemoved ?? null,
        fileCount: parsed.stats.fileCount ?? null,
        dayCount: parsed.stats.dayCount ?? null,
        msgsPerDay: parsed.stats.msgsPerDay ?? null,
        atAGlance:
          (sectionFields.atAGlance as Prisma.InputJsonValue) ?? undefined,
        interactionStyle:
          (sectionFields.interactionStyle as Prisma.InputJsonValue) ??
          undefined,
        projectAreas:
          (sectionFields.projectAreas as Prisma.InputJsonValue) ?? undefined,
        impressiveWorkflows:
          (sectionFields.impressiveWorkflows as Prisma.InputJsonValue) ??
          undefined,
        frictionAnalysis:
          (sectionFields.frictionAnalysis as Prisma.InputJsonValue) ??
          undefined,
        suggestions:
          (sectionFields.suggestions as Prisma.InputJsonValue) ?? undefined,
        onTheHorizon:
          (sectionFields.onTheHorizon as Prisma.InputJsonValue) ?? undefined,
        funEnding:
          (sectionFields.funEnding as Prisma.InputJsonValue) ?? undefined,
        chartData:
          (parsed.chartData as Prisma.InputJsonValue | undefined) ?? undefined,
        detectedSkills: parsed.detectedSkills ?? [],
        reportType: parsed.reportType ?? "insights",
        // Harness scalar denorm — null when this isn't a harness report.
        totalTokens:
          typeof parsed.harnessData?.stats.totalTokens === "number"
            ? BigInt(parsed.harnessData.stats.totalTokens)
            : null,
        durationHours:
          typeof parsed.harnessData?.stats.durationHours === "number"
            ? Math.round(parsed.harnessData.stats.durationHours)
            : null,
        avgSessionMinutes: parsed.harnessData?.stats.avgSessionMinutes ?? null,
        prCount: parsed.harnessData?.stats.prCount ?? null,
        autonomyLabel: parsed.harnessData?.autonomy.label ?? null,
        harnessData:
          (normalizeHarnessData(
            parsed.harnessData,
          ) as unknown as Prisma.InputJsonValue) ?? undefined,
        hiddenHarnessSections: args.hiddenHarnessSections,
      },
      select: {
        id: true,
        slug: true,
        authorId: true,
        isDraft: true,
      },
    });

    // Reserved for future projectIds support. Bearer path passes [];
    // browser path (in Unit 9) will pass real ids and the junction
    // rows will be created here under the same transaction.
    if (projectIds.length > 0) {
      const owned = await tx.project.findMany({
        where: { id: { in: projectIds }, userId },
        select: { id: true },
      });
      const ownedSet = new Set(owned.map((p) => p.id));
      const validIds = projectIds.filter((id) => ownedSet.has(id));
      if (validIds.length > 0) {
        await tx.reportProject.createMany({
          data: validIds.map((pid, i) => ({
            reportId: row.id,
            projectId: pid,
            position: i,
          })),
          skipDuplicates: true,
        });
      }
    }

    return row;
  });

  return created;
}
