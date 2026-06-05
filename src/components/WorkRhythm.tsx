"use client";

import type { HarnessConcurrency, HarnessTemporal } from "@/types/insights";

interface WorkRhythmProps {
  concurrency?: HarnessConcurrency | null;
  temporal?: HarnessTemporal | null;
}

function formatHour(h: number): string {
  const hr = ((Math.round(h) % 24) + 24) % 24;
  if (hr === 0) return "12am";
  if (hr === 12) return "12pm";
  return hr < 12 ? `${hr}am` : `${hr - 12}pm`;
}

/**
 * Surfaces two verified "how I work" rhythm signals the harness now ships:
 * session concurrency ("runs N in parallel") and a when-I-work temporal
 * characterization with a 24-hour activity histogram. Renders nothing when
 * neither signal has data, so older reports are unaffected.
 */
export default function WorkRhythm({ concurrency, temporal }: WorkRhythmProps) {
  const hasConcurrency =
    !!concurrency &&
    Number.isFinite(concurrency.maxConcurrent) &&
    concurrency.maxConcurrent > 0;
  // Data is cast from unknown JSON, so guard peakHour is a real number before
  // formatting it (a partial object could otherwise render "peaks NaNpm").
  const hasTemporal =
    !!temporal && !!temporal.label && Number.isFinite(temporal.peakHour);
  if (!hasConcurrency && !hasTemporal) return null;

  const hourCounts =
    temporal && typeof temporal.hourCounts === "object" && temporal.hourCounts
      ? temporal.hourCounts
      : {};
  const hours = Array.from({ length: 24 }, (_, h) => ({
    h,
    count: hourCounts[String(h)] ?? 0,
  }));
  const maxHour = Math.max(1, ...hours.map((x) => x.count));

  return (
    <div className="mb-6 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900/50">
      <h3 className="mb-4 text-[15px] font-bold text-slate-900 dark:text-slate-100">
        Work Rhythm
      </h3>
      <div className="grid gap-6 md:grid-cols-2">
        {hasConcurrency && (
          <div className="flex flex-col justify-center">
            <div className="text-[11px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">
              Parallel sessions
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl dark:text-slate-50">
                {concurrency!.maxConcurrent}
              </span>
              <span className="text-sm text-slate-500 dark:text-slate-400">
                peak at once
              </span>
            </div>
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              ~{concurrency!.medianConcurrent} typically running together ·{" "}
              {concurrency!.sessionsCounted} sessions
            </div>
          </div>
        )}

        {hasTemporal && (
          <div className="flex flex-col justify-center">
            <div className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
              When I work
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-xl font-extrabold text-slate-900 dark:text-slate-50">
                {temporal!.label}
              </span>
              <span className="text-sm text-slate-500 dark:text-slate-400">
                peaks {formatHour(temporal!.peakHour)}
              </span>
            </div>
            <div
              className="mt-3 flex h-12 items-end gap-[2px]"
              role="img"
              aria-label="Activity by hour of day"
            >
              {hours.map(({ h, count }) => (
                <div
                  key={h}
                  title={`${formatHour(h)}: ${count}`}
                  className={`flex-1 rounded-sm ${
                    h === temporal!.peakHour
                      ? "bg-amber-500"
                      : "bg-amber-200 dark:bg-amber-900/50"
                  }`}
                  style={{ height: `${Math.max(6, (count / maxHour) * 100)}%` }}
                />
              ))}
            </div>
            <div className="mt-1 flex justify-between text-[10px] text-slate-400">
              <span>12am</span>
              <span>12pm</span>
              <span>11pm</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
