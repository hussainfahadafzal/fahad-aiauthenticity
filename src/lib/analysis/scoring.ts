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
import type { FusionDetail, ModelInference } from "@/lib/ml/types";
import { ML_UNAVAILABLE_NOTICE, isModelUsable } from "@/lib/ml/types";

/** Modality feature score = clamped sum of the contributions of its evidence items. */
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
 * Early fusion inside one modality: local forensic/acoustic feature score blended
 * with the pretrained model's synthetic-content probability.
 * When inference is not usable the feature score stands alone at 100% weight.
 */
export function fuseModality(
  featureScore: number,
  inference: ModelInference | null,
  mlWeight: number,
): FusionDetail {
  if (!isModelUsable(inference)) {
    return {
      featureScore,
      mlScore: null,
      mlWeight: 0,
      fusedScore: featureScore,
      mlStatus: inference ? inference.status : null,
    };
  }
  const w = clamp(mlWeight, 0, 1);
  const mlScore = Math.round((inference as ModelInference).probability! * 100);
  return {
    featureScore,
    mlScore,
    mlWeight: round(w, 2),
    fusedScore: Math.round(clamp(featureScore * (1 - w) + mlScore * w, 0, 100)),
    mlStatus: "AVAILABLE",
  };
}

/**
 * Confidence is separate from risk: it measures how much the measurements can be
 * trusted (signal count, data completeness, feature validity, and whether a
 * pretrained model could actually be consulted), not how risky the content looks.
 */
export function computeConfidence(
  analyses: ModalityAnalysis[],
  ml?: { usable: number; expected: number },
): number {
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
  const base = raw * 100;
  // Model evidence raises confidence; a model that was expected but unreachable lowers it.
  const usable = ml?.usable ?? 0;
  const missing = Math.max(0, (ml?.expected ?? 0) - usable);
  const adjusted = base + 5 * usable - 8 * missing;
  return Math.round(clamp(adjusted, 0, 99));
}

function buildLimitations(
  analyses: ModalityAnalysis[],
  inferences: ModelInference[],
  usedModality: Partial<Record<Modality, boolean>>,
): string {
  const notes = analyses.flatMap((a) => a.quality.notes);
  const modelNotes: string[] = [];
  const unusable = inferences.filter((i) => !isModelUsable(i));
  if (unusable.length > 0) {
    modelNotes.push(ML_UNAVAILABLE_NOTICE);
    for (const i of unusable) {
      modelNotes.push(`${i.modality} model ${i.modelName}: ${i.status}${i.error ? ` — ${i.error}` : ""}.`);
    }
  }
  for (const i of inferences.filter(isModelUsable)) {
    modelNotes.push(
      `${i.modality} risk includes a prediction from the pretrained model ${i.modelName}, which this project integrates but did not train; its accuracy on your content is unknown.`,
    );
  }
  if (analyses.some((a) => a.modality === "text")) {
    modelNotes.push(
      "Text risk is feature-based (stylometry) only — no text classifier is active, so it is not a model prediction.",
    );
  }
  if (usedModality.image === false) {
    modelNotes.push("Image risk was computed from forensic pixel signals alone.");
  }
  const generic = [
    "The engine measures statistical signal patterns and, when configured, consults publicly available pretrained classifiers; it trains no model of its own.",
    "Heavy editing, recompression, or platform re-encoding can remove the traces this engine relies on.",
    "A high risk score means the measured signals and model probabilities are atypical, not that the content is proven synthetic.",
  ];
  return [...notes, ...modelNotes, ...generic].join(" ");
}

function deterministicExplanation(
  scores: Partial<Record<Modality, number>>,
  finalScore: number,
  level: RiskLevel,
  evidence: EvidenceItem[],
  inferences: ModelInference[],
): string {
  const flagged = evidence
    .filter((e) => e.contribution > 0)
    .sort((a, b) => b.contribution - a.contribution)
    .slice(0, 4);
  const parts = (Object.keys(scores) as Modality[]).map((m) => `${m} ${scores[m]}/100`);
  const head = `Combined risk score ${finalScore}/100 (${level}) from ${parts.join(", ")}.`;

  const modelLine = inferences.length
    ? inferences
        .map((i) =>
          isModelUsable(i)
            ? `${i.modality} model ${i.modelName} predicted "${i.prediction}" with a ${Math.round((i.probability ?? 0) * 100)}% synthetic-content probability`
            : `${i.modality} model ${i.modelName} was ${i.status} (${ML_UNAVAILABLE_NOTICE})`,
        )
        .join("; ") + "."
    : "No pretrained model inference was requested, so the score is entirely feature-based.";

  const body =
    flagged.length === 0
      ? "No measured local signal exceeded its risk threshold, so every extracted feature fell inside the expected range for authentic content."
      : `Local signals driving the score: ${flagged
          .map((e) => `${e.name} measured ${e.measured} (+${e.contribution} points)`)
          .join("; ")}.`;

  return `${head} ${modelLine} ${body} ${DISCLAIMER}`;
}

export function buildResult(params: {
  mediaType: AnalysisResult["mediaType"];
  filename: string | null;
  analyses: ModalityAnalysis[];
  settings: EngineSettings;
  processingTime: number;
  fingerprint: string;
  inferences?: ModelInference[];
}): AnalysisResult {
  const { analyses, settings } = params;
  const inferences = params.inferences ?? [];
  const imageModel = inferences.find((i) => i.modality === "image") ?? null;
  const audioModel = inferences.find((i) => i.modality === "audio") ?? null;

  const scores: Partial<Record<Modality, number>> = {};
  const features: Record<string, unknown> = {};
  const evidence: EvidenceItem[] = [];
  const contributions: ScoreContribution[] = [];
  const fusion: Partial<Record<Modality, FusionDetail>> = {};
  const usedModality: Partial<Record<Modality, boolean>> = {};

  for (const a of analyses) {
    const featureScore = scoreFromEvidence(a.evidence);
    const inference =
      a.modality === "image" ? imageModel : a.modality === "audio" ? audioModel : null;
    const detail = fuseModality(featureScore, inference, settings.mlWeight);
    fusion[a.modality] = detail;
    usedModality[a.modality] = detail.mlScore !== null;
    scores[a.modality] = detail.fusedScore;
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
  features["fusion"] = fusion;

  const level = riskLevel(finalScore, settings.thresholds);
  const expectedMl = analyses.filter((a) => a.modality !== "text" && inferences.some((i) => i.modality === a.modality)).length;
  const usableMl = inferences.filter(isModelUsable).length;

  const modelErrors = inferences
    .filter((i) => !isModelUsable(i))
    .map((i) => `${i.modality}: ${i.status}${i.error ? ` — ${i.error}` : ""}`);

  return {
    analysisId: `AAI-${hashString(params.fingerprint)}`,
    mediaType: params.mediaType,
    filename: params.filename,
    imageScore: scores.image ?? null,
    audioScore: scores.audio ?? null,
    textScore: scores.text ?? null,
    finalScore,
    confidence: computeConfidence(analyses, { usable: usableMl, expected: expectedMl }),
    riskLevel: level,
    features,
    evidence,
    scoreContributions: contributions.sort((a, b) => b.value - a.value),
    explanation: deterministicExplanation(scores, finalScore, level, evidence, inferences),
    limitations: buildLimitations(analyses, inferences, usedModality),
    analyzerVersion: ANALYZER_VERSION,
    scoringVersion: SCORING_VERSION,
    processingTime: round(params.processingTime, 1),
    imageModel,
    audioModel,
    fusion,
    modelErrors,
  };
}

export const RISK_COLORS: Record<RiskLevel, string> = {
  Low: "text-risk-low",
  Moderate: "text-risk-moderate",
  High: "text-risk-high",
  "Very High": "text-risk-critical",
};
