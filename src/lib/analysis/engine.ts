import { loadSettings, type EngineSettings } from "./config";
import { analyzeAudio } from "./audio";
import { analyzeImage } from "./image";
import { analyzeText } from "./text";
import { buildResult } from "./scoring";
import type { AnalysisResult, MediaType, ModalityAnalysis } from "./types";
import { runModelInference } from "@/lib/ml/inference.functions";
import { describeModel } from "@/lib/ml/models";
import type { ModelInference } from "@/lib/ml/types";

export interface AnalysisInput {
  image?: File | undefined;
  audio?: File | undefined;
  text?: string | undefined;
}

function fingerprintOf(input: AnalysisInput, mediaType: MediaType): string {
  const parts: string[] = [mediaType];
  if (input.image) parts.push(`img:${input.image.name}:${input.image.size}:${input.image.lastModified}`);
  if (input.audio) parts.push(`aud:${input.audio.name}:${input.audio.size}:${input.audio.lastModified}`);
  if (input.text) parts.push(`txt:${input.text.length}:${input.text.slice(0, 512)}`);
  return parts.join("|");
}

async function toBase64(file: File): Promise<string> {
  const buffer = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < buffer.length; i += chunk) {
    binary += String.fromCharCode(...buffer.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function localFailure(
  modality: "image" | "audio",
  modelName: string,
  error: string,
): ModelInference {
  return {
    ...describeModel(modality, modelName),
    modality,
    status: "UNAVAILABLE",
    modelVersion: null,
    prediction: null,
    probability: null,
    labels: [],
    error,
    latencyMs: null,
  };
}

/**
 * Requests a prediction from the configured pretrained classifier.
 * Any failure returns an explicit status — never a fabricated probability.
 */
async function infer(
  modality: "image" | "audio",
  file: File,
  settings: EngineSettings,
): Promise<ModelInference> {
  const modelName = modality === "image" ? settings.imageModel : settings.audioModel;
  try {
    return await runModelInference({
      data: {
        modality,
        modelName,
        contentType: file.type || "application/octet-stream",
        base64: await toBase64(file),
        ...(settings.inferenceEndpoint ? { endpoint: settings.inferenceEndpoint } : {}),
      },
    });
  } catch (error) {
    return localFailure(
      modality,
      modelName,
      error instanceof Error ? error.message : "Inference request failed.",
    );
  }
}

/**
 * Runs the deterministic analyzers for every supplied modality, and — when enabled —
 * pretrained-model inference for image and audio. Local feature extraction is
 * deterministic: same input -> same features -> same feature score.
 */
export async function runAnalysis(
  input: AnalysisInput,
  mediaType: MediaType,
  settingsOverride?: EngineSettings,
): Promise<AnalysisResult> {
  const settings = settingsOverride ?? loadSettings();
  const started = typeof performance !== "undefined" ? performance.now() : Date.now();
  const analyses: ModalityAnalysis[] = [];

  const inferencePromises: Promise<ModelInference>[] = [];
  if (settings.mlEnabled && input.image) inferencePromises.push(infer("image", input.image, settings));
  if (settings.mlEnabled && input.audio) inferencePromises.push(infer("audio", input.audio, settings));

  if (input.image) analyses.push(await analyzeImage(input.image));
  if (input.audio) analyses.push(await analyzeAudio(input.audio));
  if (input.text && input.text.trim().length > 0) analyses.push(analyzeText(input.text));

  if (analyses.length === 0) throw new Error("No input was supplied to analyse");

  const inferences = await Promise.all(inferencePromises);

  const ended = typeof performance !== "undefined" ? performance.now() : Date.now();
  const filename =
    input.image?.name ?? input.audio?.name ?? (input.text ? "text-input.txt" : null);

  return buildResult({
    mediaType,
    filename,
    analyses,
    settings,
    processingTime: ended - started,
    fingerprint: fingerprintOf(input, mediaType),
    inferences,
  });
}
