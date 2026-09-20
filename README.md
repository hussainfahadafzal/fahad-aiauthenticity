# AuthenticityAI

**AI-Powered Multimodal Content Authenticity & Risk Analysis System**

AuthenticityAI analyses images, audio and text and produces an **explainable authenticity risk
assessment**: a risk score, a separate confidence value, the measured signals behind every point,
and an honest statement of limitations.

> AuthenticityAI provides an analytical risk assessment based on measurable content signals.
> Results are not definitive forensic proof.

## Honest scope

- No trained deepfake classifier, and none is claimed.
- No random numbers, hardcoded verdicts or fake accuracy percentages.
- No filename-based detection — decisions come from decoded content only.
- No seeded demo history: the dashboard is empty until you run a real analysis.
- Deterministic: same input + same settings → same features → same score.

## Features

| Modality | Measured signals |
| --- | --- |
| Image | Dimensions, aspect ratio, file size, format, bits per pixel, RGB means, brightness, contrast, luma entropy, edge density, Sobel gradients, Laplacian sharpness, flat-region noise floor, 8×8 compression blockiness, unique colour ratio, saturation, EXIF presence (real byte scan) |
| Audio | Duration, sample rate, channels, RMS energy, peak, crest factor, zero-crossing rate, spectral centroid, 95% rolloff, spectral flatness, centroid stability, frame-energy variation, silence ratio, clipping ratio, dynamic range, waveform + spectrum visualisers |
| Text | Character/word/sentence/paragraph counts, mean sentence length and variation, type-token ratio, hapax ratio, repeated 4-grams, punctuation statistics and variety, contraction rate, long-word ratio, function-word ratio, paragraph uniformity |
| Multimodal | Independent per-modality scoring with weight re-normalisation (defaults: image 0.40, audio 0.40, text 0.20). Missing modalities are never scored. |

Pages: Landing, Dashboard, New Analysis, Results, History, Reports, Methodology, Settings, About.

## Scoring model

```
score_m    = clamp( Σ evidence contributions , 0 , 100 )
w'_m       = w_m / Σ_{k ∈ present} w_k
final      = round( Σ score_m · w'_m )
confidence = 100 · (0.30·completeness + 0.30·validity + 0.20·coverage + 0.20·meanSignalConfidence)
```

Risk bands: `0–30 Low`, `31–60 Moderate`, `61–80 High`, `81–100 Very High` (configurable in Settings;
each stored report records the thresholds and weights used).

Confidence is deliberately independent of risk: it expresses how trustworthy the measurements are
(input size/length, signal coverage, feature validity), not how suspicious the content looks.

## Tech stack

- React 19 + TypeScript + Vite, TanStack Start/Router, TanStack Query
- Tailwind CSS v4, shadcn/ui, Recharts, Lucide icons
- Canvas 2D, Web Audio API (`decodeAudioData`) and a hand-written radix-2 FFT for signal extraction
- Managed PostgreSQL persistence (`analyses` table, one row per report with full JSON features,
  evidence and score contributions)
- Optional server-side AI narrative that may only explain already-measured values

## Project structure

```
src/lib/analysis/     image.ts · audio.ts · text.ts · scoring.ts · engine.ts · config.ts · util.ts
src/lib/store.ts      persistence helpers (list / get / save / delete)
src/lib/explain.functions.ts  optional server-side narrative synthesis
src/components/       AppShell, ScoreDial, EvidenceCard, Dropzone, AudioVisualizer
src/routes/           index, dashboard, analyze, results.$id, history, reports, methodology, settings, about
drizzle/migrations/   database schema
```

## Local development

```sh
npm install
npm run dev
```

Copy `.env.example` to `.env` and fill in your own backend values when running outside the hosted
environment.

## Environment variables

Copy the template and fill it in locally. `.env` and every other `.env.*` file are git-ignored;
only `.env.example` (names and placeholders, never real values) belongs in the repository.

```sh
cp .env.example .env
```

| Variable | Scope | Purpose |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | browser | Backend API URL. Public by design. |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | browser | Publishable (anon) key. Public by design; row-level security protects the data. |
| `VITE_SUPABASE_PROJECT_ID` | browser | Backend project identifier. Public by design. |
| `SUPABASE_URL` | server | Same URL, read by server functions. |
| `SUPABASE_PUBLISHABLE_KEY` | server | Publishable key for server-side reads. |
| `LOVABLE_API_KEY` | server only | Enables the optional AI narrative. Provisioned automatically in the hosted environment. |

Rules:

- Only `VITE_`-prefixed variables reach the browser bundle. Never give a private key a `VITE_`
  prefix, and never hardcode one in `src/`.
- Server-only values (`LOVABLE_API_KEY`, and a service-role key if you ever self-host) are read
  inside server function handlers via `process.env` and never shipped to the client.
- The app works without `LOVABLE_API_KEY`; the deterministic analysis and explanation still run.

## Database schema (`analyses`)

`id`, `analysis_id`, `media_type`, `filename`, `status`, `image_score`, `audio_score`, `text_score`,
`final_score`, `confidence`, `risk_level`, `features` (JSON), `evidence` (JSON),
`score_contributions` (JSON), `explanation`, `limitations`, `analyzer_version`, `scoring_version`,
`processing_time`, `created_at`.

## Limitations

- Statistical signals, not proof: atypical measurements can come from editing, recompression or
  platform re-encoding as easily as from synthesis.
- Thresholds are documented heuristics, not calibrated against a labelled dataset.
- Short inputs (small images, clips under two seconds, short passages) reduce confidence.

## Future work

Video analysis with temporal consistency, threshold calibration on public datasets, batch
processing, and C2PA content-credential verification.

## License

MIT — see [LICENSE](./LICENSE).
