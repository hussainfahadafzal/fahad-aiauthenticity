import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import {
  DEFAULT_AUDIO_MODEL,
  DEFAULT_IMAGE_MODEL,
  describeModel,
  syntheticProbability,
} from "./models";
import type { ModelInference, ModelLabelScore, ModelStatus } from "./types";

const DEFAULT_ENDPOINT = "https://router.huggingface.co/hf-inference/models";
const LEGACY_ENDPOINT = "https://api-inference.huggingface.co/models";
/** Base64 payload cap (~8 MB of base64 ≈ 6 MB of bytes). */
const MAX_BASE64 = 8 * 1024 * 1024;

const inferenceSchema = z.object({
  modality: z.enum(["image", "audio"]),
  modelName: z.string().min(1).max(200),
  contentType: z.string().max(200).default("application/octet-stream"),
  /** Raw file bytes, base64 encoded. */
  base64: z.string().min(1),
  endpoint: z.string().max(300).optional(),
});

function token(): string | null {
  return process.env["HUGGINGFACE_API_KEY"] ?? process.env["HF_TOKEN"] ?? null;
}

function base(endpoint?: string): string {
  const e = (endpoint ?? "").trim();
  return e.length > 0 ? e.replace(/\/+$/, "") : DEFAULT_ENDPOINT;
}

function result(
  modality: "image" | "audio",
  modelName: string,
  status: ModelStatus,
  extra: Partial<ModelInference> = {},
): ModelInference {
  return {
    ...describeModel(modality, modelName),
    modality,
    status,
    modelVersion: null,
    prediction: null,
    probability: null,
    labels: [],
    error: null,
    latencyMs: null,
    ...extra,
  };
}

function decode(base64: string): Uint8Array {
  const clean = base64.includes(",") ? (base64.split(",").pop() as string) : base64;
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function parseLabels(payload: unknown): ModelLabelScore[] {
  const flat = Array.isArray(payload) && Array.isArray(payload[0]) ? payload[0] : payload;
  if (!Array.isArray(flat)) return [];
  return flat
    .filter(
      (item): item is { label: string; score: number } =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as { label?: unknown }).label === "string" &&
        typeof (item as { score?: unknown }).score === "number",
    )
    .map((item) => ({ label: item.label, score: item.score }))
    .sort((a, b) => b.score - a.score);
}

async function fetchRevision(modelName: string, auth: string): Promise<string | null> {
  try {
    const res = await fetch(`https://huggingface.co/api/models/${modelName}`, {
      headers: { Authorization: auth },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { sha?: string };
    return typeof json.sha === "string" ? json.sha.slice(0, 12) : null;
  } catch {
    return null;
  }
}

/**
 * Calls a public pretrained classifier with the real file bytes.
 *
 * Every failure path returns an explicit NOT_CONFIGURED / UNAVAILABLE / ERROR
 * status with `probability: null`. No prediction is ever synthesised locally.
 */
export const runModelInference = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => inferenceSchema.parse(data))
  .handler(async ({ data }): Promise<ModelInference> => {
    const modelName =
      data.modelName || (data.modality === "image" ? DEFAULT_IMAGE_MODEL : DEFAULT_AUDIO_MODEL);
    const key = token();

    if (!key) {
      return result(data.modality, modelName, "NOT_CONFIGURED", {
        error:
          "No inference API token is configured (HUGGINGFACE_API_KEY / HF_TOKEN). Local signal analysis only.",
      });
    }
    if (data.base64.length > MAX_BASE64) {
      return result(data.modality, modelName, "ERROR", {
        error: "File is too large to send to the hosted inference API (limit ~6 MB).",
      });
    }

    let bytes: Uint8Array;
    try {
      bytes = decode(data.base64);
    } catch {
      return result(data.modality, modelName, "ERROR", { error: "Could not decode the upload." });
    }

    const auth = `Bearer ${key}`;
    const started = Date.now();
    const urls = [`${base(data.endpoint)}/${modelName}`];
    if (!data.endpoint) urls.push(`${LEGACY_ENDPOINT}/${modelName}`);

    let lastStatus: ModelStatus = "UNAVAILABLE";
    let lastError = "The inference endpoint did not return a usable response.";

    for (const url of urls) {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: auth,
            "Content-Type": data.contentType || "application/octet-stream",
            Accept: "application/json",
          },
          body: bytes as unknown as BodyInit,
        });

        if (!res.ok) {
          const body = (await res.text()).slice(0, 300);
          if (res.status === 503) {
            lastStatus = "UNAVAILABLE";
            lastError = `Model is loading on the inference provider (503). ${body}`;
          } else if (res.status === 401 || res.status === 403) {
            lastStatus = "ERROR";
            lastError = `Inference token rejected (${res.status}).`;
          } else if (res.status === 404) {
            lastStatus = "UNAVAILABLE";
            lastError = `Model or endpoint not found (404) for ${modelName}.`;
          } else {
            lastStatus = "ERROR";
            lastError = `Inference request failed (${res.status}). ${body}`;
          }
          continue;
        }

        const labels = parseLabels(await res.json());
        if (labels.length === 0) {
          return result(data.modality, modelName, "ERROR", {
            error: "The endpoint returned no classification labels.",
            latencyMs: Date.now() - started,
          });
        }
        const probability = syntheticProbability(labels);
        if (probability === null) {
          return result(data.modality, modelName, "ERROR", {
            error: `Model labels (${labels.map((l) => l.label).join(", ")}) could not be mapped to a synthetic-content probability.`,
            labels,
            prediction: labels[0]?.label ?? null,
            latencyMs: Date.now() - started,
          });
        }
        return result(data.modality, modelName, "AVAILABLE", {
          labels,
          prediction: labels[0]?.label ?? null,
          probability,
          modelVersion: await fetchRevision(modelName, auth),
          latencyMs: Date.now() - started,
        });
      } catch (error) {
        lastStatus = "UNAVAILABLE";
        lastError = error instanceof Error ? error.message : "Network error reaching the endpoint.";
      }
    }

    return result(data.modality, modelName, lastStatus, {
      error: lastError,
      latencyMs: Date.now() - started,
    });
  });

const statusSchema = z.object({
  imageModel: z.string().min(1).max(200),
  audioModel: z.string().min(1).max(200),
  endpoint: z.string().max(300).optional(),
});

export interface ModelAvailability {
  tokenConfigured: boolean;
  endpoint: string;
  models: { modality: "image" | "audio"; modelName: string; ok: boolean; detail: string }[];
}

/** Settings helper: verifies the token is present and that each repo resolves. */
export const checkModelAvailability = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => statusSchema.parse(data))
  .handler(async ({ data }): Promise<ModelAvailability> => {
    const key = token();
    const endpoint = base(data.endpoint);
    const entries: { modality: "image" | "audio"; modelName: string }[] = [
      { modality: "image", modelName: data.imageModel },
      { modality: "audio", modelName: data.audioModel },
    ];

    if (!key) {
      return {
        tokenConfigured: false,
        endpoint,
        models: entries.map((e) => ({
          ...e,
          ok: false,
          detail: "No inference token configured on the server.",
        })),
      };
    }

    const models = await Promise.all(
      entries.map(async (e) => {
        try {
          const res = await fetch(`https://huggingface.co/api/models/${e.modelName}`, {
            headers: { Authorization: `Bearer ${key}` },
          });
          if (!res.ok) {
            return { ...e, ok: false, detail: `Repository lookup failed (${res.status}).` };
          }
          const json = (await res.json()) as { pipeline_tag?: string; sha?: string };
          return {
            ...e,
            ok: true,
            detail: `Repository reachable · task ${json.pipeline_tag ?? "unknown"} · revision ${
              json.sha?.slice(0, 12) ?? "unknown"
            }`,
          };
        } catch (error) {
          return {
            ...e,
            ok: false,
            detail: error instanceof Error ? error.message : "Lookup failed.",
          };
        }
      }),
    );

    return { tokenConfigured: true, endpoint, models };
  });
