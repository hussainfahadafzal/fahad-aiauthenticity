import { supabase } from "@/integrations/supabase/client";
import type { AnalysisResult, EvidenceItem, MediaType, Modality, RiskLevel, ScoreContribution } from "./analysis/types";
import type { FusionDetail, ModelInference } from "./ml/types";

export interface StoredAnalysis extends AnalysisResult {
  createdAt: string;
  status: string;
}

type Row = {
  analysis_id: string;
  media_type: string;
  filename: string | null;
  status: string;
  image_score: number | null;
  audio_score: number | null;
  text_score: number | null;
  final_score: number;
  confidence: number;
  risk_level: string;
  features: unknown;
  evidence: unknown;
  score_contributions: unknown;
  explanation: string | null;
  limitations: string | null;
  analyzer_version: string;
  scoring_version: string;
  processing_time: number | null;
  created_at: string;
  image_model_name?: string | null;
  image_model_version?: string | null;
  image_prediction?: string | null;
  image_ai_probability?: number | null;
  image_model_status?: string | null;
  audio_model_name?: string | null;
  audio_model_version?: string | null;
  audio_prediction?: string | null;
  audio_spoof_probability?: number | null;
  audio_model_status?: string | null;
  model_errors?: unknown;
  image_model_meta?: unknown;
  audio_model_meta?: unknown;
};

function toStored(row: Row): StoredAnalysis {
  const features = (row.features ?? {}) as Record<string, unknown>;
  return {
    analysisId: row.analysis_id,
    mediaType: row.media_type as MediaType,
    filename: row.filename,
    status: row.status,
    imageScore: row.image_score === null ? null : Number(row.image_score),
    audioScore: row.audio_score === null ? null : Number(row.audio_score),
    textScore: row.text_score === null ? null : Number(row.text_score),
    finalScore: Number(row.final_score),
    confidence: Number(row.confidence),
    riskLevel: row.risk_level as RiskLevel,
    features,
    evidence: (row.evidence ?? []) as EvidenceItem[],
    scoreContributions: (row.score_contributions ?? []) as ScoreContribution[],
    explanation: row.explanation,
    limitations: row.limitations ?? "",
    analyzerVersion: row.analyzer_version,
    scoringVersion: row.scoring_version,
    processingTime: row.processing_time === null ? 0 : Number(row.processing_time),
    createdAt: row.created_at,
    imageModel: (row.image_model_meta ?? null) as ModelInference | null,
    audioModel: (row.audio_model_meta ?? null) as ModelInference | null,
    fusion: (features["fusion"] ?? {}) as Partial<Record<Modality, FusionDetail>>,
    modelErrors: (row.model_errors ?? []) as string[],
  };
}

export async function saveAnalysis(result: AnalysisResult): Promise<StoredAnalysis> {
  const { data, error } = await supabase
    .from("analyses")
    .insert({
      analysis_id: `${result.analysisId}-${Date.now().toString(36)}`,
      media_type: result.mediaType,
      filename: result.filename,
      status: "completed",
      image_score: result.imageScore,
      audio_score: result.audioScore,
      text_score: result.textScore,
      final_score: result.finalScore,
      confidence: result.confidence,
      risk_level: result.riskLevel,
      features: result.features as never,
      evidence: result.evidence as never,
      score_contributions: result.scoreContributions as never,
      explanation: result.explanation,
      limitations: result.limitations,
      analyzer_version: result.analyzerVersion,
      scoring_version: result.scoringVersion,
      processing_time: result.processingTime,
      image_model_name: result.imageModel?.modelName ?? null,
      image_model_version: result.imageModel?.modelVersion ?? null,
      image_prediction: result.imageModel?.prediction ?? null,
      image_ai_probability: result.imageModel?.probability ?? null,
      image_model_status: result.imageModel?.status ?? null,
      audio_model_name: result.audioModel?.modelName ?? null,
      audio_model_version: result.audioModel?.modelVersion ?? null,
      audio_prediction: result.audioModel?.prediction ?? null,
      audio_spoof_probability: result.audioModel?.probability ?? null,
      audio_model_status: result.audioModel?.status ?? null,
      model_errors: result.modelErrors as never,
      image_model_meta: (result.imageModel ?? null) as never,
      audio_model_meta: (result.audioModel ?? null) as never,
    })
    .select()
    .single();
  if (error) throw error;
  return toStored(data as unknown as Row);
}

export async function listAnalyses(): Promise<StoredAnalysis[]> {
  const { data, error } = await supabase
    .from("analyses")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw error;
  return (data as unknown as Row[]).map(toStored);
}

export async function getAnalysis(analysisId: string): Promise<StoredAnalysis | null> {
  const { data, error } = await supabase
    .from("analyses")
    .select("*")
    .eq("analysis_id", analysisId)
    .maybeSingle();
  if (error) throw error;
  return data ? toStored(data as unknown as Row) : null;
}

export async function deleteAnalysis(analysisId: string): Promise<void> {
  const { error } = await supabase.from("analyses").delete().eq("analysis_id", analysisId);
  if (error) throw error;
}
