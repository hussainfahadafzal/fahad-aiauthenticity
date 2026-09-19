/**
 * Types for pretrained-model inference.
 *
 * The project does NOT train any model. It calls publicly available pretrained
 * classifiers through a hosted inference API. When that call cannot be made the
 * status is reported honestly and no prediction is ever invented.
 */
export type ModelStatus = "AVAILABLE" | "NOT_CONFIGURED" | "UNAVAILABLE" | "ERROR";

export interface ModelLabelScore {
  label: string;
  score: number;
}

export interface ModelDescriptor {
  /** Hugging Face repository id, e.g. "Organika/sdxl-detector". */
  modelName: string;
  architecture: string;
  sourceRepo: string;
  trainingData: string;
  task: string;
}

export interface ModelInference extends ModelDescriptor {
  modality: "image" | "audio";
  status: ModelStatus;
  /** Model revision/commit reported by the hub, when known. */
  modelVersion: string | null;
  /** Top label returned by the model, verbatim. */
  prediction: string | null;
  /** Probability that the content is AI-generated / spoofed, 0-1. */
  probability: number | null;
  labels: ModelLabelScore[];
  error: string | null;
  latencyMs: number | null;
}

export interface FusionDetail {
  featureScore: number;
  mlScore: number | null;
  mlWeight: number;
  fusedScore: number;
  mlStatus: ModelStatus | null;
}

export const ML_UNAVAILABLE_NOTICE =
  "ML model unavailable — using local signal analysis. Final risk calculated without ML model inference.";

export function isModelUsable(inference: ModelInference | null | undefined): boolean {
  return Boolean(
    inference && inference.status === "AVAILABLE" && typeof inference.probability === "number",
  );
}

export function statusLabel(status: ModelStatus | null | undefined): string {
  switch (status) {
    case "AVAILABLE":
      return "Available";
    case "NOT_CONFIGURED":
      return "Not configured — local analysis used";
    case "UNAVAILABLE":
      return "Unavailable — local analysis used";
    case "ERROR":
      return "Error — local analysis used";
    default:
      return "Not requested";
  }
}
