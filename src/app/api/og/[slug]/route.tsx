import { ImageResponse } from "next/og";
import { prisma } from "@/lib/db";
import { resolveLinesAdded, resolveLinesRemoved } from "@/lib/lines-of-code";
import { estimateApiCostUsd } from "@/lib/api-cost";
import { normalizeHarnessData, type HarnessData } from "@/types/insights";

export const runtime = "nodejs";

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

function formatCost(usd: number): string {
  if (usd >= 1000) return `$${(usd / 1000).toFixed(1)}k`;
  if (usd >= 100) return `$${Math.round(usd)}`;
  if (usd >= 10) return `$${usd.toFixed(0)}`;
  return `$${usd.toFixed(2)}`;
}

function perWeek(total: number, days: number): number {
  if (days <= 0) return total;
  const weeks = Math.max(days / 7, 1);
  return total / weeks;
}

// 5-stop heatmap palettes.
const AMBER_SCALE = ["#f1f5f9", "#fef3c7", "#fcd34d", "#f59e0b", "#b45309"];
const GREEN_SCALE = ["#f1f5f9", "#dcfce7", "#86efac", "#22c55e", "#15803d"];

function scaleIdx(value: number, max: number): number {
  if (max === 0 || value === 0) return 0;
  const steps = 5;
  const idx = Math.min(Math.floor((value / max) * (steps - 1)) + 1, steps - 1);
  return idx;
}

// Deterministic synthetic daily series from aggregate totals. Used when
// we don't have a real per-day breakdown — the OG card renders a pattern
// that correlates with total activity rather than a flat block.
function synthesizeDaily(
  total: number,
  days: number,
  seedBase: number,
): number[] {
  const cells = 28;
  const out: number[] = new Array(cells).fill(0);
  if (days === 0 || total === 0) return out;
  const active = Math.min(days, cells);
  const avg = total / active;
  let seed = (seedBase % 997) + 13;
  for (let i = cells - active; i < cells; i++) {
    seed = (seed * 16807 + 7) % 2147483647;
    const variance = 0.3 + (seed % 1000) / 714;
    out[i] = Math.round(avg * variance);
  }
  for (let i = 0; i < cells; i++) {
    seed = (seed * 16807 + 7) % 2147483647;
    if (seed % 7 === 0 && i > cells - active) out[i] = 0;
  }
  return out;
}

function Heatmap({
  data,
  max,
  palette,
}: {
  data: number[];
  max: number;
  palette: string[];
}) {
  // 7 columns × 4 rows = 28 days. Column-major layout so each column is
  // a "week".
  return (
    <div style={{ display: "flex", gap: "4px" }}>
      {Array.from({ length: 7 }).map((_, col) => (
        <div
          key={col}
          style={{ display: "flex", flexDirection: "column", gap: "4px" }}
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
                  backgroundColor: palette[scaleIdx(data[idx], max)],
                }}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}

function HeatmapScale({
  palette,
  leftLabel,
  rightLabel,
}: {
  palette: string[];
  leftLabel: string;
  rightLabel: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "3px",
        marginTop: "6px",
        fontSize: "10px",
        color: "#94a3b8",
      }}
    >
      <span>{leftLabel}</span>
      {palette.map((c, i) => (
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
      <span>{rightLabel}</span>
    </div>
  );
}

export async function GET(
  _request: Request,
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
    const h = isHarness ? (harnessData as HarnessData) : null;

    const displayName = report.author.displayName || report.author.username;
    const initial = displayName[0]?.toUpperCase() ?? "?";
    const dayCount = report.dayCount ?? 28;

    // ── Top-right headline stats ─────────────────────────────────
    const totalTokens = h?.stats.totalTokens || report.totalTokens || 0;
    const tokensPerWeek = perWeek(totalTokens, dayCount);

    const costUsd = estimateApiCostUsd(
      h?.models,
      totalTokens,
      h?.perModelTokens ?? null,
    );
    const costPerWeek = perWeek(costUsd, dayCount);

    // ── Lifetime tokens line under the avatar ────────────────────
    const lifetimeTokens =
      h?.stats.lifetimeTokens && h.stats.lifetimeTokens > 0
        ? h.stats.lifetimeTokens
        : totalTokens;

    // ── 4 stat cards ─────────────────────────────────────────────
    const sessions = report.sessionCount || h?.stats.sessionCount || 0;
    const durationHours = h?.stats.durationHours || report.durationHours || 0;
    const skillsCount =
      h?.stats.skillsUsedCount ?? report.detectedSkills?.length ?? 0;

    const resolvedAdded =
      resolveLinesAdded({
        linesAdded: report.linesAdded,
        linesRemoved: report.linesRemoved,
        harnessData: h,
      }) ?? 0;
    const resolvedRemoved =
      resolveLinesRemoved({
        linesAdded: report.linesAdded,
        linesRemoved: report.linesRemoved,
        harnessData: h,
      }) ?? 0;
    const hasLines = resolvedAdded + resolvedRemoved > 0;
    const hasLinesSplit = resolvedAdded > 0 && resolvedRemoved > 0;

    // ── Dual heatmap series ──────────────────────────────────────
    const tokensDaily = synthesizeDaily(totalTokens, dayCount, totalTokens);
    const tokenMax = Math.max(...tokensDaily, 1);
    const costDaily = synthesizeDaily(
      costUsd,
      dayCount,
      Math.round(costUsd * 100) || 1,
    );
    const costMax = Math.max(...costDaily, 1);

    // ── Date range ───────────────────────────────────────────────
    const dateRange =
      report.dateRangeStart && report.dateRangeEnd
        ? `${new Date(report.dateRangeStart + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${new Date(report.dateRangeEnd + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
        : "";

    type FontEntry = {
      name: string;
      data: ArrayBuffer;
      style: "normal";
      weight: 400 | 600 | 700;
    };
    const fonts: FontEntry[] = [];
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
      fonts.push({
        name: "Inter",
        data: interFont,
        style: "normal" as const,
        weight: 700 as const,
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

        {/* TOP: avatar+id on the left, tokens/wk + cost/wk on the right */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            padding: "36px 56px 0 56px",
          }}
        >
          {/* Left: avatar + name + date + lifetime */}
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <div
              style={{
                width: "64px",
                height: "64px",
                borderRadius: "32px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "linear-gradient(135deg, #3b82f6, #0891b2)",
                color: "#ffffff",
                fontSize: "30px",
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              {initial}
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: "10px",
                }}
              >
                <span
                  style={{
                    fontSize: "28px",
                    fontWeight: 700,
                    color: "#0f172a",
                    lineHeight: 1,
                  }}
                >
                  {displayName}
                </span>
                <span
                  style={{
                    fontSize: "18px",
                    color: "#94a3b8",
                    fontWeight: 400,
                  }}
                >
                  @{report.author.username}
                </span>
              </div>
              {dateRange && (
                <span
                  style={{
                    fontSize: "16px",
                    color: "#94a3b8",
                    marginTop: "6px",
                  }}
                >
                  {dateRange}
                </span>
              )}
              {lifetimeTokens > 0 && (
                <span
                  style={{
                    fontSize: "18px",
                    fontWeight: 700,
                    color: "#2563eb",
                    marginTop: "4px",
                  }}
                >
                  {formatNumber(lifetimeTokens)} lifetime tokens
                </span>
              )}
            </div>
          </div>

          {/* Right: big tokens/wk + smaller cost/wk */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
            }}
          >
            <span
              style={{
                fontFamily: "JetBrains Mono, monospace",
                fontWeight: 700,
                fontSize: "64px",
                lineHeight: 1,
                color: "#2563eb",
              }}
            >
              {formatNumber(tokensPerWeek)}
            </span>
            <span
              style={{
                fontSize: "14px",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "#94a3b8",
                marginTop: "6px",
              }}
            >
              tokens / wk
            </span>
            {costUsd > 0 && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-end",
                  marginTop: "14px",
                }}
              >
                <span
                  style={{
                    fontFamily: "JetBrains Mono, monospace",
                    fontWeight: 700,
                    fontSize: "30px",
                    lineHeight: 1,
                    color: "#d97706",
                  }}
                >
                  {formatCost(costPerWeek)}
                </span>
                <span
                  style={{
                    fontSize: "12px",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    color: "#94a3b8",
                    marginTop: "4px",
                  }}
                >
                  api cost / wk
                </span>
              </div>
            )}
          </div>
        </div>

        {/* MIDDLE: 4-card stats grid */}
        <div
          style={{
            display: "flex",
            gap: "16px",
            padding: "28px 56px 20px 56px",
          }}
        >
          <StatCard
            value={formatNumber(Math.round(perWeek(sessions, dayCount)))}
            label="sessions / wk"
            color="#16a34a"
          />
          <StatCard
            value={formatDuration(perWeek(durationHours, dayCount))}
            label="active / wk"
            color="#0891b2"
          />
          <StatCard
            value={skillsCount.toString()}
            label={skillsCount === 1 ? "skill" : "skills"}
            color="#334155"
          />
          {hasLines ? (
            hasLinesSplit ? (
              <SplitStatCard
                added={formatLines(resolvedAdded)}
                removed={formatLines(resolvedRemoved)}
              />
            ) : (
              <StatCard
                value={formatLines(resolvedAdded + resolvedRemoved)}
                label="lines of code"
                color="#d97706"
              />
            )
          ) : (
            // Keep a 4th cell for layout symmetry even when LOC is missing.
            <StatCard
              value={formatNumber(report.commitCount ?? 0)}
              label="commits"
              color="#7c3aed"
            />
          )}
        </div>

        {/* BOTTOM: dual heatmaps */}
        <div
          style={{
            display: "flex",
            gap: "48px",
            padding: "0 56px 12px 56px",
            flex: 1,
            alignItems: "flex-start",
          }}
        >
          {isHarness && (
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color: "#94a3b8",
                  marginBottom: "8px",
                }}
              >
                Tokens · 4w
              </span>
              <Heatmap
                data={tokensDaily}
                max={tokenMax}
                palette={AMBER_SCALE}
              />
              <HeatmapScale
                palette={AMBER_SCALE}
                leftLabel="0"
                rightLabel={formatNumber(tokenMax)}
              />
            </div>
          )}
          {isHarness && costUsd > 0 && (
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color: "#94a3b8",
                  marginBottom: "8px",
                }}
              >
                API cost · 4w
              </span>
              <Heatmap data={costDaily} max={costMax} palette={GREEN_SCALE} />
              <HeatmapScale
                palette={GREEN_SCALE}
                leftLabel="$0"
                rightLabel={formatCost(costMax)}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 56px",
            borderTop: "1px solid #e2e8f0",
          }}
        >
          <span
            style={{
              fontSize: "16px",
              fontWeight: 600,
              color: "#64748b",
            }}
          >
            InsightHarness.com
          </span>
          <span style={{ fontSize: "13px", color: "#94a3b8" }}>
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

function StatCard({
  value,
  label,
  color,
}: {
  value: string;
  label: string;
  color: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        flex: 1,
        background: "#f8fafc",
        border: "1px solid #e2e8f0",
        borderRadius: "10px",
        padding: "16px 12px",
      }}
    >
      <span
        style={{
          fontFamily: "JetBrains Mono, monospace",
          fontWeight: 700,
          fontSize: "40px",
          lineHeight: 1,
          color,
        }}
      >
        {value}
      </span>
      <span
        style={{
          fontSize: "12px",
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          color: "#94a3b8",
          marginTop: "8px",
        }}
      >
        {label}
      </span>
    </div>
  );
}

function SplitStatCard({ added, removed }: { added: string; removed: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        flex: 1,
        background: "#f8fafc",
        border: "1px solid #e2e8f0",
        borderRadius: "10px",
        padding: "16px 12px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: "10px",
          fontFamily: "JetBrains Mono, monospace",
          fontWeight: 700,
          fontSize: "28px",
          lineHeight: 1,
        }}
      >
        <span style={{ color: "#16a34a" }}>+{added}</span>
        <span style={{ color: "#dc2626" }}>-{removed}</span>
      </div>
      <span
        style={{
          fontSize: "12px",
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          color: "#94a3b8",
          marginTop: "8px",
        }}
      >
        lines of code
      </span>
    </div>
  );
}
