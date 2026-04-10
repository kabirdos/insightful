/**
 * Server-side Open Graph metadata fetcher with SSRF protection.
 *
 * ════════════════════════════════════════════════════════════════════
 * THREAT MODEL
 * ════════════════════════════════════════════════════════════════════
 *
 * This module is the first server-side outbound-fetch surface in the
 * Insightful codebase. It fetches arbitrary user-supplied URLs to
 * extract Open Graph metadata (title, description, image, favicon,
 * site name) for the project-link preview feature.
 *
 * **What this module defends against:**
 * - SSRF to loopback, private, link-local, or cloud-metadata ranges
 *   (127.0.0.0/8, 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16,
 *   169.254.0.0/16 incl. 169.254.169.254, fe80::/10, ::1, 0.0.0.0)
 * - SSRF via a redirect from a public URL to an internal URL
 *   (each hop is re-validated via isSafeUrl before the next fetch)
 * - DoS via huge response bodies (response is aborted once >2MB read)
 * - DoS via slow-loris or hung fetches (4-second total timeout)
 * - Content-type confusion (reject non-html responses)
 * - Non-http(s) schemes (file://, javascript:, data:, ftp:, etc.)
 * - Infinite redirect loops (capped at 3 hops)
 *
 * **Residual risks documented, NOT fully mitigated:**
 * - DNS rebinding: between our isSafeUrl check and the actual fetch,
 *   an attacker could flip the DNS record. The time window is small
 *   and the blocklist check runs on every hop, but full mitigation
 *   requires a custom resolver that pins the IP. Accepted for v1.
 * - Non-routable-but-public IPs some clouds use for internal routing
 *   (e.g., certain GCP projects): not in the standard RFC1918 list
 *   but still internal. Not blocked. Low likelihood for OG-image
 *   sources.
 *
 * **Not this module's job:**
 * - XSS defense on the returned fields — the caller must render them
 *   via React text nodes, never dangerouslySetInnerHTML
 * - Rate limiting on how often this function runs per user — belongs
 *   at the route handler layer
 */

import { lookup as dnsLookup } from "node:dns/promises";
import { unfurl } from "unfurl.js";

// ── Types ───────────────────────────────────────────────────────────

export interface LinkPreview {
  ogImage: string | null;
  ogTitle: string | null;
  ogDescription: string | null;
  favicon: string | null;
  siteName: string | null;
}

// ── Constants ───────────────────────────────────────────────────────

const FETCH_TIMEOUT_MS = 4000;
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024; // 2MB
const MAX_REDIRECTS = 3;

const USER_AGENT = "InsightfulBot/1.0 (+https://insightharness.com)";

// ── IP blocklist ────────────────────────────────────────────────────

/**
 * Returns true if the given IP (v4 or v6 text form) is in any of the
 * blocked CIDR ranges. Exported for direct unit testing.
 */
export function isIpInBlocklist(ip: string): boolean {
  // Normalize IPv6 lowercase and strip any surrounding brackets that
  // Node's URL parser leaves on IPv6 hostnames.
  const normalized = ip
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, "");

  // IPv6 loopback
  if (normalized === "::1") return true;
  // IPv6 link-local (fe80::/10)
  if (/^fe[89ab][0-9a-f]?:/i.test(normalized)) return true;
  if (normalized.startsWith("fe80:")) return true;
  // IPv6 unique-local (fc00::/7)
  if (/^f[cd][0-9a-f]{2}:/i.test(normalized)) return true;
  // IPv4-mapped IPv6 — block ALL variants unconditionally. Node's URL
  // parser canonicalizes [::ffff:127.0.0.1] to [::ffff:7f00:1] (hex
  // form), which means a regex that only handles the decimal form is
  // an SSRF bypass. Rather than parse every possible IPv4-in-IPv6
  // encoding, we reject the entire ::ffff: prefix outright —
  // legitimate OG targets never use this format.
  if (normalized.startsWith("::ffff:")) return true;

  // IPv4
  const parts = normalized.split(".");
  if (parts.length !== 4) return false;
  const octets = parts.map((p) => Number(p));
  if (octets.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return false;
  const [a, b] = octets;

  // 0.0.0.0/8
  if (a === 0) return true;
  // 10.0.0.0/8
  if (a === 10) return true;
  // 127.0.0.0/8 (loopback)
  if (a === 127) return true;
  // 169.254.0.0/16 (link-local, incl. cloud metadata)
  if (a === 169 && b === 254) return true;
  // 172.16.0.0/12
  if (a === 172 && b >= 16 && b <= 31) return true;
  // 192.168.0.0/16
  if (a === 192 && b === 168) return true;

  return false;
}

// ── URL safety check ────────────────────────────────────────────────

/**
 * Parse a URL and verify that (a) the scheme is http or https and
 * (b) every IP the hostname resolves to is outside the blocklist.
 * Returns false on any error — never throws.
 */
export async function isSafeUrl(url: string): Promise<boolean> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return false;
  }

  const hostname = parsed.hostname;
  if (!hostname) return false;

  // If the hostname is itself a literal IP, check directly without DNS.
  if (/^[\d.]+$/.test(hostname) || hostname.includes(":")) {
    return !isIpInBlocklist(hostname.replace(/^\[|\]$/g, ""));
  }

  try {
    const results = await deps.lookup(hostname, { all: true });
    const addresses: Array<{ address: string; family: number }> = Array.isArray(
      results,
    )
      ? results
      : [results];
    if (addresses.length === 0) return false;
    for (const r of addresses) {
      if (isIpInBlocklist(r.address)) return false;
    }
    return true;
  } catch {
    return false;
  }
}

// ── Dependency injection for tests ──────────────────────────────────

// A small indirection so tests can mock `lookup` and `fetch` without
// having to mock the exact module specifiers at every import site.
// Production code always uses the real node:dns and global fetch.
interface Deps {
  lookup: typeof dnsLookup;
  fetch: typeof fetch;
}

const defaultDeps: Deps = {
  lookup: dnsLookup,
  fetch: (...args) => globalThis.fetch(...args),
};

let deps: Deps = { ...defaultDeps };

/** Test-only: restores the default deps. Not for production use. */
export function __resetDepsForTests(): void {
  deps = {
    lookup: dnsLookup,
    // Resolve the global fetch on each call so vi.stubGlobal works.
    fetch: (...args) => globalThis.fetch(...args),
  };
}

// ── Safe fetch with manual redirect handling ────────────────────────

/**
 * Fetch a URL with:
 *  - SSRF re-validation at every redirect hop
 *  - Manual redirect following capped at MAX_REDIRECTS hops
 *  - AbortController with FETCH_TIMEOUT_MS total timeout
 *  - Rejection of content-types that are not html
 *
 * Throws on any failure. Callers should wrap in try/catch.
 */
async function safeFetch(initialUrl: string): Promise<{
  bytes: Uint8Array;
  contentType: string;
}> {
  let url = initialUrl;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      if (!(await isSafeUrl(url))) {
        throw new Error(`SSRF: blocked URL at hop ${hop}: ${url}`);
      }

      const response = await deps.fetch(url, {
        signal: controller.signal,
        redirect: "manual",
        headers: {
          Accept: "text/html, application/xhtml+xml",
          "User-Agent": USER_AGENT,
        },
      });

      // Manual redirect handling
      const status = response.status;
      if (status >= 300 && status < 400) {
        const location = response.headers.get("location");
        if (!location) {
          throw new Error(`redirect without Location header at ${url}`);
        }
        // Resolve relative redirects against the current URL.
        url = new URL(location, url).toString();
        continue;
      }

      if (status < 200 || status >= 300) {
        throw new Error(`non-2xx status ${status} from ${url}`);
      }

      const contentType = response.headers.get("content-type") ?? "";
      if (!/text\/html|application\/xhtml\+xml/i.test(contentType)) {
        throw new Error(`non-html content-type: ${contentType}`);
      }

      // Read body as raw bytes with a size cap. We return bytes (not
      // decoded text) so unfurl.js can do its own charset sniffing on
      // the raw buffer — otherwise we'd corrupt non-UTF-8 pages.
      const bytes = await readBodyBytesWithCap(response, MAX_RESPONSE_BYTES);
      return { bytes, contentType };
    }
    throw new Error(`exceeded MAX_REDIRECTS (${MAX_REDIRECTS})`);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Read the response body as a Uint8Array, aborting if more than `cap`
 * bytes have been streamed. If the Response has no streaming body
 * reader, fall back to reading the full arrayBuffer and checking size.
 */
async function readBodyBytesWithCap(
  response: Response,
  cap: number,
): Promise<Uint8Array> {
  const reader = response.body?.getReader?.();
  if (!reader) {
    // No streaming reader — read the full buffer and check length.
    const buf = await response.arrayBuffer();
    if (buf.byteLength > cap) {
      throw new Error(`response exceeds ${cap} bytes`);
    }
    return new Uint8Array(buf);
  }

  let received = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      received += value.byteLength;
      if (received > cap) {
        try {
          await reader.cancel();
        } catch {
          // ignore
        }
        throw new Error(`response exceeds ${cap} bytes`);
      }
      chunks.push(value);
    }
  }
  // Concatenate chunks into a single buffer.
  const combined = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return combined;
}

// ── Main entry point ────────────────────────────────────────────────

/**
 * Fetch Open Graph metadata for a URL. Returns null on ANY failure
 * (SSRF rejection, timeout, 4xx, 5xx, content-type mismatch, body too
 * large, parse failure, redirect loop). Never throws.
 *
 * The caller should treat a null return as "no metadata available"
 * and save the Project row with all metadata fields set to null —
 * this is the intended graceful-degradation path.
 */
export async function fetchLinkPreview(
  url: string,
): Promise<LinkPreview | null> {
  try {
    const { bytes, contentType } = await safeFetch(url);

    // unfurl.js expects to do its own fetch, but its `opts.fetch`
    // option lets us plug in a fake fetch that just returns the bytes
    // we already safely fetched. We pass the ORIGINAL Content-Type
    // header through so unfurl's charset sniffing works for non-UTF-8
    // pages (Shift_JIS, GBK, Big5, etc.). We disable oembed to avoid
    // a second fetch we would also need to guard.
    const metadata = await unfurl(url, {
      oembed: false,
      fetch: () =>
        Promise.resolve({
          headers: {
            get: (name: string) =>
              name.toLowerCase() === "content-type" ? contentType : null,
          },
          status: 200,
          arrayBuffer: async () =>
            bytes.buffer.slice(
              bytes.byteOffset,
              bytes.byteOffset + bytes.byteLength,
            ) as ArrayBuffer,
        }) as unknown as ReturnType<typeof fetch>,
    });

    // Sanitize the extracted image URLs through isSafeUrl BEFORE
    // returning them. The HTML we fetched passed SSRF checks, but
    // the URLs it publishes (og:image, favicon) are untrusted — a
    // malicious page could embed an og:image pointing at an internal
    // IP or cloud metadata endpoint, and if we stored that URL and
    // the client later rendered it as <img src>, every viewer's
    // browser would fetch it. Null out any URL that fails the check.
    const rawOgImage = metadata.open_graph?.images?.[0]?.url ?? null;
    const rawFavicon = metadata.favicon ?? null;
    const [ogImageSafe, faviconSafe] = await Promise.all([
      rawOgImage ? isSafeUrl(rawOgImage) : Promise.resolve(false),
      rawFavicon ? isSafeUrl(rawFavicon) : Promise.resolve(false),
    ]);

    return {
      ogImage: ogImageSafe ? rawOgImage : null,
      ogTitle: metadata.open_graph?.title ?? metadata.title ?? null,
      ogDescription:
        metadata.open_graph?.description ?? metadata.description ?? null,
      favicon: faviconSafe ? rawFavicon : null,
      siteName: metadata.open_graph?.site_name ?? null,
    };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.warn("[link-preview] fetchLinkPreview failed:", { url, reason });
    return null;
  }
}
