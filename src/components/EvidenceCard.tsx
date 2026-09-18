import { AlertTriangle, CircleCheck, Info, TriangleAlert } from "lucide-react";

import type { EvidenceItem } from "@/lib/analysis/types";
import { cn } from "@/lib/utils";

const SEVERITY = {
  info: { label: "Normal", cls: "text-muted-foreground", Icon: CircleCheck },
  low: { label: "Low", cls: "text-risk-low", Icon: Info },
  moderate: { label: "Moderate", cls: "text-risk-moderate", Icon: TriangleAlert },
  high: { label: "High", cls: "text-risk-critical", Icon: AlertTriangle },
} as const;

export function EvidenceCard({ item }: { item: EvidenceItem }) {
  const meta = SEVERITY[item.severity];
  const { Icon } = meta;
  return (
    <article className="panel p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-widest text-evidence">
            {item.modality} · {item.category}
          </p>
          <h3 className="mt-1 text-sm font-semibold">{item.name}</h3>
        </div>
        <span className={cn("flex shrink-0 items-center gap-1 text-xs font-medium", meta.cls)}>
          <Icon className="size-4" aria-hidden />
          {meta.label}
        </span>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-3 text-xs sm:grid-cols-3">
        <div>
          <dt className="text-muted-foreground">Measured</dt>
          <dd className="font-mono text-foreground">{item.measured}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Signal confidence</dt>
          <dd className="font-mono text-foreground">{item.confidence}%</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Score contribution</dt>
          <dd className="font-mono text-foreground">
            {item.contribution > 0 ? `+${item.contribution}` : "0"} pts
          </dd>
        </div>
      </dl>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{item.description}</p>
    </article>
  );
}
