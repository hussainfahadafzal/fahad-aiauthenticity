export type MediaType = "image" | "audio" | "text" | "multimodal";
export type Modality = "image" | "audio" | "text";
export type Severity = "info" | "low" | "moderate" | "high";
export type RiskLevel = "Low" | "Moderate" | "High" | "Very High";

export interface EvidenceItem {
  id: string;
  modality: Modality;
  category: string;
  name: string;
  measured: string;
  description: string;
  severity: Severity;
  /** Confidence in this individual signal, 0-100. Derived from data quality. */
  confidence: number;
  /** Points this signal adds to the modality risk score. */
  contribution: number;
}

export interface Quality {
  /** 0-1: how much of the expected feature set could be measured. */
  completeness: number;
  /** 0-1: whether the input is large/long enough for the metrics to be stable. */
  validity: number;
  notes: string[];
}

export interface ModalityAnalysis {
  modality: Modality;
  features: Record<string, unknown>;
  evidence: EvidenceItem[];
  quality: Quality;
}

export interface ScoreContribution {
  label: string;
  value: number;
  modality: Modality;
}

export interface AnalysisResult {
  analysisId: string;
  mediaType: MediaType;
  filename: string | null;
  imageScore: number | null;
  audioScore: number | null;
  textScore: number | null;
  finalScore: number;
  confidence: number;
  riskLevel: RiskLevel;
  features: Record<string, unknown>;
  evidence: EvidenceItem[];
  scoreContributions: ScoreContribution[];
  explanation: string | null;
  limitations: string;
  analyzerVersion: string;
  scoringVersion: string;
  processingTime: number;
}

export const ANALYZER_VERSION = "1.0.0";
export const SCORING_VERSION = "1.0.0";

export const DISCLAIMER =
  "AuthenticityAI provides an analytical risk assessment based on measurable content signals. Results are not definitive forensic proof.";
