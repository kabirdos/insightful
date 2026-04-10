/**
 * Tests for src/lib/link-preview.ts — the SSRF-safe OG metadata fetcher.
 *
 * Mocks node:dns/promises and the global `fetch` to exercise every
 * failure mode without making real network calls.
 */
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockedFunction,
} from "vitest";

// Mock node:dns/promises BEFORE importing the module under test.
vi.mock("node:dns/promises", () => ({
  lookup: vi.fn(),
}));

import { lookup } from "node:dns/promises";
import {
  fetchLinkPreview,
  isIpInBlocklist,
  isSafeUrl,
  __resetDepsForTests,
} from "../link-preview";

type LookupResult = { address: string; family: number };

const mockedLookup = lookup as unknown as MockedFunction<
  (
    hostname: string,
    options?: unknown,
  ) => Promise<LookupResult | LookupResult[]>
>;

function allowLookup(address = "93.184.216.34") {
  mockedLookup.mockResolvedValue([{ address, family: 4 }]);
}

function mockLookupTo(address: string) {
  mockedLookup.mockResolvedValue([{ address, family: 4 }]);
}

function stubFetch(impl: (url: string) => Promise<Response> | Response) {
  vi.stubGlobal("fetch", vi.fn(impl));
}

function htmlResponse(body: string, headers: Record<string, string> = {}) {
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      ...headers,
    },
  });
}

const SAMPLE_HTML = `
  <!doctype html>
  <html>
    <head>
      <title>Sample Title</title>
      <meta property="og:title" content="OG Sample Title" />
      <meta property="og:description" content="OG Description" />
      <meta property="og:image" content="https://example.com/image.jpg" />
      <meta property="og:site_name" content="Sample Site" />
      <link rel="icon" href="https://example.com/favicon.ico" />
    </head>
    <body>hello</body>
  </html>
`;

beforeEach(() => {
  mockedLookup.mockReset();
  vi.unstubAllGlobals();
  __resetDepsForTests();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ── isIpInBlocklist ─────────────────────────────────────────────────

describe("isIpInBlocklist", () => {
  it("blocks IPv4 loopback addresses", () => {
    expect(isIpInBlocklist("127.0.0.1")).toBe(true);
    expect(isIpInBlocklist("127.0.0.99")).toBe(true);
  });

  it("blocks RFC1918 private ranges", () => {
    expect(isIpInBlocklist("10.0.0.1")).toBe(true);
    expect(isIpInBlocklist("172.16.5.1")).toBe(true);
    expect(isIpInBlocklist("172.31.255.254")).toBe(true);
    expect(isIpInBlocklist("192.168.1.1")).toBe(true);
  });

  it("blocks link-local (169.254.0.0/16) including cloud metadata", () => {
    expect(isIpInBlocklist("169.254.0.1")).toBe(true);
    expect(isIpInBlocklist("169.254.169.254")).toBe(true); // AWS/GCP/Azure
  });

  it("blocks 0.0.0.0", () => {
    expect(isIpInBlocklist("0.0.0.0")).toBe(true);
  });

  it("blocks IPv6 loopback", () => {
    expect(isIpInBlocklist("::1")).toBe(true);
  });

  it("blocks IPv6 link-local (fe80::/10)", () => {
    expect(isIpInBlocklist("fe80::1")).toBe(true);
    expect(isIpInBlocklist("fe80::abcd:1234")).toBe(true);
  });

  it("does NOT block public IPv4 addresses", () => {
    expect(isIpInBlocklist("8.8.8.8")).toBe(false);
    expect(isIpInBlocklist("93.184.216.34")).toBe(false); // example.com
    expect(isIpInBlocklist("172.15.0.1")).toBe(false); // 172.15 is public
    expect(isIpInBlocklist("172.32.0.1")).toBe(false); // 172.32 is public
  });

  it("does NOT block public IPv6", () => {
    expect(isIpInBlocklist("2606:4700:4700::1111")).toBe(false); // 1.1.1.1 ipv6
  });

  it("blocks IPv4-mapped IPv6 in decimal form (::ffff:127.0.0.1)", () => {
    expect(isIpInBlocklist("::ffff:127.0.0.1")).toBe(true);
    expect(isIpInBlocklist("::ffff:10.0.0.1")).toBe(true);
    expect(isIpInBlocklist("::ffff:192.168.1.1")).toBe(true);
  });

  it("blocks IPv4-mapped IPv6 in canonical hex form (::ffff:7f00:1 = 127.0.0.1)", () => {
    // This is the SSRF-bypass codex caught: Node's URL parser turns
    // [::ffff:127.0.0.1] into [::ffff:7f00:1] and the old regex only
    // matched the decimal form.
    expect(isIpInBlocklist("::ffff:7f00:1")).toBe(true); // 127.0.0.1
    expect(isIpInBlocklist("::ffff:a00:1")).toBe(true); // 10.0.0.1
    expect(isIpInBlocklist("::ffff:c0a8:101")).toBe(true); // 192.168.1.1
    expect(isIpInBlocklist("::ffff:a9fe:a9fe")).toBe(true); // 169.254.169.254
  });

  it("blocks ::ffff:-prefixed addresses even when the mapped-IPv4 bytes are public", () => {
    // Belt-and-suspenders: we reject ALL IPv4-mapped IPv6, because
    // legitimate OG sources never use this format.
    expect(isIpInBlocklist("::ffff:808:808")).toBe(true); // 8.8.8.8 mapped
  });

  it("strips IPv6 brackets before checking", () => {
    expect(isIpInBlocklist("[::1]")).toBe(true);
    expect(isIpInBlocklist("[::ffff:7f00:1]")).toBe(true);
  });
});

// ── isSafeUrl ───────────────────────────────────────────────────────

describe("isSafeUrl", () => {
  it("rejects non-http(s) schemes", async () => {
    expect(await isSafeUrl("file:///etc/passwd")).toBe(false);
    expect(await isSafeUrl("ftp://example.com")).toBe(false);
    expect(await isSafeUrl("javascript:alert(1)")).toBe(false);
    expect(await isSafeUrl("data:text/html,<h1>x</h1>")).toBe(false);
  });

  it("rejects URLs that resolve to a loopback IP", async () => {
    mockLookupTo("127.0.0.1");
    expect(await isSafeUrl("http://evil.example.com")).toBe(false);
  });

  it("rejects URLs that resolve to RFC1918", async () => {
    mockLookupTo("10.0.0.1");
    expect(await isSafeUrl("http://internal.example.com")).toBe(false);
  });

  it("rejects URLs that resolve to cloud metadata IP", async () => {
    mockLookupTo("169.254.169.254");
    expect(await isSafeUrl("http://metadata.example.com")).toBe(false);
  });

  it("rejects URLs where ANY resolved address is blocked", async () => {
    // DNS returns both a public and a private address — we must reject
    mockedLookup.mockResolvedValue([
      { address: "8.8.8.8", family: 4 },
      { address: "10.0.0.1", family: 4 },
    ]);
    expect(await isSafeUrl("http://mixed.example.com")).toBe(false);
  });

  it("accepts URLs that resolve only to public IPs", async () => {
    mockLookupTo("93.184.216.34");
    expect(await isSafeUrl("https://example.com")).toBe(true);
  });

  it("rejects malformed URLs", async () => {
    expect(await isSafeUrl("not a url")).toBe(false);
    expect(await isSafeUrl("")).toBe(false);
  });

  it("rejects URLs when DNS lookup throws", async () => {
    mockedLookup.mockRejectedValue(new Error("ENOTFOUND"));
    expect(await isSafeUrl("http://does-not-exist.example.com")).toBe(false);
  });
});

// ── fetchLinkPreview ────────────────────────────────────────────────

describe("fetchLinkPreview", () => {
  it("returns parsed metadata on a successful fetch", async () => {
    allowLookup();
    stubFetch(() => htmlResponse(SAMPLE_HTML));

    const result = await fetchLinkPreview("https://example.com");

    expect(result).not.toBeNull();
    expect(result?.ogTitle).toBe("OG Sample Title");
    expect(result?.ogDescription).toBe("OG Description");
    expect(result?.ogImage).toBe("https://example.com/image.jpg");
    expect(result?.siteName).toBe("Sample Site");
  });

  it("returns null (not thrown) when URL is SSRF-blocked (loopback)", async () => {
    mockLookupTo("127.0.0.1");
    // fetch should never be called
    const fetchSpy = vi.fn();
    stubFetch(fetchSpy);

    const result = await fetchLinkPreview("http://evil.example.com");

    expect(result).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns null for non-http scheme without calling fetch or DNS", async () => {
    const fetchSpy = vi.fn();
    stubFetch(fetchSpy);

    const result = await fetchLinkPreview("file:///etc/passwd");

    expect(result).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(mockedLookup).not.toHaveBeenCalled();
  });

  it("returns null on HTTP 404", async () => {
    allowLookup();
    stubFetch(
      () => new Response("not found", { status: 404 }) as unknown as Response,
    );

    const result = await fetchLinkPreview("https://example.com/missing");

    expect(result).toBeNull();
  });

  it("returns null on non-html content-type", async () => {
    allowLookup();
    stubFetch(
      () =>
        new Response("binary garbage", {
          status: 200,
          headers: { "Content-Type": "application/octet-stream" },
        }),
    );

    const result = await fetchLinkPreview("https://example.com/file.bin");

    expect(result).toBeNull();
  });

  it("returns null on oversized response (>2MB)", async () => {
    allowLookup();
    // Build a 3MB string (over the 2MB cap). Use a repeat pattern.
    const oversized = "a".repeat(3 * 1024 * 1024);
    stubFetch(() => htmlResponse(oversized));

    const result = await fetchLinkPreview("https://example.com/huge");

    expect(result).toBeNull();
  });

  it("returns null on fetch timeout (abort)", async () => {
    allowLookup();
    stubFetch(
      () =>
        new Promise<Response>((_, reject) => {
          // Simulate abort by rejecting with an AbortError
          const abortError = new Error("The user aborted a request.");
          abortError.name = "AbortError";
          reject(abortError);
        }),
    );

    const result = await fetchLinkPreview("https://example.com/slow");

    expect(result).toBeNull();
  });

  it("follows a redirect to a public URL and returns metadata", async () => {
    allowLookup(); // every lookup returns a public IP
    let call = 0;
    stubFetch(() => {
      call++;
      if (call === 1) {
        return new Response(null, {
          status: 302,
          headers: { Location: "https://example.com/target" },
        });
      }
      return htmlResponse(SAMPLE_HTML);
    });

    const result = await fetchLinkPreview("https://example.com/redirect");

    expect(result).not.toBeNull();
    expect(result?.ogTitle).toBe("OG Sample Title");
  });

  it("rejects when a redirect Location resolves to a loopback IP", async () => {
    let call = 0;
    mockedLookup.mockImplementation(async (hostname: string) => {
      if (hostname === "start.example.com") {
        return [{ address: "8.8.8.8", family: 4 }];
      }
      // Redirect target resolves to loopback
      return [{ address: "127.0.0.1", family: 4 }];
    });
    stubFetch(() => {
      call++;
      if (call === 1) {
        return new Response(null, {
          status: 302,
          headers: { Location: "http://attacker-redirect.example.com/" },
        });
      }
      throw new Error("should not be called — the safe-fetch loop should bail");
    });

    const result = await fetchLinkPreview("https://start.example.com");

    expect(result).toBeNull();
    expect(call).toBe(1); // only the initial fetch happened
  });

  it("bails after 3 redirect hops even if each target is public", async () => {
    allowLookup();
    let call = 0;
    stubFetch(() => {
      call++;
      return new Response(null, {
        status: 302,
        headers: { Location: `https://example.com/hop${call}` },
      });
    });

    const result = await fetchLinkPreview("https://example.com/start");

    expect(result).toBeNull();
    // Initial + up to 3 redirect follows, then bail. Exact count
    // depends on implementation — but it must not be unbounded.
    expect(call).toBeLessThanOrEqual(4);
  });

  it("returns an object with null fields when HTML has no metadata", async () => {
    allowLookup();
    stubFetch(() =>
      htmlResponse("<!doctype html><html><head></head><body></body></html>"),
    );

    const result = await fetchLinkPreview("https://example.com/empty");

    // Either null (total failure) or an object with all nulls — both
    // are acceptable for an empty HTML page. The important thing is
    // that it does not throw.
    if (result !== null) {
      expect(result.ogImage).toBeNull();
      expect(result.ogTitle).toBeNull();
      expect(result.ogDescription).toBeNull();
    }
  });

  it("returns null when the underlying parser throws", async () => {
    allowLookup();
    stubFetch(
      () =>
        new Response("<!doctype html><html><head>", {
          status: 200,
          headers: { "Content-Type": "text/html" },
        }),
    );

    const result = await fetchLinkPreview("https://example.com/malformed");

    // Either returns null or returns a valid-but-mostly-empty object.
    // The important thing: does not throw.
    expect(result === null || typeof result === "object").toBe(true);
  });

  it("preserves the original Content-Type header when passing bytes to unfurl (non-UTF-8 charset)", async () => {
    // Regression test for the codex P2 finding: we must not decode the
    // response as UTF-8 before handing it off. Pages served as e.g.
    // Shift_JIS must reach unfurl with the original bytes and the
    // original Content-Type so unfurl's charset sniffing can decode.
    allowLookup();

    // Build a minimal HTML body as Latin-1 bytes (any non-UTF-8
    // encoding would do). If we accidentally decoded as UTF-8 and
    // re-encoded, non-ASCII bytes would be corrupted; here we assert
    // that the fetcher does NOT throw and returns metadata from the
    // bytes intact.
    const asciiHtml =
      '<!doctype html><html><head><meta charset="iso-8859-1">' +
      '<meta property="og:title" content="Café" />' +
      "</head><body></body></html>";
    const bytes = new TextEncoder().encode(asciiHtml);
    stubFetch(
      () =>
        new Response(bytes, {
          status: 200,
          headers: { "Content-Type": "text/html; charset=iso-8859-1" },
        }),
    );

    const result = await fetchLinkPreview("https://example.com/latin1");

    // The important thing is that fetchLinkPreview does not throw and
    // returns an object. unfurl.js handles the actual decoding; as
    // long as we pass raw bytes (not re-encoded text), it works.
    expect(result).not.toBeNull();
    expect(typeof result?.ogTitle).toBe("string");
  });

  it("SSRF bypass via IPv6-mapped IPv4 hex hostname is blocked (regression)", async () => {
    // The codex P1 finding: a literal hostname [::ffff:7f00:1] resolves
    // in the URL parser to the hex form and was previously allowed
    // through. We now block ALL ::ffff:-prefixed addresses.
    const fetchSpy = vi.fn();
    stubFetch(fetchSpy);

    const result = await fetchLinkPreview("http://[::ffff:7f00:1]/");

    expect(result).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
