import type { RiskLevel } from "@/lib/analysis/types";
import { cn } from "@/lib/utils";

const STROKE: Record<RiskLevel, string> = {
  Low: "stroke-risk-low",
  Moderate: "stroke-risk-moderate",
  High: "stroke-risk-high",
  "Very High": "stroke-risk-critical",
};

const TEXT: Record<RiskLevel, string> = {
  Low: "text-risk-low",
  Moderate: "text-risk-moderate",
  High: "text-risk-high",
  "Very High": "text-risk-critical",
};

export function riskTextClass(level: RiskLevel) {
  return TEXT[level];
}

export function ScoreDial({
  score,
  level,
  size = 176,
  label = "Risk score",
}: {
  score: number;
  level: RiskLevel;
  size?: number;
  label?: string;
}) {
  const radius = size / 2 - 12;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.min(100, Math.max(0, score)) / 100);

  return (
    <div
      className="relative inline-flex items-center justify-center"
      role="img"
      aria-label={`${label}: ${score} out of 100, ${level} risk`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={10}
          className="stroke-border"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={10}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={cn("transition-[stroke-dashoffset] duration-700", STROKE[level])}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="font-mono text-3xl font-semibold tabular-nums">{score}</span>
        <span className="text-[11px] uppercase tracking-widest text-muted-foreground">/ 100</span>
        <span className={cn("mt-1 text-xs font-medium", TEXT[level])}>{level}</span>
      </div>
    </div>
  );
}
