/**
 * Deprecated: use `reportVisibilityClause` from `@/lib/report-visibility`.
 *
 * `draftVisibilityClause` is retained as an alias so any stragglers that
 * still import it keep compiling and behave identically to the new
 * visibility helper. It now applies the full group-aware visibility
 * filter (drafts hidden from non-authors, group reports restricted to
 * members, non-public reports hidden from anonymous viewers), not just
 * the draft check it originally performed.
 *
 * @deprecated Import `reportVisibilityClause` directly.
 */
export { reportVisibilityClause as draftVisibilityClause } from "./report-visibility";
