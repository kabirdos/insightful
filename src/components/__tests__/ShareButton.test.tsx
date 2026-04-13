import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  type Mock,
} from "vitest";
import {
  performShare,
  createShareClickHandler,
} from "@/components/ShareButton";

// The component itself requires a DOM + React renderer to mount. This repo
// doesn't ship jsdom/testing-library, so we test the component's behavior via
// its two exported primitives:
//   - performShare: the clipboard-vs-navigator.share logic
//   - createShareClickHandler: the click handler (stopPropagation + copied state)
// Those two cover every branch the integration test would cover.

type NavShareFn = (data: ShareData) => Promise<void>;
type NavWriteTextFn = (text: string) => Promise<void>;

interface MutableNavigator {
  share?: NavShareFn;
  clipboard?: { writeText: NavWriteTextFn };
}

const nav = globalThis.navigator as unknown as MutableNavigator;
let originalShare: NavShareFn | undefined;
let originalClipboard: { writeText: NavWriteTextFn } | undefined;

beforeEach(() => {
  originalShare = nav.share;
  originalClipboard = nav.clipboard;
  vi.useFakeTimers();
});

afterEach(() => {
  if (originalShare === undefined) {
    delete nav.share;
  } else {
    nav.share = originalShare;
  }
  if (originalClipboard === undefined) {
    delete nav.clipboard;
  } else {
    nav.clipboard = originalClipboard;
  }
  vi.useRealTimers();
});

describe("performShare", () => {
  it("falls back to clipboard.writeText when navigator.share is unavailable", async () => {
    delete nav.share;
    const writeText = vi.fn<NavWriteTextFn>().mockResolvedValue(undefined);
    nav.clipboard = { writeText };

    const result = await performShare({ url: "https://example.test/x" });

    expect(result).toBe(true);
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText).toHaveBeenCalledWith("https://example.test/x");
  });

  it("prefers navigator.share when available and does NOT write to clipboard", async () => {
    const share = vi.fn<NavShareFn>().mockResolvedValue(undefined);
    const writeText = vi.fn<NavWriteTextFn>().mockResolvedValue(undefined);
    nav.share = share;
    nav.clipboard = { writeText };

    const result = await performShare({
      url: "https://example.test/x",
      title: "Hello",
    });

    expect(result).toBe(false);
    expect(share).toHaveBeenCalledWith({
      title: "Hello",
      url: "https://example.test/x",
    });
    expect(writeText).not.toHaveBeenCalled();
  });

  it("falls back to clipboard when navigator.share rejects with a non-abort error", async () => {
    nav.share = vi
      .fn<NavShareFn>()
      .mockRejectedValue(new Error("unsupported payload"));
    const writeText = vi.fn<NavWriteTextFn>().mockResolvedValue(undefined);
    nav.clipboard = { writeText };

    const result = await performShare({ url: "https://example.test/x" });

    expect(result).toBe(true);
    expect(writeText).toHaveBeenCalledWith("https://example.test/x");
  });
});

describe("createShareClickHandler", () => {
  it("calls stopPropagation and preventDefault on the event", async () => {
    delete nav.share;
    nav.clipboard = {
      writeText: vi.fn<NavWriteTextFn>().mockResolvedValue(undefined),
    };

    const setCopied = vi.fn();
    const stopPropagation = vi.fn();
    const preventDefault = vi.fn();

    const handler = createShareClickHandler({
      url: "https://example.test/a",
      setCopied,
    });

    await handler({ stopPropagation, preventDefault });

    expect(stopPropagation).toHaveBeenCalledTimes(1);
    expect(preventDefault).toHaveBeenCalledTimes(1);
  });

  it("toggles copied state — true immediately, false after timeout", async () => {
    delete nav.share;
    nav.clipboard = {
      writeText: vi.fn<NavWriteTextFn>().mockResolvedValue(undefined),
    };

    const setCopied = vi.fn() as Mock;
    const handler = createShareClickHandler({
      url: "https://example.test/a",
      setCopied,
      copiedDurationMs: 2000,
    });

    await handler({ stopPropagation: vi.fn(), preventDefault: vi.fn() });

    expect(setCopied).toHaveBeenNthCalledWith(1, true);
    // The "Copied!" label should NOT have cleared yet.
    expect(setCopied).toHaveBeenCalledTimes(1);

    // Advance past the hold duration and confirm the label clears.
    vi.advanceTimersByTime(2000);
    expect(setCopied).toHaveBeenNthCalledWith(2, false);
    expect(setCopied).toHaveBeenCalledTimes(2);
  });

  it("does not flip copied state when navigator.share handles the share natively", async () => {
    nav.share = vi.fn<NavShareFn>().mockResolvedValue(undefined);
    nav.clipboard = {
      writeText: vi.fn<NavWriteTextFn>().mockResolvedValue(undefined),
    };

    const setCopied = vi.fn();
    const handler = createShareClickHandler({
      url: "https://example.test/a",
      setCopied,
    });

    await handler({ stopPropagation: vi.fn(), preventDefault: vi.fn() });

    expect(setCopied).not.toHaveBeenCalled();
  });
});
