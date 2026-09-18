import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Download, Printer } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { AudioVisualizer } from "@/components/AudioVisualizer";
import { EvidenceCard } from "@/components/EvidenceCard";
import { ScoreDial, riskTextClass } from "@/components/ScoreDial";
import { Button } from "@/components/ui/button";
import { DISCLAIMER } from "@/lib/analysis/types";
import { getAnalysis } from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/results/$id")({
  head: () => ({
    meta: [
      { title: "Analysis report — AuthenticityAI" },
      {
        name: "description",
        content: "Full authenticity risk report with measured features, evidence and score contributions.",
      },
      { property: "og:title", content: "Analysis report — AuthenticityAI" },
      { property: "og:description", content: "Explainable risk score with every measured signal listed." },
    ],
  }),
  component: ResultsPage,
});

function FeatureTable({ title, features }: { title: string; features: Record<string, unknown> }) {
  const entries = Object.entries(features).filter(
    ([, v]) => typeof v === "number" || typeof v === "string" || typeof v === "boolean",
  );
  if (entries.length === 0) return null;
  return (
    <section className="panel p-4">
      <h3 className="text-sm font-semibold capitalize">{title} features</h3>
      <dl className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
        {entries.map(([k, v]) => (
          <div key={k} className="flex items-baseline justify-between gap-3 border-b border-border/60 py-1">
            <dt className="text-xs text-muted-foreground">{k}</dt>
            <dd className="font-mono text-xs">{String(v)}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function ResultsPage() {
  const { id } = useParams({ from: "/results/$id" });
  const { data, isLoading, error } = useQuery({
    queryKey: ["analysis", id],
    queryFn: () => getAnalysis(id),
  });

  if (isLoading) {
    return (
      <AppShell>
        <p className="text-sm text-muted-foreground">Loading report…</p>
      </AppShell>
    );
  }

  if (error || !data) {
    return (
      <AppShell>
        <div className="panel p-8 text-center">
          <h1 className="text-lg font-semibold">Report not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            No stored analysis matches this identifier.
          </p>
          <Button asChild className="mt-4">
            <Link to="/history">Back to history</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  const audioFeatures = (data.features as Record<string, Record<string, unknown>>)["audio"];
  const waveform = (audioFeatures?.["waveform"] as number[] | undefined) ?? [];
  const spectrum = (audioFeatures?.["spectrum"] as number[] | undefined) ?? [];
  const spectrumMaxHz = (audioFeatures?.["spectrumMaxHz"] as number | undefined) ?? 0;

  const report = data;

  function exportJson() {
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${report.analysisId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const modalityScores = [
    { label: "Image", value: data.imageScore },
    { label: "Audio", value: data.audioScore },
    { label: "Text", value: data.textScore },
  ].filter((m) => m.value !== null);

  return (
    <AppShell>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-xs text-evidence">{data.analysisId}</p>
          <h1 className="mt-1 text-2xl font-semibold">Authenticity risk report</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {data.mediaType} · {data.filename ?? "no file"} ·{" "}
            {new Date(data.createdAt).toLocaleString()} · {data.processingTime} ms
          </p>
        </div>
        <div className="flex gap-2 no-print">
          <Button variant="outline" onClick={exportJson}>
            <Download className="mr-2 size-4" aria-hidden />
            Export JSON
          </Button>
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="mr-2 size-4" aria-hidden />
            Print
          </Button>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <section className="panel flex flex-col items-center justify-center p-6">
          <ScoreDial score={data.finalScore} level={data.riskLevel} />
          <p className={cn("mt-4 text-sm font-medium", riskTextClass(data.riskLevel))}>
            {data.riskLevel} risk
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Analysis confidence {data.confidence}%</p>
        </section>

        <section className="panel p-5 lg:col-span-2">
          <h2 className="text-sm font-semibold">Score breakdown</h2>
          <div className="mt-4 space-y-3">
            {modalityScores.map((m) => (
              <div key={m.label}>
                <div className="flex items-center justify-between text-xs">
                  <span>{m.label} signal group</span>
                  <span className="font-mono">{m.value}/100</span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-border">
                  <div
                    className="h-2 rounded-full bg-primary"
                    style={{ width: `${m.value ?? 0}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          <dl className="mt-5 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
            <div>
              <dt className="text-muted-foreground">Signals measured</dt>
              <dd className="font-mono">{data.evidence.length}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Signals flagged</dt>
              <dd className="font-mono">{data.scoreContributions.length}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Analyzer</dt>
              <dd className="font-mono">v{data.analyzerVersion}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Scoring</dt>
              <dd className="font-mono">v{data.scoringVersion}</dd>
            </div>
          </dl>
        </section>
      </div>

      {data.explanation && (
        <section className="panel mt-4 p-5">
          <h2 className="text-sm font-semibold">Explanation</h2>
          <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
            {data.explanation}
          </p>
        </section>
      )}

      {data.scoreContributions.length > 0 && (
        <section className="panel mt-4 p-5">
          <h2 className="text-sm font-semibold">Risk point contributions</h2>
          <div className="mt-4 h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.scoreContributions} layout="vertical" margin={{ left: 40 }}>
                <CartesianGrid stroke="var(--border)" horizontal={false} />
                <XAxis type="number" stroke="var(--muted-foreground)" fontSize={12} />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={180}
                  stroke="var(--muted-foreground)"
                  fontSize={11}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--surface-raised)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                  }}
                />
                <Bar dataKey="value" fill="var(--chart-2)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {waveform.length > 0 && (
        <div className="mt-4">
          <AudioVisualizer waveform={waveform} spectrum={spectrum} maxHz={spectrumMaxHz} />
        </div>
      )}

      <section className="mt-6">
        <h2 className="text-lg font-semibold">Evidence ({data.evidence.length} signals)</h2>
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          {data.evidence.map((item) => (
            <EvidenceCard key={`${item.modality}-${item.id}`} item={item} />
          ))}
        </div>
      </section>

      <div className="mt-6 space-y-4">
        {Object.entries(data.features)
          .filter(([, v]) => v && typeof v === "object")
          .map(([key, value]) => (
            <FeatureTable key={key} title={key} features={value as Record<string, unknown>} />
          ))}
      </div>

      <section className="panel mt-6 p-5">
        <h2 className="text-sm font-semibold">Limitations</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{data.limitations}</p>
        <p className="mt-4 border-t border-border pt-4 text-xs text-muted-foreground">{DISCLAIMER}</p>
      </section>
    </AppShell>
  );
}
