import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { FlaskConical } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { listAnalyses } from "@/lib/store";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — AuthenticityAI" },
      {
        name: "description",
        content: "Aggregate statistics computed from your stored AuthenticityAI analyses.",
      },
      { property: "og:title", content: "Dashboard — AuthenticityAI" },
      { property: "og:description", content: "Risk distribution, modality mix and score trend from real stored analyses." },
    ],
  }),
  component: Dashboard,
});

const RISK_FILL: Record<string, string> = {
  Low: "var(--risk-low)",
  Moderate: "var(--risk-moderate)",
  High: "var(--risk-high)",
  "Very High": "var(--risk-critical)",
};

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="panel p-4">
      <p className="text-xs uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-2 font-mono text-2xl font-semibold tabular-nums">{value}</p>
      {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function Dashboard() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["analyses"],
    queryFn: listAnalyses,
  });

  const rows = data ?? [];
  const total = rows.length;
  const avgScore = total === 0 ? 0 : Math.round(rows.reduce((a, r) => a + r.finalScore, 0) / total);
  const avgConfidence =
    total === 0 ? 0 : Math.round(rows.reduce((a, r) => a + r.confidence, 0) / total);
  const highRisk = rows.filter((r) => r.riskLevel === "High" || r.riskLevel === "Very High").length;
  const mlAssisted = rows.filter(
    (r) => isModelUsable(r.imageModel) || isModelUsable(r.audioModel),
  ).length;
  const fallback = total - mlAssisted;

  const riskData = ["Low", "Moderate", "High", "Very High"]
    .map((level) => ({ name: level, value: rows.filter((r) => r.riskLevel === level).length }))
    .filter((d) => d.value > 0);

  const modalityData = ["image", "audio", "text", "multimodal"]
    .map((m) => ({ name: m, count: rows.filter((r) => r.mediaType === m).length }))
    .filter((d) => d.count > 0);

  const trend = [...rows]
    .reverse()
    .map((r, i) => ({ index: i + 1, score: r.finalScore, confidence: r.confidence }));

  return (
    <AppShell>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every figure below is computed from stored analyses. Nothing is seeded.
          </p>
        </div>
        <Button asChild>
          <Link to="/analyze">New analysis</Link>
        </Button>
      </div>

      {error && (
        <p className="mt-6 rounded-md border border-destructive bg-surface p-4 text-sm text-destructive">
          Could not load stored analyses: {(error as Error).message}
        </p>
      )}

      {isLoading && <p className="mt-8 text-sm text-muted-foreground">Loading analyses…</p>}

      {!isLoading && total === 0 && (
        <div className="panel mt-8 flex flex-col items-center gap-3 px-6 py-16 text-center">
          <FlaskConical className="size-8 text-primary" aria-hidden />
          <h2 className="text-lg font-semibold">No analyses yet</h2>
          <p className="max-w-md text-sm text-muted-foreground">
            Run your first analysis to populate the dashboard. Statistics appear only once real
            results exist.
          </p>
          <Button asChild className="mt-2">
            <Link to="/analyze">Run an analysis</Link>
          </Button>
        </div>
      )}

      {total > 0 && (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="Total analyses" value={String(total)} />
            <Stat label="Mean risk score" value={`${avgScore}/100`} />
            <Stat label="Mean confidence" value={`${avgConfidence}%`} />
            <Stat
              label="High / very high"
              value={String(highRisk)}
              sub={`${Math.round((highRisk / total) * 100)}% of all analyses`}
            />
          </div>

          <div className="mt-6 grid gap-4 xl:grid-cols-2">
            <section className="panel p-4">
              <h2 className="text-sm font-semibold">Risk level distribution</h2>
              <div className="mt-4 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={riskData} dataKey="value" nameKey="name" outerRadius={90} label>
                      {riskData.map((d) => (
                        <Cell key={d.name} fill={RISK_FILL[d.name]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: "var(--surface-raised)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        color: "var(--foreground)",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="panel p-4">
              <h2 className="text-sm font-semibold">Analyses per modality</h2>
              <div className="mt-4 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={modalityData}>
                    <CartesianGrid stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={12} />
                    <YAxis allowDecimals={false} stroke="var(--muted-foreground)" fontSize={12} />
                    <Tooltip
                      contentStyle={{
                        background: "var(--surface-raised)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                      }}
                    />
                    <Bar dataKey="count" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
          </div>

          <section className="panel mt-4 p-4">
            <h2 className="text-sm font-semibold">Risk score and confidence over time</h2>
            <div className="mt-4 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trend}>
                  <CartesianGrid stroke="var(--border)" />
                  <XAxis dataKey="index" stroke="var(--muted-foreground)" fontSize={12} />
                  <YAxis domain={[0, 100]} stroke="var(--muted-foreground)" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--surface-raised)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                    }}
                  />
                  <Line type="monotone" dataKey="score" stroke="var(--chart-1)" strokeWidth={2} dot={false} />
                  <Line
                    type="monotone"
                    dataKey="confidence"
                    stroke="var(--chart-2)"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>
        </>
      )}
    </AppShell>
  );
}
