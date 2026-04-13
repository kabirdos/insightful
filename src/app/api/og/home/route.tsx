import { ImageResponse } from "next/og";

export const runtime = "nodejs";

async function loadFonts() {
  const [interRes, jetbrainsRes] = await Promise.all([
    fetch(
      "https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap",
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

// Invented numbers for the marketing card. Mirrors the shape of the
// profile card so viewers can see what uploading produces. Keep these
// plausible but not borrowed from any real user.
const DEMO = {
  tokensPerWeek: "2.1M",
  costPerWeek: "$13",
  sessions: "21",
  skills: "44",
  linesAdded: "+38.5k",
  linesRemoved: "-12.1k",
};

const AMBER_PALETTE = ["#f1f5f9", "#fef3c7", "#fcd34d", "#f59e0b", "#b45309"];
const GREEN_PALETTE = ["#f1f5f9", "#dcfce7", "#86efac", "#22c55e", "#15803d"];

// 28 hand-tuned heatmap levels (0-4) so the patterns look lived-in.
const TOKEN_LEVELS = [
  1, 2, 0, 3, 2, 0, 1, 3, 0, 2, 4, 4, 3, 2, 0, 3, 3, 2, 0, 1, 4, 2, 3, 4, 0, 3,
  4, 4,
];
const COST_LEVELS = [
  1, 3, 0, 2, 1, 0, 2, 3, 0, 3, 4, 1, 3, 2, 0, 2, 4, 0, 3, 4, 3, 2, 1, 4, 0, 3,
  2, 4,
];

function Heatmap({ levels, palette }: { levels: number[]; palette: string[] }) {
  return (
    <div style={{ display: "flex", gap: "5px" }}>
      {Array.from({ length: 7 }).map((_, col) => (
        <div
          key={col}
          style={{ display: "flex", flexDirection: "column", gap: "5px" }}
        >
          {Array.from({ length: 4 }).map((_, row) => {
            const idx = row * 7 + col;
            return (
              <div
                key={idx}
                style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "4px",
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
        borderRadius: "12px",
        padding: "20px 16px",
      }}
    >
      <span
        style={{
          fontFamily: "JetBrains Mono, monospace",
          fontWeight: 700,
          fontSize: "56px",
          lineHeight: 1,
          color,
        }}
      >
        {value}
      </span>
      <span
        style={{
          fontSize: "14px",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: "#94a3b8",
          marginTop: "10px",
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
      weight: 400 | 600 | 700 | 800;
    };
    const fonts: FontEntry[] = [];
    if (interFont) {
      fonts.push({
        name: "Inter",
        data: interFont,
        style: "normal",
        weight: 400,
      });
      fonts.push({
        name: "Inter",
        data: interFont,
        style: "normal",
        weight: 600,
      });
      fonts.push({
        name: "Inter",
        data: interFont,
        style: "normal",
        weight: 700,
      });
      fonts.push({
        name: "Inter",
        data: interFont,
        style: "normal",
        weight: 800,
      });
    }
    if (jetbrainsFont) {
      fonts.push({
        name: "JetBrains Mono",
        data: jetbrainsFont,
        style: "normal",
        weight: 700,
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
        {/* Accent bar */}
        <div
          style={{
            width: "100%",
            height: "6px",
            display: "flex",
            background: "linear-gradient(to right, #2563eb, #7c3aed, #0891b2)",
          }}
        />

        {/* ── TOP: /insight-harness logo (L) + demo tokens/wk + cost/wk (R) ── */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            padding: "32px 56px 0 56px",
          }}
        >
          {/* Product wordmark — monospace slash-prefix reads as a
                Claude Code command, which is how the product is
                surfaced ("run /insights, upload it here"). */}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <span
              style={{
                fontFamily: "JetBrains Mono, monospace",
                fontSize: "52px",
                fontWeight: 700,
                color: "#0f172a",
                lineHeight: 1,
              }}
            >
              /insight-harness
            </span>
            <span
              style={{
                fontSize: "20px",
                color: "#64748b",
                marginTop: "4px",
              }}
            >
              See how developers use Claude Code
            </span>
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
                fontSize: "72px",
                lineHeight: 1,
                color: "#2563eb",
              }}
            >
              {DEMO.tokensPerWeek}
            </span>
            <span
              style={{
                fontSize: "16px",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "#94a3b8",
                marginTop: "6px",
              }}
            >
              tokens / wk
            </span>
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
                  fontSize: "36px",
                  lineHeight: 1,
                  color: "#d97706",
                }}
              >
                {DEMO.costPerWeek}
              </span>
              <span
                style={{
                  fontSize: "13px",
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
          </div>
        </div>

        {/* ── HERO: product pitch fills the space where lifetime
              tokens sit on the profile card ── */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px 56px 8px 56px",
          }}
        >
          <span
            style={{
              fontSize: "108px",
              fontWeight: 800,
              lineHeight: 1,
              letterSpacing: "-0.02em",
              color: "#0f172a",
              backgroundImage:
                "linear-gradient(135deg, #2563eb 0%, #7c3aed 50%, #0891b2 100%)",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            See how it was built.
          </span>
        </div>

        {/* ── STATS: 3 demo cards ── */}
        <div
          style={{
            display: "flex",
            gap: "18px",
            padding: "18px 56px 14px 56px",
          }}
        >
          <StatCard
            value={DEMO.sessions}
            label="sessions / wk"
            color="#16a34a"
          />
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
              borderRadius: "12px",
              padding: "20px 16px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: "14px",
                fontFamily: "JetBrains Mono, monospace",
                fontWeight: 700,
                fontSize: "40px",
                lineHeight: 1,
              }}
            >
              <span style={{ color: "#16a34a" }}>{DEMO.linesAdded}</span>
              <span style={{ color: "#dc2626" }}>{DEMO.linesRemoved}</span>
            </div>
            <span
              style={{
                fontSize: "14px",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "#94a3b8",
                marginTop: "10px",
              }}
            >
              lines of code
            </span>
          </div>
        </div>

        {/* ── HEATMAPS ── */}
        <div
          style={{
            display: "flex",
            gap: "56px",
            padding: "6px 56px 10px 56px",
            flex: 1,
            alignItems: "flex-start",
            justifyContent: "center",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span
              style={{
                fontSize: "13px",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "#94a3b8",
                marginBottom: "8px",
              }}
            >
              Tokens · 4w
            </span>
            <Heatmap levels={TOKEN_LEVELS} palette={AMBER_PALETTE} />
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span
              style={{
                fontSize: "13px",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "#94a3b8",
                marginBottom: "8px",
              }}
            >
              API cost · 4w
            </span>
            <Heatmap levels={COST_LEVELS} palette={GREEN_PALETTE} />
          </div>
        </div>

        {/* ── FOOTER ── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 56px",
            borderTop: "1px solid #e2e8f0",
          }}
        >
          <span style={{ fontSize: "18px", fontWeight: 700, color: "#0f172a" }}>
            InsightHarness.com
          </span>
          <span style={{ fontSize: "14px", color: "#64748b" }}>
            Upload your /insights report
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
