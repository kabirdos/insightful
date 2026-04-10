"use client";

import type { HarnessData } from "@/types/insights";
import AutonomyGauge from "./AutonomyGauge";
import ModelDonutChart from "./ModelDonutChart";
import FileOpStyleBar from "./FileOpStyleBar";

interface HowIWorkClusterProps {
  harnessData: HarnessData;
}

export default function HowIWorkCluster({ harnessData }: HowIWorkClusterProps) {
  const { autonomy, models, fileOpStyle } = harnessData;
  const hasAutonomy = !!autonomy.label;
  const hasModels = Object.keys(models).length > 0;
  const hasFileOps = !!fileOpStyle.style;

  if (!hasAutonomy && !hasModels && !hasFileOps) return null;

  return (
    <div className="mb-6 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900/50">
      <h3 className="mb-4 text-[15px] font-bold text-slate-900 dark:text-slate-100">
        How I Work
      </h3>
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(260px,1.15fr)]">
        {hasAutonomy && (
          <div className="flex items-center justify-center">
            <AutonomyGauge autonomy={autonomy} />
          </div>
        )}
        {hasModels && (
          <div className="flex items-center justify-center">
            <ModelDonutChart models={models} size={140} />
          </div>
        )}
        {hasFileOps && (
          <div className="flex items-center">
            <FileOpStyleBar fileOpStyle={fileOpStyle} />
          </div>
        )}
      </div>
    </div>
  );
}
