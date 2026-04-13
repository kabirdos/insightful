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

const DEMO = {
  tokensPerWeek: "2.1M",
  costPerWeek: "$13",
  sessions: "21",
  skills: "44",
  linesAdded: "+38.5k",
  linesRemoved: "-12.1k",
};

const LABEL = "#334155"; // slate-700

const AMBER_PALETTE = ["#f1f5f9", "#fef3c7", "#fcd34d", "#f59e0b", "#b45309"];
const GREEN_PALETTE = ["#f1f5f9", "#dcfce7", "#86efac", "#22c55e", "#15803d"];

// 28 hand-tuned levels (0-4) for the wide 14×2 strip.
const TOKEN_LEVELS = [
  1, 2, 0, 3, 2, 0, 1, 3, 0, 2, 4, 4, 3, 2, 0, 3, 3, 2, 0, 1, 4, 2, 3, 4, 0, 3,
  4, 4,
];
const COST_LEVELS = [
  1, 3, 0, 2, 1, 0, 2, 3, 0, 3, 4, 1, 3, 2, 0, 2, 4, 0, 3, 4, 3, 2, 1, 4, 0, 3,
  2, 4,
];

function HeatmapStrip({
  levels,
  palette,
}: {
  levels: number[];
  palette: string[];
}) {
  const cell = 30;
  const gap = 4;
  const cols = 14;
  const rows = 2;
  return (
    <div style={{ display: "flex", gap: `${gap}px` }}>
      {Array.from({ length: cols }).map((_, col) => (
        <div
          key={col}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: `${gap}px`,
          }}
        >
          {Array.from({ length: rows }).map((_, row) => {
            const idx = row * cols + col;
            return (
              <div
                key={idx}
                style={{
                  width: `${cell}px`,
                  height: `${cell}px`,
                  borderRadius: "5px",
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
        padding: "16px 14px",
      }}
    >
      <span
        style={{
          fontFamily: "JetBrains Mono, monospace",
          fontWeight: 700,
          fontSize: "52px",
          lineHeight: 1,
          color,
        }}
      >
        {value}
      </span>
      <span
        style={{
          fontSize: "20px",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: LABEL,
          marginTop: "12px",
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
        <div
          style={{
            width: "100%",
            height: "6px",
            display: "flex",
            background: "linear-gradient(to right, #2563eb, #7c3aed, #0891b2)",
          }}
        />

        {/* TOP: logo (L) + tokens/wk + cost/wk (R) */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "28px 56px 0 56px",
          }}
        >
          {/* Product wordmark: colored '>' prompt + mono path. No tagline. */}
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: "14px",
              fontFamily: "JetBrains Mono, monospace",
              fontWeight: 700,
              fontSize: "68px",
              lineHeight: 1,
            }}
          >
            <span style={{ color: "#2563eb" }}>&gt;</span>
            <span style={{ color: "#0f172a" }}>/insight-harness</span>
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
                fontSize: "64px",
                lineHeight: 1,
                color: "#2563eb",
              }}
            >
              {DEMO.tokensPerWeek}
            </span>
            <span
              style={{
                fontSize: "22px",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: LABEL,
                marginTop: "8px",
              }}
            >
              tokens / wk
            </span>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-end",
                marginTop: "10px",
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
                {DEMO.costPerWeek}
              </span>
              <span
                style={{
                  fontSize: "19px",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color: LABEL,
                  marginTop: "5px",
                }}
              >
                api cost / wk
              </span>
            </div>
          </div>
        </div>

        {/* HERO */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "8px 56px 0 56px",
          }}
        >
          <span
            style={{
              fontSize: "110px",
              fontWeight: 800,
              lineHeight: 1,
              letterSpacing: "-0.02em",
              backgroundImage:
                "linear-gradient(135deg, #2563eb 0%, #7c3aed 50%, #0891b2 100%)",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            See how they build.
          </span>
        </div>

        {/* STATS */}
        <div
          style={{
            display: "flex",
            gap: "16px",
            padding: "10px 56px 10px 56px",
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
              padding: "16px 14px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: "12px",
                fontFamily: "JetBrains Mono, monospace",
                fontWeight: 700,
                fontSize: "36px",
                lineHeight: 1,
              }}
            >
              <span style={{ color: "#16a34a" }}>{DEMO.linesAdded}</span>
              <span style={{ color: "#dc2626" }}>{DEMO.linesRemoved}</span>
            </div>
            <span
              style={{
                fontSize: "16px",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: LABEL,
                marginTop: "10px",
              }}
            >
              lines of code
            </span>
          </div>
        </div>

        {/* HEATMAPS */}
        <div
          style={{
            display: "flex",
            gap: "40px",
            padding: "0 56px 40px 56px",
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span
              style={{
                fontSize: "20px",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: LABEL,
                marginBottom: "10px",
              }}
            >
              Tokens · 4w
            </span>
            <HeatmapStrip levels={TOKEN_LEVELS} palette={AMBER_PALETTE} />
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span
              style={{
                fontSize: "20px",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: LABEL,
                marginBottom: "10px",
              }}
            >
              API cost · 4w
            </span>
            <HeatmapStrip levels={COST_LEVELS} palette={GREEN_PALETTE} />
          </div>
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
