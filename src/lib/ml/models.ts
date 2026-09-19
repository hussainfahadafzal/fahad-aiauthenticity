import type { ModelDescriptor, ModelLabelScore } from "./types";

/**
 * Public pretrained models used for inference. Nothing here is trained by this
 * project; each entry documents the upstream repository and its training data
 * provenance so the report can cite it.
 */
export const IMAGE_MODELS: Record<string, ModelDescriptor> = {
  "Organika/sdxl-detector": {
    modelName: "Organika/sdxl-detector",
    architecture: "Swin Transformer (image classification head, 2 classes)",
    sourceRepo: "https://huggingface.co/Organika/sdxl-detector",
    trainingData:
      "Fine-tuned by the upstream author on human-made artwork/photography versus SDXL-generated images (upstream card does not publish a full dataset manifest).",
    task: "image-classification",
  },
  "umm-maybe/AI-image-detector": {
    modelName: "umm-maybe/AI-image-detector",
    architecture: "Swin Transformer base (binary image classifier)",
    sourceRepo: "https://huggingface.co/umm-maybe/AI-image-detector",
    trainingData:
      "Upstream author's collection of human artwork versus images from diffusion/GAN generators; not a benchmark-calibrated dataset.",
    task: "image-classification",
  },
};

export const AUDIO_MODELS: Record<string, ModelDescriptor> = {
  "MelodyMachine/Deepfake-audio-detection-V2": {
    modelName: "MelodyMachine/Deepfake-audio-detection-V2",
    architecture: "wav2vec2 encoder with an audio-classification head (2 classes)",
    sourceRepo: "https://huggingface.co/MelodyMachine/Deepfake-audio-detection-V2",
    trainingData:
      "Fine-tuned upstream on bona-fide versus synthesised/converted speech collections; upstream card does not publish a full dataset manifest.",
    task: "audio-classification",
  },
  "motheecreator/Deepfake-audio-detection": {
    modelName: "motheecreator/Deepfake-audio-detection",
    architecture: "wav2vec2 encoder with an audio-classification head",
    sourceRepo: "https://huggingface.co/motheecreator/Deepfake-audio-detection",
    trainingData: "Fine-tuned upstream on real versus deepfake speech samples.",
    task: "audio-classification",
  },
};

export const DEFAULT_IMAGE_MODEL = "Organika/sdxl-detector";
export const DEFAULT_AUDIO_MODEL = "MelodyMachine/Deepfake-audio-detection-V2";

export function describeModel(
  modality: "image" | "audio",
  modelName: string,
): ModelDescriptor {
  const registry = modality === "image" ? IMAGE_MODELS : AUDIO_MODELS;
  return (
    registry[modelName] ?? {
      modelName,
      architecture: "Reported by the upstream repository",
      sourceRepo: `https://huggingface.co/${modelName}`,
      trainingData:
        "Custom endpoint configured in Settings — consult the upstream model card for dataset provenance.",
      task: modality === "image" ? "image-classification" : "audio-classification",
    }
  );
}

const SYNTHETIC = /(fake|artificial|ai|spoof|synthetic|generated|deepfake|machine|clone)/i;
const AUTHENTIC = /(real|human|genuine|bona[\s-]?fide|authentic|natural|original)/i;

/**
 * Maps a model's own label set onto a synthetic-content probability.
 * Returns null when the labels cannot be interpreted — we never guess.
 */
export function syntheticProbability(labels: ModelLabelScore[]): number | null {
  if (labels.length === 0) return null;
  const synthetic = labels.find((l) => SYNTHETIC.test(l.label));
  if (synthetic) return synthetic.score;
  const authentic = labels.find((l) => AUTHENTIC.test(l.label));
  if (authentic) return 1 - authentic.score;
  return null;
}
