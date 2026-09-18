import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Download, Printer } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { riskTextClass } from "@/components/ScoreDial";
import { Button } from "@/components/ui/button";
import { DISCLAIMER } from "@/lib/analysis/types";
import { listAnalyses } from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [
      { title: "Reports — AuthenticityAI" },
      {
        name: "description",
        content: "Printable summary of every stored authenticity analysis, with a full JSON export.",
      },
      { property: "og:title", content: "Reports — AuthenticityAI" },
      { property: "og:description", content: "Printable and exportable summary of all stored analyses." },
    ],
  }),
  component: ReportsPage,
});

function ReportsPage() {
  const { data, isLoading } = useQuery({ queryKey: ["analyses"], queryFn: listAnalyses });
  const rows = data ?? [];

  function exportAll() {
    const blob = new Blob(
      [JSON.stringify({ exportedAt: new Date().toISOString(), analyses: rows }, null, 2)],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `authenticityai-reports-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <AppShell>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Reports</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Consolidated view for submission and demonstration.
          </p>
        </div>
        <div className="flex gap-2 no-print">
          <Button variant="outline" disabled={rows.length === 0} onClick={exportAll}>
            <Download className="mr-2 size-4" aria-hidden />
            Export all JSON
          </Button>
          <Button variant="outline" disabled={rows.length === 0} onClick={() => window.print()}>
            <Printer className="mr-2 size-4" aria-hidden />
            Print summary
          </Button>
        </div>
      </div>

      {isLoading && <p className="mt-8 text-sm text-muted-foreground">Loading…</p>}

      {!isLoading && rows.length === 0 && (
        <div className="panel mt-8 px-6 py-14 text-center">
          <h2 className="text-lg font-semibold">No reports yet</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Reports are generated from real analyses. Run one to see it here.
          </p>
          <Button asChild className="mt-4">
            <Link to="/analyze">Run an analysis</Link>
          </Button>
        </div>
      )}

      {rows.length > 0 && (
        <div className="mt-6 space-y-4">
          {rows.map((r) => (
            <article key={r.analysisId} className="panel p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-xs text-evidence">{r.analysisId}</p>
                  <h2 className="mt-1 text-base font-semibold capitalize">
                    {r.mediaType} · {r.filename ?? "text input"}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {new Date(r.createdAt).toLocaleString()} · analyzer v{r.analyzerVersion} · scoring v
                    {r.scoringVersion}
                  </p>
                </div>
                <div className="text-right">
                  <p className={cn("font-mono text-xl font-semibold", riskTextClass(r.riskLevel))}>
                    {r.finalScore}/100
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {r.riskLevel} · confidence {r.confidence}%
                  </p>
                </div>
              </div>
              <p className="mt-3 line-clamp-3 text-sm text-muted-foreground">{r.explanation}</p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                {r.scoreContributions.slice(0, 5).map((c) => (
                  <span
                    key={c.label}
                    className="rounded-full border border-border bg-surface-raised px-2 py-1"
                  >
                    {c.label} +{c.value}
                  </span>
                ))}
              </div>
              <Button asChild variant="link" className="mt-2 px-0 no-print">
                <Link to="/results/$id" params={{ id: r.analysisId }}>
                  Open full report
                </Link>
              </Button>
            </article>
          ))}
          <p className="text-xs text-muted-foreground">{DISCLAIMER}</p>
        </div>
      )}
    </AppShell>
  );
}
