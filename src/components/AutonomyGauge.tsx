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

  const ratio =
    autonomy.userMessages > 0 && autonomy.assistantMessages > 0
      ? `1:${Math.round(autonomy.assistantMessages / autonomy.userMessages)}`
      : null;

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
      <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        {autonomy.description}
      </div>
      <div className="mt-2 text-[11px] text-slate-400 dark:text-slate-500">
        {ratio && <span>{ratio} human-to-Claude ratio</span>}
        {ratio && autonomy.errorRate && autonomy.errorRate !== "0%" && (
          <span> · </span>
        )}
        {autonomy.errorRate && autonomy.errorRate !== "0%" && (
          <span>{autonomy.errorRate} error rate</span>
        )}
      </div>
    </div>
  );
}
