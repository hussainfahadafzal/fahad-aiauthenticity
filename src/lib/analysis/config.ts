export interface EngineSettings {
  weights: { image: number; audio: number; text: number };
  thresholds: { low: number; moderate: number; high: number };
  aiExplanation: boolean;
}

export const DEFAULT_SETTINGS: EngineSettings = {
  weights: { image: 0.4, audio: 0.4, text: 0.2 },
  thresholds: { low: 30, moderate: 60, high: 80 },
  aiExplanation: true,
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
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: EngineSettings) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(settings));
}
