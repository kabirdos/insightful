/**
 * Structured single-line JSON logger for the harness direct-POST flow.
 *
 * Decision 13: every bearer-path response — 2xx, 4xx, or 5xx — emits
 * one log record. Fields are intentionally fixed so on-call can grep
 * by `uploadId`, `userId`, or `tokenSelectorPrefix` without spelunking.
 *
 * Safety contract:
 *   - The full bearer token is NEVER logged.
 *   - The selector is exposed only as its first 8 hex chars
 *     (`tokenSelectorPrefix`); callers compute the prefix and pass it
 *     in. The prefix is enough for support to correlate user-reported
 *     issues with server logs but not enough for any reuse capability.
 *   - The request body is never logged.
 */

export type RateLimitReason = "uploads_24h" | "attempts_24h" | "mints_24h";

export interface HarnessLogFields {
  /** UUID from the X-Upload-Id header. May be undefined for header-validation failures. */
  uploadId?: string;
  /** Resolved user id. Undefined when auth failed before lookup. */
  userId?: string;
  /**
   * First 8 hex chars of the bearer-token selector. Derive via
   * `tokenSelector.slice(0, 8)`. Undefined for session-authed paths
   * (which shouldn't reach this logger) or auth-failure paths.
   */
  tokenSelectorPrefix?: string;
  /** Raw Content-Length header value, if present. */
  contentLength?: number;
  /** True when the request was a replay short-circuit. */
  replayed?: boolean;
  /** Set on 429 responses. */
  rateLimitReason?: RateLimitReason;
  /** HTTP status returned to the caller. */
  statusCode: number;
  /** Wall-clock duration of the handler in milliseconds. */
  durationMs: number;
}

export function logHarnessRequest(fields: HarnessLogFields): void {
  // Build the record explicitly so undefined keys are dropped — keeps
  // the JSON tight and avoids leaking shape from optional fields.
  const record: Record<string, unknown> = {
    event: "harness_direct_post",
    statusCode: fields.statusCode,
    durationMs: fields.durationMs,
  };
  if (fields.uploadId !== undefined) record.uploadId = fields.uploadId;
  if (fields.userId !== undefined) record.userId = fields.userId;
  if (fields.tokenSelectorPrefix !== undefined) {
    record.tokenSelectorPrefix = fields.tokenSelectorPrefix;
  }
  if (fields.contentLength !== undefined) {
    record.contentLength = fields.contentLength;
  }
  if (fields.replayed !== undefined) record.replayed = fields.replayed;
  if (fields.rateLimitReason !== undefined) {
    record.rateLimitReason = fields.rateLimitReason;
  }

   
  console.log(JSON.stringify(record));
}
