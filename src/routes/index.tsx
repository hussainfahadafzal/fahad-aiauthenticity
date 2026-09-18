import { createFileRoute, Link } from "@tanstack/react-router";
import { AudioLines, Braces, FileSearch, Image as ImageIcon, Layers, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DISCLAIMER } from "@/lib/analysis/types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AuthenticityAI — Multimodal Content Authenticity & Risk Analysis" },
      {
        name: "description",
        content:
          "Explainable authenticity risk assessment for images, audio and text using real measured signals — never random scores.",
      },
      { property: "og:title", content: "AuthenticityAI — Content Authenticity & Risk Analysis" },
      {
        property: "og:description",
        content:
          "Measure real image, audio and text signals and get an explainable authenticity risk score with full evidence.",
      },
    ],
  }),
  component: Landing,
});

const MODALITIES = [
  {
    icon: ImageIcon,
    title: "Image signals",
    body: "Canvas pixel statistics: entropy, edge density, sensor noise floor, 8×8 compression blockiness, EXIF presence.",
  },
  {
    icon: AudioLines,
    title: "Audio signals",
    body: "Web Audio decoding with FFT: spectral centroid, rolloff, flatness, silence ratio, dynamic range, clipping.",
  },
  {
    icon: Braces,
    title: "Text signals",
    body: "Stylometry: sentence-length variation, type-token ratio, repeated n-grams, punctuation and register statistics.",
  },
  {
    icon: Layers,
    title: "Multimodal fusion",
    body: "Each supplied modality is scored independently, then fused with re-normalised weights. Missing inputs are never scored.",
  },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between border-b border-border px-5 py-4 sm:px-10">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-6 text-primary" aria-hidden />
          <span className="font-display text-base font-semibold">AuthenticityAI</span>
        </div>
        <nav aria-label="Primary" className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link to="/methodology">Methodology</Link>
          </Button>
          <Button asChild size="sm">
            <Link to="/analyze">Start analysis</Link>
          </Button>
        </nav>
      </header>

      <section className="grid-backdrop border-b border-border px-5 py-20 sm:px-10">
        <div className="mx-auto max-w-3xl text-center">
          <p className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs text-evidence">
            <FileSearch className="size-3.5" aria-hidden />
            Deterministic analysis engine v1.0.0
          </p>
          <h1 className="mt-6 text-4xl font-semibold leading-tight sm:text-5xl">
            AI-powered multimodal content authenticity &amp; risk analysis
          </h1>
          <p className="mt-5 text-base leading-relaxed text-muted-foreground">
            AuthenticityAI extracts measurable signals from images, audio and text, then produces an
            explainable risk score with the exact evidence behind every point. Same input, same
            features, same score — every time.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg">
              <Link to="/analyze">Analyse content</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/dashboard">Open dashboard</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="px-5 py-16 sm:px-10">
        <div className="mx-auto grid max-w-5xl gap-4 sm:grid-cols-2">
          {MODALITIES.map(({ icon: Icon, title, body }) => (
            <article key={title} className="panel p-5">
              <Icon className="size-5 text-primary" aria-hidden />
              <h2 className="mt-3 text-lg font-semibold">{title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-t border-border px-5 py-14 sm:px-10">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-2xl font-semibold">What this system does not do</h2>
          <ul className="mt-4 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
            <li className="panel p-3">No random numbers or hardcoded verdicts.</li>
            <li className="panel p-3">No filename-based detection.</li>
            <li className="panel p-3">No fake accuracy percentages or claimed models.</li>
            <li className="panel p-3">No seeded demo history — the dashboard starts empty.</li>
          </ul>
          <p className="mt-6 rounded-md border border-border bg-surface p-4 text-sm text-muted-foreground">
            {DISCLAIMER}
          </p>
        </div>
      </section>

      <footer className="border-t border-border px-5 py-6 text-xs text-muted-foreground sm:px-10">
        AuthenticityAI — academic project. Analyzer v1.0.0 · Scoring v1.0.0
      </footer>
    </div>
  );
}
