// Runs on every read and write path for User.setup. Defense in depth against
// malformed JSON from manual DB edits or stale shapes, and single point of
// truth for server-owned metadata (version, setupUpdatedAt).
//
// Contract (see docs/plans/2026-04-13-profile-setup-fields.md §5):
//   - Reject non-object input → null.
//   - Strip unknown keys.
//   - Trim strings; empty → undefined. Truncate to FREE_TEXT_MAX.
//   - dotfilesUrl must pass isValidUrl; dropped on fail.
//   - mcpServers: cap array length, cap each string, drop empties.
//   - Empty user-fields payload → null (caller should store DbNull).
//   - Otherwise: version is overwritten; setupUpdatedAt is refreshed only if
//     the normalized user-fields payload differs from prevStored's.

import {
  PROFILE_SETUP_LIMITS,
  PROFILE_SETUP_USER_KEYS,
  PROFILE_SETUP_VERSION,
  type ProfileSetup,
  type ProfileSetupUserFields,
  type ProfileSetupUserKey,
} from "@/types/profile";

const STRING_FIELDS: readonly ProfileSetupUserKey[] = [
  "os",
  "machine",
  "keyboard",
  "editor",
  "terminal",
  "shell",
  "primaryAgent",
  "primaryModel",
  "packageManager",
  "dotfilesUrl",
] as const;

function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function normalizeString(
  raw: unknown,
  max: number = PROFILE_SETUP_LIMITS.FREE_TEXT_MAX,
): string | undefined {
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
}

function normalizeMcpServers(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const cleaned: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim();
    if (!trimmed) continue;
    cleaned.push(
      trimmed.length > PROFILE_SETUP_LIMITS.MCP_ITEM_MAX
        ? trimmed.slice(0, PROFILE_SETUP_LIMITS.MCP_ITEM_MAX)
        : trimmed,
    );
    if (cleaned.length >= PROFILE_SETUP_LIMITS.MCP_ARRAY_MAX) break;
  }
  return cleaned.length > 0 ? cleaned : undefined;
}

function extractUserFields(raw: unknown): ProfileSetupUserFields {
  if (!raw || typeof raw !== "object") return {};
  const obj = raw as Record<string, unknown>;
  // Build into a plain record then cast once — every STRING_FIELDS key maps
  // to `string | undefined` in ProfileSetupUserFields, so the cast is safe.
  const stringOut: Partial<Record<(typeof STRING_FIELDS)[number], string>> = {};

  for (const key of STRING_FIELDS) {
    const value = normalizeString(obj[key]);
    if (value !== undefined) {
      if (key === "dotfilesUrl" && !isValidUrl(value)) continue;
      stringOut[key] = value;
    }
  }

  // `stringOut` only carries the string-valued keys. Cast through `unknown`
  // and let the explicit `mcpServers` branch below populate the array field.
  const out = { ...stringOut } as ProfileSetupUserFields;
  const mcp = normalizeMcpServers(obj.mcpServers);
  if (mcp) out.mcpServers = mcp;

  return out;
}

function userFieldsEqual(
  a: ProfileSetupUserFields,
  b: ProfileSetupUserFields,
): boolean {
  for (const key of PROFILE_SETUP_USER_KEYS) {
    const av = a[key];
    const bv = b[key];
    if (key === "mcpServers") {
      const al = Array.isArray(av) ? av : [];
      const bl = Array.isArray(bv) ? bv : [];
      if (al.length !== bl.length) return false;
      for (let i = 0; i < al.length; i++) {
        if (al[i] !== bl[i]) return false;
      }
    } else if (av !== bv) {
      return false;
    }
  }
  return true;
}

function isUserFieldsEmpty(fields: ProfileSetupUserFields): boolean {
  for (const key of PROFILE_SETUP_USER_KEYS) {
    const v = fields[key];
    if (v === undefined) continue;
    if (Array.isArray(v) && v.length === 0) continue;
    if (typeof v === "string" && !v) continue;
    return false;
  }
  return true;
}

function toPrevUserFields(prev: unknown): ProfileSetupUserFields | null {
  if (!prev || typeof prev !== "object") return null;
  // prevStored comes from the DB and may itself be malformed; re-extract
  // through the same normalizer so comparison is apples-to-apples.
  return extractUserFields(prev);
}

/**
 * Normalize a raw setup blob for safe storage and safe response.
 *
 * @param raw        Possibly-untrusted input (client body or stored blob).
 * @param prevStored Currently persisted blob. When provided and the
 *                   normalized user-fields payload matches the previous
 *                   payload, the persisted `setupUpdatedAt` is preserved so
 *                   round-trips through reads don't churn the timestamp.
 */
export function normalizeSetup(
  raw: unknown,
  prevStored?: unknown,
): ProfileSetup | null {
  const fields = extractUserFields(raw);
  if (isUserFieldsEmpty(fields)) return null;

  const prevFields = toPrevUserFields(prevStored);
  const prevTimestamp =
    prevStored && typeof prevStored === "object"
      ? (prevStored as Record<string, unknown>).setupUpdatedAt
      : undefined;

  const setupUpdatedAt =
    prevFields &&
    typeof prevTimestamp === "string" &&
    userFieldsEqual(fields, prevFields)
      ? prevTimestamp
      : new Date().toISOString();

  return {
    version: PROFILE_SETUP_VERSION,
    setupUpdatedAt,
    ...fields,
  };
}
