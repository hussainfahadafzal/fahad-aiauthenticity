import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/AppShell";
import { DEFAULT_SETTINGS } from "@/lib/analysis/config";
import { DISCLAIMER } from "@/lib/analysis/types";

export const Route = createFileRoute("/methodology")({
  head: () => ({
    meta: [
      { title: "Methodology — AuthenticityAI" },
      {
        name: "description",
        content:
          "How AuthenticityAI extracts image, audio and text signals and converts them into a risk score and confidence value.",
      },
      { property: "og:title", content: "Methodology — AuthenticityAI" },
      {
        property: "og:description",
        content: "Signal extraction, evidence scoring, weight normalisation and confidence formulas explained.",
      },
    ],
  }),
  component: MethodologyPage,
});

const STAGES = [
  { n: 1, title: "Input", body: "File or text is received in the browser. No filename heuristics are used anywhere." },
  { n: 2, title: "Decode", body: "Canvas 2D for images, AudioContext.decodeAudioData for audio, tokenisation for text." },
  { n: 3, title: "Feature extraction", body: "Statistical descriptors: pixel/frequency statistics, FFT spectral measures, stylometry." },
  { n: 4, title: "Signal evaluation", body: "Each feature is compared with a documented threshold and becomes an evidence item." },
  { n: 5, title: "Scoring", body: "Evidence contributions are summed per modality, then fused with normalised weights." },
  { n: 6, title: "Confidence", body: "A separate value from data completeness, feature validity and signal coverage." },
  { n: 7, title: "Persistence", body: "The full report — features, evidence, contributions — is stored for review and export." },
];

function Formula({ title, expression, note }: { title: string; expression: string; note: string }) {
  return (
    <div className="panel p-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      <pre className="mt-3 overflow-x-auto rounded-md border border-border bg-surface-raised p-3 font-mono text-xs">
        {expression}
      </pre>
      <p className="mt-2 text-xs text-muted-foreground">{note}</p>
    </div>
  );
}

function MethodologyPage() {
  return (
    <AppShell>
      <h1 className="text-2xl font-semibold">Methodology</h1>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
        AuthenticityAI is a signal-measurement system, not a trained classifier. Every number in a
        report is derived from the content you submit, using the pipeline below.
      </p>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Analysis pipeline</h2>
        <ol className="mt-4 grid gap-3 lg:grid-cols-4">
          {STAGES.map((s) => (
            <li key={s.n} className="panel p-4">
              <span className="inline-flex size-7 items-center justify-center rounded-full border border-primary font-mono text-xs text-primary">
                {s.n}
              </span>
              <h3 className="mt-3 text-sm font-semibold">{s.title}</h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Equations</h2>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <Formula
            title="Modality risk score"
            expression={`score_m = clamp( Σ contribution_i , 0 , 100 )`}
            note="Each evidence item carries a fixed point contribution defined by its threshold band. Sum, then clamp."
          />
          <Formula
            title="Weight normalisation"
            expression={`w'_m = w_m / Σ_{k ∈ present} w_k`}
            note={`Defaults: image ${DEFAULT_SETTINGS.weights.image}, audio ${DEFAULT_SETTINGS.weights.audio}, text ${DEFAULT_SETTINGS.weights.text}. Absent modalities are dropped before normalising.`}
          />
          <Formula
            title="Fused risk score"
            expression={`final = round( Σ_{m ∈ present} score_m · w'_m )`}
            note="Only modalities actually supplied take part in the fusion."
          />
          <Formula
            title="Confidence (independent of risk)"
            expression={`confidence = 100 · ( 0.30·completeness + 0.30·validity + 0.20·coverage + 0.20·meanSignalConfidence )`}
            note="Completeness = measurable feature groups; validity = input size/length adequacy; coverage = measured signals ÷ expected signals."
          />
          <Formula
            title="Shannon entropy (image texture)"
            expression={`H = − Σ p(i) · log2 p(i)`}
            note="Computed over a 256-bin luma histogram of the decoded pixels."
          />
          <Formula
            title="Spectral centroid (audio)"
            expression={`C = Σ f_k · |X_k| / Σ |X_k|`}
            note="Per Hann-windowed 1024-sample frame using a radix-2 FFT, then averaged across frames."
          />
          <Formula
            title="Type-token ratio (text)"
            expression={`TTR = uniqueTokens / totalTokens`}
            note="Reported together with hapax ratio and repeated 4-gram ratio for lexical diversity."
          />
          <Formula
            title="Risk bands"
            expression={`0–30 Low · 31–60 Moderate · 61–80 High · 81–100 Very High`}
            note="Thresholds are configurable in Settings; each report stores the thresholds used."
          />
        </div>
      </section>

      <section className="panel mt-10 p-5">
        <h2 className="text-lg font-semibold">Determinism guarantee</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          The engine contains no random number generation, no pretrained weights and no
          filename inspection. Re-analysing identical content with identical settings reproduces
          identical features, identical evidence and an identical score.
        </p>
        <p className="mt-4 border-t border-border pt-4 text-xs text-muted-foreground">{DISCLAIMER}</p>
      </section>
    </AppShell>
  );
}
