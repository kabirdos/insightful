/**
 * Safe-image validation for skill showcase heroes and inline markdown images.
 *
 * Used in two places (one validator, two consumers — keeps the attack surface
 * unified):
 *   1. SkillsShowcaseSection renders a hero <img> from a SkillInventoryEntry
 *      via getSafeHeroDataUri(entry).
 *   2. SkillReadme passes inline markdown image URLs through isSafeImageDataUri
 *      so a sanitizer schema loosening doesn't accidentally allow tracking
 *      pixels, javascript: URLs, or SVG data URIs (PII inside SVG text /
 *      CDATA isn't reliably scrubbed at extract time).
 *
 * If the validator changes, both consumers' tests must continue to pass.
 */

import type { HarnessSkillEntry } from "@/types/insights";

// 300KB raw hero × ~1.37 base64 bloat = ~410KB encoded; round up for a small
// safety margin. Rejecting larger payloads here is a defense in depth on top
// of the extractor's own 300KB cap.
const MAX_DATA_URI_BYTES = 570 * 1024;

const DATA_URI_RE = /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/;

/**
 * Returns true iff `uri` is a `data:image/{png,jpeg};base64,...` URI with
 * a well-formed base64 body and total length under the cap.
 *
 * Rejects: SVG, GIF, WebP, http(s) URLs, javascript:/vbscript:/data:text/...,
 * mixed-case mime types, malformed base64, empty bodies, oversized payloads.
 */
export function isSafeImageDataUri(uri: unknown): boolean {
  if (typeof uri !== "string") return false;
  if (uri.length === 0 || uri.length > MAX_DATA_URI_BYTES) return false;
  return DATA_URI_RE.test(uri);
}

/**
 * Compose a `data:` URI from a SkillInventoryEntry's hero fields, returning
 * the URI only if it passes isSafeImageDataUri. Returns null on any failure
 * (missing fields, wrong mime type, malformed base64, oversized payload).
 *
 * Render layers must call this — never construct hero src attributes inline,
 * since that bypasses the allowlist and would render whatever the extract
 * pipeline emits (including a future bug that lets through an unsafe mime).
 */
export function getSafeHeroDataUri(entry: HarnessSkillEntry): string | null {
  const mime = entry.hero_mime_type;
  const b64 = entry.hero_base64;
  if (!mime || !b64) return null;
  if (mime !== "image/png" && mime !== "image/jpeg") return null;
  const candidate = `data:${mime};base64,${b64}`;
  return isSafeImageDataUri(candidate) ? candidate : null;
}
