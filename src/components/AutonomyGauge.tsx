"use client";

import { useId } from "react";
import type { HarnessAutonomy } from "@/types/insights";

interface AutonomyGaugeProps {
  autonomy: HarnessAutonomy;
}

// Map autonomy labels to approximate fill percentages
function labelToFill(label: string): number {
  const lower = label.toLowerCase();
  if (lower.includes("architect") || lower.includes("autonomous")) return 0.78;
  if (lower.includes("collaborat")) return 0.55;
  if (lower.includes("delegat")) return 0.7;
  if (lower.includes("direct")) return 0.35;
  if (lower.includes("supervis")) return 0.45;
  if (lower.includes("guided")) return 0.3;
  return 0.5;
}

export default function AutonomyGauge({ autonomy }: AutonomyGaugeProps) {
  const gradientId = useId();
  if (!autonomy.label) return null;

  const fillPct = labelToFill(autonomy.label);
  // Semicircle arc: from (15,85) to (145,85), radius 65
  const arcLength = Math.PI * 65; // ~204
  const dashOffset = arcLength * (1 - fillPct);

  const hasMessages =
    autonomy.userMessages > 0 && autonomy.assistantMessages > 0;
  const perUserMsg = hasMessages
    ? Math.round(autonomy.assistantMessages / autonomy.userMessages)
    : null;

  // Proportion bar widths
  const total = hasMessages
    ? autonomy.userMessages + autonomy.assistantMessages
    : 0;
  const userPct = total > 0 ? (autonomy.userMessages / total) * 100 : 0;

  return (
    <div className="text-center">
      <svg width="160" height="90" viewBox="0 0 160 90" className="mx-auto">
        {/* Background arc */}
        <path
          d="M 15 85 A 65 65 0 0 1 145 85"
          fill="none"
          className="stroke-slate-200 dark:stroke-slate-700"
          strokeWidth="12"
          strokeLinecap="round"
        />
        {/* Fill arc */}
        <path
          d="M 15 85 A 65 65 0 0 1 145 85"
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={arcLength.toString()}
          strokeDashoffset={dashOffset.toString()}
        />
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#93c5fd" />
            <stop offset="50%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#1d4ed8" />
          </linearGradient>
        </defs>
      </svg>
      <div className="mt-2 text-2xl font-extrabold text-slate-900 dark:text-slate-100">
        {autonomy.label}
      </div>
      {perUserMsg && perUserMsg > 1 && (
        <div className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
          For every message you send, Claude sends ~{perUserMsg} back
        </div>
      )}
      {hasMessages && (
        <div className="mx-auto mt-2 max-w-[140px]">
          <div className="flex h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className="rounded-l-full bg-slate-400 dark:bg-slate-500"
              style={{ width: `${userPct}%` }}
            />
            <div
              className="rounded-r-full bg-blue-500"
              style={{ width: `${100 - userPct}%` }}
            />
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-slate-400 dark:text-slate-500">
            <span>You {autonomy.userMessages.toLocaleString()}</span>
            <span>Claude {autonomy.assistantMessages.toLocaleString()}</span>
          </div>
        </div>
      )}
      {autonomy.errorRate && autonomy.errorRate !== "0%" && (
        <div className="mt-1.5 text-[11px] text-slate-400 dark:text-slate-500">
          {autonomy.errorRate} error rate
        </div>
      )}
    </div>
  );
}
