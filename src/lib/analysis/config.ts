import { DEFAULT_AUDIO_MODEL, DEFAULT_IMAGE_MODEL } from "@/lib/ml/models";

export interface EngineSettings {
  weights: { image: number; audio: number; text: number };
  thresholds: { low: number; moderate: number; high: number };
  aiExplanation: boolean;
  /** Attempt pretrained-model inference alongside local feature extraction. */
  mlEnabled: boolean;
  /** Share of a modality score taken from the model probability when inference succeeds. */
  mlWeight: number;
  imageModel: string;
  audioModel: string;
  /** Optional custom inference endpoint base; empty means the default hosted API. */
  inferenceEndpoint: string;
}

export const DEFAULT_SETTINGS: EngineSettings = {
  weights: { image: 0.4, audio: 0.4, text: 0.2 },
  thresholds: { low: 30, moderate: 60, high: 80 },
  aiExplanation: true,
  mlEnabled: true,
  mlWeight: 0.5,
  imageModel: DEFAULT_IMAGE_MODEL,
  audioModel: DEFAULT_AUDIO_MODEL,
  inferenceEndpoint: "",
};

const KEY = "authenticityai.settings.v1";

export function loadSettings(): EngineSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<EngineSettings>;
    return {
      weights: { ...DEFAULT_SETTINGS.weights, ...(parsed.weights ?? {}) },
      thresholds: { ...DEFAULT_SETTINGS.thresholds, ...(parsed.thresholds ?? {}) },
      aiExplanation: parsed.aiExplanation ?? DEFAULT_SETTINGS.aiExplanation,
      mlEnabled: parsed.mlEnabled ?? DEFAULT_SETTINGS.mlEnabled,
      mlWeight: parsed.mlWeight ?? DEFAULT_SETTINGS.mlWeight,
      imageModel: parsed.imageModel ?? DEFAULT_SETTINGS.imageModel,
      audioModel: parsed.audioModel ?? DEFAULT_SETTINGS.audioModel,
      inferenceEndpoint: parsed.inferenceEndpoint ?? DEFAULT_SETTINGS.inferenceEndpoint,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: EngineSettings) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(settings));
}
