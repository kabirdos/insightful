import type { ChartDataPoint } from "@/types/insights";

interface ToolUsageChartProps {
  data: ChartDataPoint[];
  max?: number;
}

export default function ToolUsageChart({ data, max = 6 }: ToolUsageChartProps) {
  if (!data || data.length === 0) return null;

  const topItems = data.slice(0, max);
  const maxValue = Math.max(...topItems.map((d) => d.value));

  return (
    <div className="space-y-1.5">
      {topItems.map((item) => {
        const pct = maxValue > 0 ? (item.value / maxValue) * 100 : 0;
        return (
          <div key={item.label} className="flex items-center gap-2">
            <div className="w-20 shrink-0 text-xs text-slate-600 dark:text-slate-400">
              {item.label}
            </div>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className="h-full rounded-full bg-blue-500"
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="w-14 shrink-0 text-right text-xs font-medium text-slate-500 dark:text-slate-400">
              {item.value.toLocaleString()}
            </div>
          </div>
        );
      })}
    </div>
  );
}
