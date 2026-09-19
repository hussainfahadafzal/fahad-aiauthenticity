import { ExternalLink } from "lucide-react";

import { ModelStatusBadge } from "@/components/ModelStatusBadge";
import type { FusionDetail, ModelInference } from "@/lib/ml/types";
import { ML_UNAVAILABLE_NOTICE, isModelUsable } from "@/lib/ml/types";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-border/60 py-1.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="max-w-[70%] text-right font-mono text-xs">{value}</dd>
    </div>
  );
}

export function ModelInfoCard({
  inference,
  fusion,
}: {
  inference: ModelInference;
  fusion?: FusionDetail | undefined;
}) {
  const usable = isModelUsable(inference);
  const probabilityLabel =
    inference.modality === "image" ? "AI-generated probability" : "Spoof probability";

  return (
    <section className="panel p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold capitalize">{inference.modality} model</h3>
          <p className="mt-1 font-mono text-xs text-evidence">{inference.modelName}</p>
        </div>
        <ModelStatusBadge status={inference.status} />
      </div>

      <dl className="mt-4">
        <Row label="Architecture" value={inference.architecture} />
        <Row label="Task" value={inference.task} />
        <Row label="Revision" value={inference.modelVersion ?? "not reported"} />
        <Row label="Prediction" value={inference.prediction ?? "none — no inference"} />
        <Row
          label={probabilityLabel}
          value={usable ? `${Math.round((inference.probability ?? 0) * 100)}%` : "not available"}
        />
        {inference.latencyMs !== null && (
          <Row label="Inference latency" value={`${inference.latencyMs} ms`} />
        )}
      </dl>

      {inference.labels.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {inference.labels.map((l) => (
            <span
              key={l.label}
              className="rounded-md border border-border bg-surface px-2 py-1 font-mono text-[11px]"
            >
              {l.label} {(l.score * 100).toFixed(1)}%
            </span>
          ))}
        </div>
      )}

      {fusion && (
        <div className="mt-4 rounded-md border border-border bg-surface p-3 text-xs">
          <p className="font-semibold">Modality fusion</p>
          <p className="mt-1 font-mono text-muted-foreground">
            {fusion.mlScore === null
              ? `risk = forensic signals ${fusion.featureScore}/100 × 100%`
              : `risk = forensic ${fusion.featureScore} × ${Math.round((1 - fusion.mlWeight) * 100)}% + model ${fusion.mlScore} × ${Math.round(fusion.mlWeight * 100)}% = ${fusion.fusedScore}/100`}
          </p>
        </div>
      )}

      <p className="mt-3 text-xs text-muted-foreground">
        Training data: {inference.trainingData}
      </p>
      <a
        className="mt-2 inline-flex items-center gap-1 text-xs text-primary underline"
        href={inference.sourceRepo}
        target="_blank"
        rel="noreferrer noopener"
      >
        Source repository <ExternalLink className="size-3" aria-hidden />
      </a>

      {!usable && (
        <p className="mt-3 rounded-md border border-risk-high/40 bg-surface p-3 text-xs text-risk-high">
          {ML_UNAVAILABLE_NOTICE}
          {inference.error ? ` (${inference.error})` : ""}
        </p>
      )}
    </section>
  );
}
