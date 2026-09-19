import { cn } from "@/lib/utils";
import type { ModelStatus } from "@/lib/ml/types";
import { statusLabel } from "@/lib/ml/types";

const DOT: Record<string, string> = {
  AVAILABLE: "bg-risk-low",
  NOT_CONFIGURED: "bg-risk-moderate",
  UNAVAILABLE: "bg-risk-high",
  ERROR: "bg-risk-critical",
};

export function ModelStatusBadge({
  status,
  className,
}: {
  status: ModelStatus | null | undefined;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-xs", className)}>
      <span
        aria-hidden
        className={cn("size-2 rounded-full", status ? DOT[status] : "bg-muted-foreground")}
      />
      <span>{statusLabel(status)}</span>
    </span>
  );
}
