import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { logHarnessRequest } from "../harness-logging";

describe("logHarnessRequest", () => {
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it("emits a single JSON line with all provided fields", () => {
    logHarnessRequest({
      uploadId: "upload-1",
      userId: "user-1",
      tokenSelectorPrefix: "abcdef12",
      contentLength: 1024,
      replayed: false,
      statusCode: 200,
      durationMs: 42,
    });

    expect(logSpy).toHaveBeenCalledTimes(1);
    const arg = logSpy.mock.calls[0][0];
    expect(typeof arg).toBe("string");
    // Single line: no internal newlines.
    expect((arg as string).includes("\n")).toBe(false);

    const parsed = JSON.parse(arg as string);
    expect(parsed).toMatchObject({
      event: "harness_direct_post",
      uploadId: "upload-1",
      userId: "user-1",
      tokenSelectorPrefix: "abcdef12",
      contentLength: 1024,
      replayed: false,
      statusCode: 200,
      durationMs: 42,
    });
  });

  it("never logs the full token, the secret, or the request body", () => {
    logHarnessRequest({
      uploadId: "upload-1",
      userId: "user-1",
      tokenSelectorPrefix: "abcdef12",
      statusCode: 200,
      durationMs: 1,
    });

    const parsed = JSON.parse(logSpy.mock.calls[0][0] as string);
    // Selector prefix must be exactly the 8 chars callers passed in.
    expect(parsed.tokenSelectorPrefix).toBe("abcdef12");
    expect(parsed.tokenSelectorPrefix.length).toBe(8);
    // No leakage shapes.
    expect(parsed).not.toHaveProperty("token");
    expect(parsed).not.toHaveProperty("rawToken");
    expect(parsed).not.toHaveProperty("secret");
    expect(parsed).not.toHaveProperty("hashedSecret");
    expect(parsed).not.toHaveProperty("body");
    expect(parsed).not.toHaveProperty("requestBody");
  });

  it("drops undefined optional fields rather than emitting them as null", () => {
    logHarnessRequest({
      statusCode: 401,
      durationMs: 3,
    });

    const parsed = JSON.parse(logSpy.mock.calls[0][0] as string);
    expect(parsed).not.toHaveProperty("uploadId");
    expect(parsed).not.toHaveProperty("userId");
    expect(parsed).not.toHaveProperty("tokenSelectorPrefix");
    expect(parsed).not.toHaveProperty("replayed");
    expect(parsed).not.toHaveProperty("rateLimitReason");
  });

  it("includes rateLimitReason when set on a 429", () => {
    logHarnessRequest({
      uploadId: "upload-1",
      userId: "user-1",
      statusCode: 429,
      durationMs: 5,
      rateLimitReason: "uploads_24h",
    });

    const parsed = JSON.parse(logSpy.mock.calls[0][0] as string);
    expect(parsed.rateLimitReason).toBe("uploads_24h");
    expect(parsed.statusCode).toBe(429);
  });
});
