# AuthenticityAI

**AI-Powered Multimodal Content Authenticity & Risk Analysis System**

AuthenticityAI analyses images, audio and text and produces an **explainable authenticity risk
assessment**: a risk score, a separate confidence value, the measured signals behind every point,
and an honest statement of limitations.

> AuthenticityAI provides an analytical risk assessment based on measurable content signals.
> Results are not definitive forensic proof.

## Honest scope

- **No model is trained from scratch.** The project integrates publicly available pretrained
  classifiers and fuses their real probabilities with interpretable modality features.
- If no inference token is configured, or the endpoint fails, the status is reported as
  `NOT_CONFIGURED` / `UNAVAILABLE` / `ERROR` and the report states
  *"ML model unavailable — using local signal analysis. Final risk calculated without ML model
  inference."* No prediction is ever simulated.
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

## Pretrained model integration

| Modality | Default model | Role |
| --- | --- | --- |
| Image | `Organika/sdxl-detector` | Public transformer classifier (human-made vs diffusion-generated) |
| Audio | `MelodyMachine/Deepfake-audio-detection-V2` | Public wav2vec2 checkpoint (bona-fide vs synthesised speech) |
| Text | none | Deterministic stylometry only — clearly labelled as feature-based |

Inference runs server-side through a TanStack server function, so the token never reaches the
browser. Configure `HUGGINGFACE_API_KEY` (or `HF_TOKEN`) as a backend secret; models, weight and a
custom endpoint are configurable in **Settings**, which also has a live status check. Training-data
provenance is quoted from each upstream model card; where the manifest is incomplete, the report
says so, and no accuracy figure is claimed.

## Scoring model

```
featureScore_m = clamp( Σ evidence contributions , 0 , 100 )
score_m        = round( (1−λ)·featureScore_m + λ·100·P_model(synthetic) )   # λ = 0 unless model AVAILABLE
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
