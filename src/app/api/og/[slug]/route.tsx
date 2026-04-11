import { ImageResponse } from "next/og";
import { prisma } from "@/lib/db";
import {
  resolveLinesAdded,
  resolveLinesRemoved,
} from "@/lib/lines-of-code";
import { normalizeHarnessData, type HarnessData } from "@/types/insights";

export const runtime = "nodejs";

// Google Fonts as ArrayBuffer
async function loadFonts() {
  const [interRes, jetbrainsRes] = await Promise.all([
    fetch(
      "https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap",
    ).then((r) => r.text()),
    fetch(
      "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@600;700&display=swap",
    ).then((r) => r.text()),
  ]);

  const extractUrl = (css: string) => {
    const match = css.match(/src:\s*url\(([^)]+)\)/);
    return match?.[1] ?? null;
  };

  const interUrl = extractUrl(interRes);
  const jetbrainsUrl = extractUrl(jetbrainsRes);

  const [interFont, jetbrainsFont] = await Promise.all([
    interUrl ? fetch(interUrl).then((r) => r.arrayBuffer()) : null,
    jetbrainsUrl ? fetch(jetbrainsUrl).then((r) => r.arrayBuffer()) : null,
  ]);

  return { interFont, jetbrainsFont };
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}k`;
  return n.toLocaleString();
}

// Compact lines-of-code formatter mirroring HeroStats: "18.4k" above 1000,
// rounded number below. Used for the OG card LINES/WK cell so the format
// stays consistent with the detail page.
function formatLines(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 100_000) return `${Math.round(n / 1_000)}k`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return Math.round(n).toLocaleString();
}

function formatDuration(hours: number): string {
  if (hours >= 100) return `${Math.round(hours)}h`;
  if (hours >= 10) return `${hours.toFixed(0)}h`;
  return `${hours.toFixed(1)}h`;
}

// Compute per-week stats
function perWeek(total: number, days: number): string {
  if (days <= 0) return formatNumber(total);
  const weeks = Math.max(days / 7, 1);
  return formatNumber(Math.round(total / weeks));
}

// Heatmap color scale
const HEATMAP_COLORS = [
  "#f1f5f9",
  "#dbeafe",
  "#93c5fd",
  "#60a5fa",
  "#3b82f6",
  "#1d4ed8",
];

function getHeatmapColor(value: number, max: number): string {
  if (max === 0 || value === 0) return HEATMAP_COLORS[0];
  const idx = Math.min(
    Math.floor((value / max) * (HEATMAP_COLORS.length - 1)) + 1,
    HEATMAP_COLORS.length - 1,
  );
  return HEATMAP_COLORS[idx];
}

// Generate synthetic daily activity from aggregate stats
function generateDailyActivity(
  totalTokens: number,
  totalSessions: number,
  dayCount: number,
): number[] {
  const days = Math.min(dayCount, 28);
  const cells = 28;
  const activity: number[] = new Array(cells).fill(0);

  if (days === 0 || totalTokens === 0) return activity;

  // Distribute tokens across active days with some variance
  const avgPerDay = totalTokens / days;
  let seed = totalTokens % 997; // deterministic pseudo-random
  for (let i = cells - days; i < cells; i++) {
    seed = (seed * 16807 + 7) % 2147483647;
    const variance = 0.3 + (seed % 1000) / 714; // 0.3 - 1.7
    activity[i] = Math.round(avgPerDay * variance);
  }

  // Some days might be zero (weekends)
  for (let i = 0; i < cells; i++) {
    seed = (seed * 16807 + 7) % 2147483647;
    if (seed % 7 === 0 && i > cells - days) {
      activity[i] = 0;
    }
  }

  return activity;
}

interface StatItem {
  value: string;
  label: string;
  color: string;
  // Optional override so the LINES/WK cell can shrink slightly to fit the
  // wider "+18.4k/-9.2k" string while the rest of the row stays visually
  // dominant.
  fontSize?: number;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;

    const report = await prisma.insightReport.findUnique({
      where: { slug },
      include: {
        author: {
          select: {
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
    });

    if (!report) {
      return new Response("Not found", { status: 404 });
    }

    const { interFont, jetbrainsFont } = await loadFonts();

    const harnessData = normalizeHarnessData(report.harnessData);
    const isHarness = report.reportType === "insight-harness" && harnessData;

    const displayName = report.author.displayName || report.author.username;
    const initial = displayName[0].toUpperCase();
    const dayCount = report.dayCount ?? 28;
    const weeks = Math.max(dayCount / 7, 1);

    // Build stats
    const stats: StatItem[] = [];

    if (isHarness && harnessData) {
      const h = harnessData as HarnessData;
      const totalTokens = h.stats.totalTokens || report.totalTokens || 0;
      const sessions = report.sessionCount || h.stats.sessionCount || 0;
      const commits = report.commitCount ?? h.stats.commitCount ?? 0;
      const duration = h.stats.durationHours || report.durationHours || 0;

      // Lines of code: prefer scalar columns (populated for `insights`
      // reports and any harness reports that carry them), and fall back to
      // the harness `gitPatterns.linesAdded` display string when scalars
      // are null. Without this fallback the LINES/WK cell rendered `0` for
      // every harness report whose scalar columns weren't populated by
      // upload — see issues #29 / #35. Shared resolver lives in
      // src/lib/lines-of-code.ts so ProfileCard and HeroStats get the same
      // fallback.
      const resolvedAdded = resolveLinesAdded({
        linesAdded: report.linesAdded,
        linesRemoved: report.linesRemoved,
        harnessData: h,
      });
      const resolvedRemoved = resolveLinesRemoved({
        linesAdded: report.linesAdded,
        linesRemoved: report.linesRemoved,
        harnessData: h,
      });
      const scalarAdded = resolvedAdded ?? 0;
      const scalarRemoved = resolvedRemoved ?? 0;
      const totalLines = scalarAdded + scalarRemoved;
      const hasLinesData = totalLines > 0;
      const hasSplit = scalarAdded > 0 && scalarRemoved > 0;

      stats.push({
        value: perWeek(totalTokens, dayCount),
        label: "tokens/wk",
        color: "#2563eb",
      });
      stats.push({
        value: perWeek(sessions, dayCount),
        label: "sessions/wk",
        color: "#16a34a",
      });
      stats.push({
        value: perWeek(commits, dayCount),
        label: "commits/wk",
        color: "#7c3aed",
      });
      // Only render the LINES/WK cell when we have real data — never
      // render `0`, which falsely implies the user wrote no code.
      if (hasLinesData) {
        const linesValue = hasSplit
          ? // Split format mirrors HeroStats: per-week additions and
            // removals shown side-by-side. Compact, no spaces, so the
            // string fits the cell at the slightly reduced font size.
            `+${formatLines(scalarAdded / weeks)}/-${formatLines(scalarRemoved / weeks)}`
          : // Single combined value when only the harness fallback (or
            // only one of the two scalars) is available.
            formatLines(totalLines / weeks);
        stats.push({
          value: linesValue,
          label: "lines/wk",
          color: "#d97706",
          // Shrink only this cell so the wider split string fits on one
          // line in monospace without truncating the rest of the row.
          fontSize: hasSplit ? 38 : 56,
        });
      }
      stats.push({
        value: formatDuration(duration / weeks),
        label: "duration/wk",
        color: "#0891b2",
      });
    } else {
      // Standard insights-report fallback
      stats.push({
        value: formatNumber(report.sessionCount ?? 0),
        label: "sessions",
        color: "#16a34a",
      });
      stats.push({
        value: formatNumber(report.messageCount ?? 0),
        label: "messages",
        color: "#2563eb",
      });
      stats.push({
        value: formatNumber(report.commitCount ?? 0),
        label: "commits",
        color: "#7c3aed",
      });
      // Same null-safe LOC handling as the harness branch: only render the
      // cell when there is real data, prefer split format when both
      // additions and removals are populated. Shared resolver is still
      // used here even though `insights` reports have no harnessData
      // fallback — it keeps the read path symmetrical with the harness
      // branch and demo reports.
      const insightsAdded =
        resolveLinesAdded({
          linesAdded: report.linesAdded,
          linesRemoved: report.linesRemoved,
          harnessData: null,
        }) ?? 0;
      const insightsRemoved =
        resolveLinesRemoved({
          linesAdded: report.linesAdded,
          linesRemoved: report.linesRemoved,
          harnessData: null,
        }) ?? 0;
      const insightsTotal = insightsAdded + insightsRemoved;
      if (insightsTotal > 0) {
        const hasSplit = insightsAdded > 0 && insightsRemoved > 0;
        stats.push({
          value: hasSplit
            ? `+${formatLines(insightsAdded)}/-${formatLines(insightsRemoved)}`
            : formatLines(insightsTotal),
          label: "lines",
          color: "#d97706",
          fontSize: hasSplit ? 38 : 56,
        });
      }
    }

    // Heatmap data
    const totalTokens =
      (isHarness && harnessData
        ? (harnessData as HarnessData).stats.totalTokens
        : 0) ||
      report.totalTokens ||
      0;
    const totalSessions = report.sessionCount ?? 0;
    const dailyActivity = generateDailyActivity(
      totalTokens,
      totalSessions,
      dayCount,
    );
    const maxActivity = Math.max(...dailyActivity, 1);

    // Date range
    const dateRange =
      report.dateRangeStart && report.dateRangeEnd
        ? `${new Date(report.dateRangeStart + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${new Date(report.dateRangeEnd + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
        : "";

    const fonts = [];
    if (interFont) {
      fonts.push({
        name: "Inter",
        data: interFont,
        style: "normal" as const,
        weight: 400 as const,
      });
      fonts.push({
        name: "Inter",
        data: interFont,
        style: "normal" as const,
        weight: 600 as const,
      });
    }
    if (jetbrainsFont) {
      fonts.push({
        name: "JetBrains Mono",
        data: jetbrainsFont,
        style: "normal" as const,
        weight: 700 as const,
      });
    }

    return new ImageResponse(
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#ffffff",
          fontFamily: "Inter, sans-serif",
        }}
      >
        {/* Gradient accent bar */}
        <div
          style={{
            width: "100%",
            height: "4px",
            display: "flex",
            background: "linear-gradient(to right, #2563eb, #7c3aed, #0891b2)",
          }}
        />

        {/* Main content */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            padding: "32px 48px 24px 48px",
            flex: 1,
          }}
        >
          {/* Author row */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              marginBottom: "28px",
            }}
          >
            {/* Avatar circle */}
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "24px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "linear-gradient(135deg, #3b82f6, #7c3aed)",
                color: "#ffffff",
                fontSize: "22px",
                fontWeight: 700,
              }}
            >
              {initial}
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                marginLeft: "14px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <span
                  style={{
                    fontSize: "20px",
                    fontWeight: 600,
                    color: "#0f172a",
                  }}
                >
                  {displayName}
                </span>
                <span
                  style={{
                    fontSize: "16px",
                    color: "#64748b",
                  }}
                >
                  @{report.author.username}
                </span>
              </div>
              {dateRange && (
                <span
                  style={{
                    fontSize: "14px",
                    color: "#94a3b8",
                    marginTop: "2px",
                  }}
                >
                  {dateRange}
                </span>
              )}
            </div>
          </div>

          {/* Stats row — big monospace numbers. Numbers dominate the
              card; unit labels stay small. The optional per-stat
              fontSize override lets the LINES/WK split-format cell shrink
              slightly so its wider value still fits on one line. */}
          <div
            style={{
              display: "flex",
              gap: "36px",
              marginBottom: "32px",
              alignItems: "flex-end",
            }}
          >
            {stats.map((s) => (
              <div
                key={s.label}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                }}
              >
                <span
                  style={{
                    fontFamily: "JetBrains Mono, monospace",
                    fontSize: `${s.fontSize ?? 56}px`,
                    fontWeight: 700,
                    color: s.color,
                    lineHeight: 1,
                  }}
                >
                  {s.value}
                </span>
                <span
                  style={{
                    fontSize: "14px",
                    color: "#94a3b8",
                    marginTop: "8px",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  {s.label}
                </span>
              </div>
            ))}
          </div>

          {/* Middle row: 28-day activity heatmap (skills section removed
              per issue #29 — the reclaimed space serves as visual
              breathing room for the larger stats row above). */}
          <div
            style={{
              display: "flex",
              gap: "40px",
              flex: 1,
              alignItems: "flex-start",
            }}
          >
            {/* Heatmap */}
            {isHarness && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <span
                  style={{
                    fontSize: "11px",
                    color: "#94a3b8",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    marginBottom: "8px",
                  }}
                >
                  28-day activity
                </span>
                {/* 7 columns x 4 rows */}
                <div style={{ display: "flex", gap: "4px" }}>
                  {Array.from({ length: 7 }).map((_, col) => (
                    <div
                      key={col}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "4px",
                      }}
                    >
                      {Array.from({ length: 4 }).map((_, row) => {
                        const idx = row * 7 + col;
                        return (
                          <div
                            key={idx}
                            style={{
                              width: "20px",
                              height: "20px",
                              borderRadius: "3px",
                              backgroundColor: getHeatmapColor(
                                dailyActivity[idx],
                                maxActivity,
                              ),
                            }}
                          />
                        );
                      })}
                    </div>
                  ))}
                </div>
                {/* Scale */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "3px",
                    marginTop: "6px",
                  }}
                >
                  <span style={{ fontSize: "10px", color: "#94a3b8" }}>0</span>
                  {HEATMAP_COLORS.map((c, i) => (
                    <div
                      key={i}
                      style={{
                        width: "12px",
                        height: "12px",
                        borderRadius: "2px",
                        backgroundColor: c,
                      }}
                    />
                  ))}
                  <span style={{ fontSize: "10px", color: "#94a3b8" }}>
                    {formatNumber(maxActivity)}
                  </span>
                </div>
              </div>
            )}

          </div>
        </div>

        {/* Brand footer */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 48px",
            borderTop: "1px solid #e2e8f0",
          }}
        >
          <span
            style={{
              fontSize: "14px",
              fontWeight: 600,
              color: "#64748b",
            }}
          >
            InsightHarness.com
          </span>
          <span
            style={{
              fontSize: "12px",
              color: "#94a3b8",
            }}
          >
            See how developers use Claude Code
          </span>
        </div>
      </div>,
      {
        width: 1200,
        height: 630,
        fonts: fonts.length > 0 ? fonts : undefined,
      },
    );
  } catch (error) {
    console.error("OG image generation error:", error);
    return new Response("Failed to generate image", { status: 500 });
  }
}
