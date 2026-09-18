import type { EngineSettings } from "./config";
import type {
  AnalysisResult,
  EvidenceItem,
  ModalityAnalysis,
  Modality,
  RiskLevel,
  ScoreContribution,
} from "./types";
import { ANALYZER_VERSION, DISCLAIMER, SCORING_VERSION } from "./types";
import { clamp, hashString, round } from "./util";

/** Modality risk score = clamped sum of the contributions of its evidence items. */
export function scoreFromEvidence(evidence: EvidenceItem[]): number {
  const total = evidence.reduce((acc, item) => acc + item.contribution, 0);
  return Math.round(clamp(total, 0, 100));
}

export function riskLevel(score: number, thresholds: EngineSettings["thresholds"]): RiskLevel {
  if (score <= thresholds.low) return "Low";
  if (score <= thresholds.moderate) return "Moderate";
  if (score <= thresholds.high) return "High";
  return "Very High";
}

/** Weighted combination with re-normalisation over the modalities actually supplied. */
export function combineScores(
  scores: Partial<Record<Modality, number>>,
  weights: EngineSettings["weights"],
): { finalScore: number; normalized: Record<string, number> } {
  const present = (Object.keys(scores) as Modality[]).filter((m) => scores[m] !== undefined);
  const weightSum = present.reduce((acc, m) => acc + weights[m], 0);
  const normalized: Record<string, number> = {};
  if (present.length === 0 || weightSum === 0) return { finalScore: 0, normalized };
  let final = 0;
  for (const m of present) {
    const w = weights[m] / weightSum;
    normalized[m] = round(w, 4);
    final += (scores[m] as number) * w;
  }
  return { finalScore: Math.round(final), normalized };
}

/**
 * Confidence is separate from risk: it measures how much the measurements can be
 * trusted (signal count, data completeness, feature validity), not how risky the
 * content looks.
 */
export function computeConfidence(analyses: ModalityAnalysis[]): number {
  if (analyses.length === 0) return 0;
  const signalCount = analyses.reduce((acc, a) => acc + a.evidence.length, 0);
  const expectedSignals = analyses.length * 9;
  const completeness =
    analyses.reduce((acc, a) => acc + a.quality.completeness, 0) / analyses.length;
  const validity = analyses.reduce((acc, a) => acc + a.quality.validity, 0) / analyses.length;
  const coverage = clamp(signalCount / expectedSignals, 0, 1);
  const itemConfidence =
    signalCount === 0
      ? 0
      : analyses.reduce(
          (acc, a) => acc + a.evidence.reduce((s, e) => s + e.confidence, 0),
          0,
        ) /
        signalCount /
        100;
  const raw = 0.3 * completeness + 0.3 * validity + 0.2 * coverage + 0.2 * itemConfidence;
  return Math.round(clamp(raw * 100, 0, 99));
}

function buildLimitations(analyses: ModalityAnalysis[]): string {
  const notes = analyses.flatMap((a) => a.quality.notes);
  const generic = [
    "The engine measures statistical signal patterns; it does not run a trained deepfake classifier.",
    "Heavy editing, recompression, or platform re-encoding can remove the traces this engine relies on.",
    "A high risk score means the measured signals are atypical, not that the content is proven synthetic.",
  ];
  return [...notes, ...generic].join(" ");
}

function deterministicExplanation(
  scores: Partial<Record<Modality, number>>,
  finalScore: number,
  level: RiskLevel,
  evidence: EvidenceItem[],
): string {
  const flagged = evidence
    .filter((e) => e.contribution > 0)
    .sort((a, b) => b.contribution - a.contribution)
    .slice(0, 4);
  const parts = (Object.keys(scores) as Modality[]).map(
    (m) => `${m} ${scores[m]}/100`,
  );
  const head = `Combined risk score ${finalScore}/100 (${level}) from ${parts.join(", ")}.`;
  if (flagged.length === 0) {
    return `${head} No measured signal exceeded its risk threshold, so every extracted feature fell inside the expected range for authentic content.`;
  }
  const body = flagged
    .map((e) => `${e.name} measured ${e.measured} (+${e.contribution} points)`)
    .join("; ");
  return `${head} The score is driven by: ${body}. ${DISCLAIMER}`;
}

export function buildResult(params: {
  mediaType: AnalysisResult["mediaType"];
  filename: string | null;
  analyses: ModalityAnalysis[];
  settings: EngineSettings;
  processingTime: number;
  fingerprint: string;
}): AnalysisResult {
  const { analyses, settings } = params;
  const scores: Partial<Record<Modality, number>> = {};
  const features: Record<string, unknown> = {};
  const evidence: EvidenceItem[] = [];
  const contributions: ScoreContribution[] = [];

  for (const a of analyses) {
    scores[a.modality] = scoreFromEvidence(a.evidence);
    features[a.modality] = a.features;
    evidence.push(...a.evidence);
    for (const item of a.evidence) {
      if (item.contribution > 0) {
        contributions.push({
          label: item.name,
          value: item.contribution,
          modality: a.modality,
        });
      }
    }
  }

  const { finalScore, normalized } = combineScores(scores, settings.weights);
  features["weights"] = normalized;
  features["thresholds"] = settings.thresholds;

  const level = riskLevel(finalScore, settings.thresholds);

  return {
    analysisId: `AAI-${hashString(params.fingerprint)}`,
    mediaType: params.mediaType,
    filename: params.filename,
    imageScore: scores.image ?? null,
    audioScore: scores.audio ?? null,
    textScore: scores.text ?? null,
    finalScore,
    confidence: computeConfidence(analyses),
    riskLevel: level,
    features,
    evidence,
    scoreContributions: contributions.sort((a, b) => b.value - a.value),
    explanation: deterministicExplanation(scores, finalScore, level, evidence),
    limitations: buildLimitations(analyses),
    analyzerVersion: ANALYZER_VERSION,
    scoringVersion: SCORING_VERSION,
    processingTime: round(params.processingTime, 1),
  };
}

export const RISK_COLORS: Record<RiskLevel, string> = {
  Low: "text-risk-low",
  Moderate: "text-risk-moderate",
  High: "text-risk-high",
  "Very High": "text-risk-critical",
};
