"use client";

import { cn, scoreColor } from "@/lib/utils";

interface ScoreGaugeProps {
  score: number;
  size?: "sm" | "md" | "lg";
  label?: string;
  showValue?: boolean;
}

const sizes = {
  sm: { box: 80, stroke: 6, font: "text-base" },
  md: { box: 120, stroke: 8, font: "text-2xl" },
  lg: { box: 180, stroke: 10, font: "text-4xl" },
};

export function ScoreGauge({ score, size = "md", label, showValue = true }: ScoreGaugeProps) {
  const config = sizes[size];
  const radius = (config.box - config.stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, score));
  const offset = circumference - (clamped / 100) * circumference;
  const color = scoreColor(score);

  return (
    <div
      className="relative inline-flex flex-col items-center justify-center"
      style={{ width: config.box, height: config.box }}
    >
      <svg
        width={config.box}
        height={config.box}
        viewBox={`0 0 ${config.box} ${config.box}`}
        className="-rotate-90"
      >
        <circle
          cx={config.box / 2}
          cy={config.box / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={config.stroke}
          className="text-ink-100"
        />
        <circle
          cx={config.box / 2}
          cy={config.box / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={config.stroke}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.8s ease-in-out" }}
        />
      </svg>
      {showValue && (
        <div className="absolute flex flex-col items-center">
          <span className={cn("font-bold tabular-nums", config.font)} style={{ color }}>
            {clamped}
          </span>
          {label && <span className="text-[10px] uppercase tracking-wide text-ink-400">{label}</span>}
        </div>
      )}
    </div>
  );
}
