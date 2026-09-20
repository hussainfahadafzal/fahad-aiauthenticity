import { loadSettings, type EngineSettings } from "./config";
import { analyzeAudio } from "./audio";
import { analyzeImage } from "./image";
import { analyzeText } from "./text";
import { buildResult } from "./scoring";
import type { AnalysisResult, MediaType, ModalityAnalysis } from "./types";

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

/**
 * Runs the deterministic analyzers for every supplied modality.
 * Same input -> same features -> same score. No randomness, no filename heuristics.
 */
export async function runAnalysis(
  input: AnalysisInput,
  mediaType: MediaType,
  settingsOverride?: EngineSettings,
): Promise<AnalysisResult> {
  const settings = settingsOverride ?? loadSettings();
  const started = typeof performance !== "undefined" ? performance.now() : Date.now();
  const analyses: ModalityAnalysis[] = [];

  if (input.image) analyses.push(await analyzeImage(input.image));
  if (input.audio) analyses.push(await analyzeAudio(input.audio));
  if (input.text && input.text.trim().length > 0) analyses.push(analyzeText(input.text));

  if (analyses.length === 0) throw new Error("No input was supplied to analyse");

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
  });
}
