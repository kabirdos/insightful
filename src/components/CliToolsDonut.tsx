"use client";

interface CliToolsDonutProps {
  cliTools: Record<string, number>;
}

const COMMON_TOOLS = new Set([
  "git",
  "npm",
  "npx",
  "node",
  "python3",
  "python",
  "pip",
  "yarn",
  "pnpm",
  "bun",
  "cargo",
  "go",
  "ruby",
  "gem",
  "bundle",
  "tsc",
  "tsx",
]);

const UNCOMMON_COLORS = [
  "#1d4ed8",
  "#3b82f6",
  "#60a5fa",
  "#93c5fd",
  "#bfdbfe",
  "#818cf8",
  "#a78bfa",
];

export default function CliToolsDonut({ cliTools }: CliToolsDonutProps) {
  const entries = Object.entries(cliTools).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return null;

  const total = entries.reduce((sum, [, v]) => sum + v, 0);
  const uncommon = entries.filter(([name]) => !COMMON_TOOLS.has(name));
  const common = entries.filter(([name]) => COMMON_TOOLS.has(name));
  const commonTotal = common.reduce((sum, [, v]) => sum + v, 0);

  // Build segments: common as one grey segment, then uncommon individually
  const segments: { name: string; value: number; color: string }[] = [];
  if (commonTotal > 0) {
    segments.push({ name: "Common", value: commonTotal, color: "#cbd5e1" });
  }
  uncommon.forEach(([name, value], i) => {
    segments.push({
      name,
      value,
      color: UNCOMMON_COLORS[i % UNCOMMON_COLORS.length],
    });
  });

  const size = 180;
  const cx = size / 2;
  const cy = size / 2;
  const radius = 65;
  const strokeWidth = 24;
  const circumference = 2 * Math.PI * radius;

  // Precompute segment offsets so we don't mutate during render
  const segmentsWithOffsets = segments.reduce<
    {
      name: string;
      value: number;
      color: string;
      pct: number;
      offset: number;
    }[]
  >((acc, seg) => {
    const pct = seg.value / total;
    const prevOffset =
      acc.length > 0 ? acc[acc.length - 1].offset + acc[acc.length - 1].pct : 0;
    acc.push({ ...seg, pct, offset: prevOffset });
    return acc;
  }, []);

  return (
    <div className="mb-6 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900/50">
      <h3 className="mb-4 text-[15px] font-bold text-slate-900 dark:text-slate-100">
        CLI Tools
      </h3>
      <div className="flex flex-wrap items-center gap-8">
        {/* Donut */}
        <div className="shrink-0">
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            {segmentsWithOffsets.map((seg) => {
              const dashLength = seg.pct * circumference;
              const dashOffset = -seg.offset * circumference;
              return (
                <circle
                  key={seg.name}
                  cx={cx}
                  cy={cy}
                  r={radius}
                  fill="none"
                  stroke={seg.color}
                  strokeWidth={strokeWidth}
                  strokeDasharray={`${dashLength} ${circumference - dashLength}`}
                  strokeDashoffset={dashOffset}
                  transform={`rotate(-90 ${cx} ${cy})`}
                />
              );
            })}
            <text
              x={cx}
              y={cy - 8}
              textAnchor="middle"
              className="fill-slate-900 dark:fill-slate-100"
              fontSize="14"
              fontWeight="800"
            >
              {total}
            </text>
            <text
              x={cx}
              y={cy + 6}
              textAnchor="middle"
              className="fill-slate-500"
              fontSize="11"
            >
              CLI calls
            </text>
          </svg>
        </div>

        {/* Legend */}
        <div className="min-w-[200px] flex-1">
          {/* Uncommon tools */}
          {uncommon.length > 0 && (
            <>
              <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Uncommon (stand-out tools)
              </div>
              <div className="mb-4 flex flex-col gap-1.5">
                {uncommon.map(([name, value], i) => {
                  const pct = Math.round((value / total) * 100);
                  return (
                    <div key={name} className="flex items-center gap-2">
                      <div
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{
                          backgroundColor:
                            UNCOMMON_COLORS[i % UNCOMMON_COLORS.length],
                        }}
                      />
                      <span className="text-[13px] font-semibold text-slate-900 dark:text-slate-100">
                        {name}
                      </span>
                      <span className="ml-auto text-xs text-slate-500 dark:text-slate-400">
                        {value} calls · {pct}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* Common tools */}
          {common.length > 0 && (
            <>
              <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Common (expected)
              </div>
              <div className="flex flex-wrap gap-3">
                {common.map(([name, value]) => (
                  <div key={name} className="flex items-center gap-1">
                    <div className="h-2 w-2 rounded-full bg-slate-300 dark:bg-slate-600" />
                    <span className="text-xs text-slate-400 dark:text-slate-500">
                      {name} {value}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
