import { ImageResponse } from "next/og";

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

// Fake-but-plausible demo data for the home share card. Mirrors a typical
// active Claude Code user so the card reads as a product sample rather
// than a real profile. Names / handles are invented.
const DEMO = {
  name: "Sam Developer",
  handle: "samdev",
  dateRange: "Mar 14 – Apr 11, 2026",
  lifetimeTokens: "27.1M",
  tokensPerWeek: "2.1M",
  costPerWeek: "$13",
  sessions: "21",
  active: "50h",
  skills: "44",
  linesAdded: "+38.5k",
  linesRemoved: "-12.1k",
};

// Static heatmap patterns — hand-picked so both scales look lived-in
// without generating them at request time.
const AMBER_PALETTE = ["#f1f5f9", "#fef3c7", "#fcd34d", "#f59e0b", "#b45309"];
const GREEN_PALETTE = ["#f1f5f9", "#dcfce7", "#86efac", "#22c55e", "#15803d"];

// 28 cells (column-major, 7 cols × 4 rows). Values 0-4 index into palette.
const TOKEN_PATTERN = [
  1, 2, 0, 3, 2, 0, 1, 3, 0, 2, 4, 4, 3, 2, 0, 3, 3, 2, 0, 1, 4, 2, 3, 4, 0, 3,
  4, 4,
];
const COST_PATTERN = [
  1, 3, 0, 2, 1, 0, 2, 3, 0, 3, 4, 1, 3, 2, 0, 2, 4, 0, 3, 4, 3, 2, 1, 4, 0, 3,
  2, 4,
];

function Heatmap({ levels, palette }: { levels: number[]; palette: string[] }) {
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
                  backgroundColor: palette[levels[idx] ?? 0],
                }}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
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

export async function GET() {
  try {
    const { interFont, jetbrainsFont } = await loadFonts();

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

        {/* Product headline band — replaces the per-profile avatar+stats
              row with a product pitch so the card reads as marketing, not
              as someone's profile. */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            padding: "28px 56px 16px 56px",
          }}
        >
          <span
            style={{
              fontSize: "44px",
              fontWeight: 700,
              color: "#0f172a",
              lineHeight: 1.05,
            }}
          >
            See how developers use Claude Code
          </span>
          <span
            style={{
              fontSize: "20px",
              color: "#475569",
              marginTop: "10px",
              lineHeight: 1.3,
              maxWidth: "820px",
            }}
          >
            Upload your{" "}
            <code
              style={{
                fontFamily: "JetBrains Mono, monospace",
                background: "#f1f5f9",
                padding: "1px 8px",
                borderRadius: "4px",
                fontSize: "18px",
              }}
            >
              /insights
            </code>{" "}
            report to share a profile like this — tokens, sessions, skills,
            plugins, and the workflows behind them.
          </span>
        </div>

        {/* Sample profile card preview — same visual language as the
              real profile OG card so viewers recognize the format. */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            margin: "0 56px",
            border: "1px solid #e2e8f0",
            borderRadius: "14px",
            background: "#ffffff",
            overflow: "hidden",
            boxShadow: "0 2px 6px rgba(15, 23, 42, 0.04)",
          }}
        >
          {/* Inner top: demo avatar + demo headline stats */}
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              padding: "18px 22px 0 22px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
              }}
            >
              <div
                style={{
                  width: "44px",
                  height: "44px",
                  borderRadius: "22px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "linear-gradient(135deg, #3b82f6, #0891b2)",
                  color: "#ffffff",
                  fontSize: "20px",
                  fontWeight: 700,
                }}
              >
                S
              </div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    gap: "8px",
                  }}
                >
                  <span
                    style={{
                      fontSize: "18px",
                      fontWeight: 700,
                      color: "#0f172a",
                      lineHeight: 1,
                    }}
                  >
                    {DEMO.name}
                  </span>
                  <span
                    style={{
                      fontSize: "14px",
                      color: "#94a3b8",
                    }}
                  >
                    @{DEMO.handle}
                  </span>
                </div>
                <span
                  style={{
                    fontSize: "13px",
                    color: "#94a3b8",
                    marginTop: "4px",
                  }}
                >
                  {DEMO.dateRange}
                </span>
                <span
                  style={{
                    fontSize: "14px",
                    fontWeight: 700,
                    color: "#2563eb",
                    marginTop: "3px",
                  }}
                >
                  {DEMO.lifetimeTokens} lifetime tokens
                </span>
              </div>
            </div>
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
                  fontSize: "36px",
                  lineHeight: 1,
                  color: "#2563eb",
                }}
              >
                {DEMO.tokensPerWeek}
              </span>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color: "#94a3b8",
                  marginTop: "4px",
                }}
              >
                tokens / wk
              </span>
              <span
                style={{
                  fontFamily: "JetBrains Mono, monospace",
                  fontWeight: 700,
                  fontSize: "20px",
                  lineHeight: 1,
                  color: "#d97706",
                  marginTop: "8px",
                }}
              >
                {DEMO.costPerWeek}
              </span>
              <span
                style={{
                  fontSize: "10px",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color: "#94a3b8",
                  marginTop: "2px",
                }}
              >
                api cost / wk
              </span>
            </div>
          </div>

          {/* Inner middle: 4 stat cards */}
          <div
            style={{
              display: "flex",
              gap: "10px",
              padding: "14px 22px 14px 22px",
            }}
          >
            <StatCard
              value={DEMO.sessions}
              label="sessions / wk"
              color="#16a34a"
            />
            <StatCard value={DEMO.active} label="active / wk" color="#0891b2" />
            <StatCard value={DEMO.skills} label="skills" color="#334155" />
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
                padding: "14px 10px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: "8px",
                  fontFamily: "JetBrains Mono, monospace",
                  fontWeight: 700,
                  fontSize: "22px",
                  lineHeight: 1,
                }}
              >
                <span style={{ color: "#16a34a" }}>{DEMO.linesAdded}</span>
                <span style={{ color: "#dc2626" }}>{DEMO.linesRemoved}</span>
              </div>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: "#94a3b8",
                  marginTop: "6px",
                }}
              >
                lines of code
              </span>
            </div>
          </div>

          {/* Inner bottom: dual heatmaps */}
          <div
            style={{
              display: "flex",
              gap: "32px",
              padding: "0 22px 14px 22px",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span
                style={{
                  fontSize: "10px",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color: "#94a3b8",
                  marginBottom: "6px",
                }}
              >
                Tokens · 4w
              </span>
              <Heatmap levels={TOKEN_PATTERN} palette={AMBER_PALETTE} />
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span
                style={{
                  fontSize: "10px",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color: "#94a3b8",
                  marginBottom: "6px",
                }}
              >
                API cost · 4w
              </span>
              <Heatmap levels={COST_PATTERN} palette={GREEN_PALETTE} />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 56px",
            borderTop: "1px solid #e2e8f0",
            marginTop: "auto",
          }}
        >
          <span
            style={{
              fontSize: "18px",
              fontWeight: 700,
              color: "#0f172a",
            }}
          >
            InsightHarness.com
          </span>
          <span style={{ fontSize: "14px", color: "#64748b" }}>
            Browse real Claude Code workflows
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
    console.error("Home OG image generation error:", error);
    return new Response("Failed to generate image", { status: 500 });
  }
}
