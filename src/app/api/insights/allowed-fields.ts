/**
 * Fields allowed in PUT requests to /api/insights/[slug].
 * Extracted into a separate module for testability (avoids pulling in
 * Next.js server/auth dependencies).
 *
 * IMPORTANT: harnessData is intentionally excluded — it contains contentHtml
 * rendered with dangerouslySetInnerHTML, so it must not be editable via API.
 */
export const ALLOWED_PUT_FIELDS = [
  "title",
  "atAGlance",
  "interactionStyle",
  "projectAreas",
  "impressiveWorkflows",
  "frictionAnalysis",
  "suggestions",
  "onTheHorizon",
  "funEnding",
  // v3: Harness fields
  "totalTokens",
  "durationHours",
  "avgSessionMinutes",
  "prCount",
  "autonomyLabel",
  // Note: harnessData intentionally excluded — contains contentHtml
  // rendered with dangerouslySetInnerHTML, so it must not be editable via API
  // Stats fields for visibility editing
  "sessionCount",
  "messageCount",
  "commitCount",
  "linesAdded",
  "linesRemoved",
  "fileCount",
  "chartData",
  "detectedSkills",
  "hiddenHarnessSections",
] as const;
