import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/AppShell";
import { ANALYZER_VERSION, DISCLAIMER, SCORING_VERSION } from "@/lib/analysis/types";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About — AuthenticityAI" },
      {
        name: "description",
        content: "Scope, ethics, technology stack and future work for the AuthenticityAI academic project.",
      },
      { property: "og:title", content: "About — AuthenticityAI" },
      { property: "og:description", content: "Project scope, honest limitations and future extensions." },
    ],
  }),
  component: AboutPage,
});

const STACK = [
  ["Interface", "React 19, TypeScript, Vite, Tailwind CSS, shadcn/ui, Recharts, Lucide"],
  ["Image analysis", "Canvas 2D pixel access, Sobel/Laplacian operators, histogram entropy, EXIF byte scan"],
  ["Audio analysis", "Web Audio AudioContext decoding, Hann windowing, radix-2 FFT, spectral descriptors"],
  ["Text analysis", "Tokenisation, stylometry, n-gram repetition, punctuation and register statistics"],
  ["Model inference", `Server-side calls to public pretrained classifiers (${DEFAULT_SETTINGS.imageModel} for images, ${DEFAULT_SETTINGS.audioModel} for audio)`],
  ["Persistence", "Managed PostgreSQL through the project backend, one row per analysis with full JSON evidence and model status"],
  ["Optional AI", "Server-side narrative synthesis constrained to the measured values"],
];

function AboutPage() {
  return (
    <AppShell>
      <div className="max-w-3xl">
        <h1 className="text-2xl font-semibold">About AuthenticityAI</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          AuthenticityAI is an academic and portfolio project that demonstrates an explainable
          approach to content-authenticity assessment. Instead of claiming a verdict, it measures
          signals that can be computed, shows every measurement, and explains what those
          measurements can and cannot support.
        </p>

        <section className="mt-8">
          <h2 className="text-lg font-semibold">Technology</h2>
          <dl className="mt-3 space-y-2">
            {STACK.map(([k, v]) => (
              <div key={k} className="panel p-4">
                <dt className="text-sm font-semibold">{k}</dt>
                <dd className="mt-1 text-sm text-muted-foreground">{v}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="mt-8">
          <h2 className="text-lg font-semibold">Ethics and honest scope</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
            <li>No trained deepfake classifier is used, and none is claimed.</li>
            <li>No accuracy figure is reported, because no labelled evaluation is performed.</li>
            <li>Results must never be used as forensic proof or to accuse a person.</li>
            <li>Every score can be traced back to the exact measurement that produced it.</li>
          </ul>
        </section>

        <section className="mt-8">
          <h2 className="text-lg font-semibold">Future work</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
            <li>Video analysis with frame sampling and temporal consistency checks.</li>
            <li>Calibration of thresholds against a labelled public dataset.</li>
            <li>Server-side batch processing and comparative report generation.</li>
            <li>C2PA / content-credential verification when provenance metadata is present.</li>
          </ul>
        </section>

        <p className="mt-8 rounded-md border border-border bg-surface p-4 text-xs text-muted-foreground">
          {DISCLAIMER} Analyzer v{ANALYZER_VERSION} · Scoring v{SCORING_VERSION}
        </p>
      </div>
    </AppShell>
  );
}
