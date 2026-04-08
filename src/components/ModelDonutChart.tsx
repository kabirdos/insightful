"use client";

interface ModelDonutChartProps {
  models: Record<string, number>;
  size?: number;
}

const MODEL_COLORS: Record<string, string> = {
  opus: "#7c3aed",
  sonnet: "#2563eb",
  haiku: "#06b6d4",
};

function getModelColor(name: string): string {
  const lower = name.toLowerCase();
  for (const [key, color] of Object.entries(MODEL_COLORS)) {
    if (lower.includes(key)) return color;
  }
  // Fallback colors for unknown models
  const fallbacks = ["#f59e0b", "#ef4444", "#10b981", "#8b5cf6", "#ec4899"];
  const hash = lower.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return fallbacks[hash % fallbacks.length];
}

export default function ModelDonutChart({
  models,
  size = 120,
}: ModelDonutChartProps) {
  const entries = Object.entries(models).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((sum, [, v]) => sum + v, 0);
  if (total === 0 || entries.length === 0) return null;

  const cx = size / 2;
  const cy = size / 2;
  const radius = size / 2 - 8;
  const strokeWidth = size * 0.18;
  const innerRadius = radius - strokeWidth / 2;
  const circumference = 2 * Math.PI * innerRadius;

  // Precompute segment offsets so we don't reassign during render
  const segments = entries.reduce<
    { name: string; value: number; pct: number; offset: number }[]
  >((acc, [name, value]) => {
    const pct = value / total;
    const prevOffset =
      acc.length > 0 ? acc[acc.length - 1].offset + acc[acc.length - 1].pct : 0;
    acc.push({ name, value, pct, offset: prevOffset });
    return acc;
  }, []);

  return (
    <div className="flex items-center gap-4">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {segments.map((seg) => {
          const dashLength = seg.pct * circumference;
          const dashOffset = -seg.offset * circumference;
          return (
            <circle
              key={seg.name}
              cx={cx}
              cy={cy}
              r={innerRadius}
              fill="none"
              stroke={getModelColor(seg.name)}
              strokeWidth={strokeWidth}
              strokeDasharray={`${dashLength} ${circumference - dashLength}`}
              strokeDashoffset={dashOffset}
              transform={`rotate(-90 ${cx} ${cy})`}
              className="transition-all duration-300"
            />
          );
        })}
        {/* Center text */}
        <text
          x={cx}
          y={cy - 4}
          textAnchor="middle"
          className="fill-slate-700 dark:fill-slate-300"
          fontSize="14"
          fontWeight="700"
        >
          {entries.length}
        </text>
        <text
          x={cx}
          y={cy + 10}
          textAnchor="middle"
          className="fill-slate-400"
          fontSize="9"
          fontWeight="500"
        >
          models
        </text>
      </svg>
      <div className="space-y-1.5">
        {entries.map(([name, value]) => {
          const pct = Math.round((value / total) * 100);
          return (
            <div key={name} className="flex items-center gap-2">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: getModelColor(name) }}
              />
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                {name}
              </span>
              <span className="text-xs text-slate-400">{pct}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
