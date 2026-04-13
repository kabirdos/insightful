import { describe, it, expect } from "vitest";
import {
  buildProfileUrl,
  buildReportUrl,
  buildReportEditUrl,
  buildReportApiUrl,
  buildReportSubResourceApiUrl,
  buildOgImageUrl,
} from "../urls";

describe("buildProfileUrl", () => {
  it("returns root-level username path", () => {
    expect(buildProfileUrl("craig")).toBe("/craig");
  });

  it("preserves mixed-case usernames (Next.js routing is case-sensitive)", () => {
    expect(buildProfileUrl("CraigDS")).toBe("/CraigDS");
  });

  it("encodes special characters in segments", () => {
    expect(buildProfileUrl("a b")).toBe("/a%20b");
  });
});

describe("buildReportUrl", () => {
  it("composes /insights/{username}/{slug}", () => {
    expect(buildReportUrl("craig", "20260413-a4f2b1")).toBe(
      "/insights/craig/20260413-a4f2b1",
    );
  });

  it("encodes both segments", () => {
    expect(buildReportUrl("a b", "c/d")).toBe("/insights/a%20b/c%2Fd");
  });
});

describe("buildReportEditUrl", () => {
  it("appends /edit to the report URL", () => {
    expect(buildReportEditUrl("craig", "20260413-a4f2b1")).toBe(
      "/insights/craig/20260413-a4f2b1/edit",
    );
  });

  it("output starts with the buildReportUrl output", () => {
    const username = "craig";
    const slug = "20260413-a4f2b1";
    const reportUrl = buildReportUrl(username, slug);
    const editUrl = buildReportEditUrl(username, slug);
    expect(editUrl.startsWith(reportUrl)).toBe(true);
  });
});

describe("buildReportApiUrl", () => {
  it("composes /api/insights/{username}/{slug}", () => {
    expect(buildReportApiUrl("craig", "20260413-a4f2b1")).toBe(
      "/api/insights/craig/20260413-a4f2b1",
    );
  });
});

describe("buildReportSubResourceApiUrl", () => {
  it("appends a single sub-resource segment", () => {
    expect(buildReportSubResourceApiUrl("craig", "abc", "vote")).toBe(
      "/api/insights/craig/abc/vote",
    );
  });

  it("appends a multi-segment sub-resource", () => {
    expect(
      buildReportSubResourceApiUrl("craig", "abc", "projects/proj-1"),
    ).toBe("/api/insights/craig/abc/projects/proj-1");
  });

  it("encodes each sub-segment independently", () => {
    expect(buildReportSubResourceApiUrl("craig", "abc", "projects/a b")).toBe(
      "/api/insights/craig/abc/projects/a%20b",
    );
  });

  it("strips empty segments from leading or trailing slashes", () => {
    expect(buildReportSubResourceApiUrl("craig", "abc", "/vote/")).toBe(
      "/api/insights/craig/abc/vote",
    );
  });
});

describe("buildOgImageUrl", () => {
  it("composes /api/og/{username}/{slug}", () => {
    expect(buildOgImageUrl("craig", "20260413-a4f2b1")).toBe(
      "/api/og/craig/20260413-a4f2b1",
    );
  });
});

describe("contract: empty inputs do not silently get fixed", () => {
  // Documents the contract: callers are responsible for non-empty inputs.
  // Helpers do not throw or sanitize empty strings — they pass through.
  it("empty username produces a URL with empty segment", () => {
    expect(buildProfileUrl("")).toBe("/");
  });

  it("empty slug produces a URL with empty trailing segment", () => {
    expect(buildReportUrl("craig", "")).toBe("/insights/craig/");
  });
});
