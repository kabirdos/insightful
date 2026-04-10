"use client";

interface MiniBarChartProps {
  data: Array<{ label: string; value: number }>;
  color?: string;
  title: string;
}

export default function MiniBarChart({
  data,
  color = "bg-blue-500",
  title,
}: MiniBarChartProps) {
  if (!data || data.length === 0) return null;

  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <div>
      {title ? (
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
          {title}
        </h4>
      ) : null}
      <div className="space-y-1">
        {data.slice(0, 8).map((item) => (
          <div key={item.label} className="flex items-center gap-2">
            <span className="w-20 truncate text-xs text-slate-600 dark:text-slate-400">
              {item.label}
            </span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className={`h-full rounded-full ${color}`}
                style={{ width: `${Math.max(3, (item.value / max) * 100)}%` }}
              />
            </div>
            <span className="w-10 text-right text-xs text-slate-400">
              {item.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
