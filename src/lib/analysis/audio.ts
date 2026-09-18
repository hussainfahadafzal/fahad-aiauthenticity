import type { EvidenceItem, ModalityAnalysis } from "./types";
import { clamp, cv, fft, mean, round, stdDev } from "./util";

const FRAME = 1024;

export async function analyzeAudio(file: File): Promise<ModalityAnalysis> {
  const arrayBuffer = await file.arrayBuffer();
  const Ctx =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) throw new Error("Web Audio API is not available in this browser");
  const ctx = new Ctx();
  let buffer: AudioBuffer;
  try {
    buffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
  } finally {
    void ctx.close();
  }

  const channels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const duration = buffer.duration;
  const raw = buffer.getChannelData(0);

  // Mono mixdown for analysis.
  const samples = new Float32Array(raw.length);
  for (let c = 0; c < channels; c++) {
    const ch = buffer.getChannelData(c);
    for (let i = 0; i < samples.length; i++) samples[i] = samples[i]! + ch[i]! / channels;
  }

  let sumSq = 0;
  let clipped = 0;
  let zeroCrossings = 0;
  let peak = 0;
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i]!;
    sumSq += s * s;
    if (Math.abs(s) >= 0.99) clipped++;
    if (Math.abs(s) > peak) peak = Math.abs(s);
    if (i > 0 && (s >= 0) !== (samples[i - 1]! >= 0)) zeroCrossings++;
  }
  const rms = Math.sqrt(sumSq / Math.max(1, samples.length));
  const zcr = zeroCrossings / Math.max(1, samples.length);
  const clippingRatio = clipped / Math.max(1, samples.length);
  const crestFactor = rms === 0 ? 0 : peak / rms;

  // Framed spectral analysis with a Hann window.
  const frameCount = Math.max(1, Math.floor(samples.length / FRAME));
  const spectrumAvg = new Float64Array(FRAME / 2);
  const frameRms: number[] = [];
  const centroids: number[] = [];
  const rolloffs: number[] = [];
  const flatnessValues: number[] = [];
  let silentFrames = 0;
  const waveform: number[] = [];
  const waveformBuckets = 240;
  const bucketSize = Math.max(1, Math.floor(samples.length / waveformBuckets));

  for (let b = 0; b < waveformBuckets; b++) {
    let p = 0;
    const start = b * bucketSize;
    for (let i = start; i < Math.min(samples.length, start + bucketSize); i++) {
      p = Math.max(p, Math.abs(samples[i]!));
    }
    waveform.push(round(p, 4));
  }

  const re = new Float32Array(FRAME);
  const im = new Float32Array(FRAME);
  for (let f = 0; f < frameCount; f++) {
    const offset = f * FRAME;
    let frameSq = 0;
    for (let i = 0; i < FRAME; i++) {
      const s = samples[offset + i] ?? 0;
      frameSq += s * s;
      re[i] = s * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (FRAME - 1)));
      im[i] = 0;
    }
    const fRms = Math.sqrt(frameSq / FRAME);
    frameRms.push(fRms);
    if (fRms < 0.002) silentFrames++;
    if (fRms < 1e-6) continue;

    fft(re, im);
    const bins = FRAME / 2;
    let magSum = 0;
    let weighted = 0;
    let logSum = 0;
    const mags = new Float64Array(bins);
    for (let k = 0; k < bins; k++) {
      const m = Math.sqrt(re[k]! * re[k]! + im[k]! * im[k]!) / bins;
      mags[k] = m;
      spectrumAvg[k] = spectrumAvg[k]! + m;
      magSum += m;
      weighted += m * ((k * sampleRate) / FRAME);
      logSum += Math.log(m + 1e-12);
    }
    if (magSum > 0) {
      centroids.push(weighted / magSum);
      const geo = Math.exp(logSum / bins);
      flatnessValues.push(geo / (magSum / bins));
      let acc = 0;
      let rolloffHz = 0;
      for (let k = 0; k < bins; k++) {
        acc += mags[k]!;
        if (acc >= 0.95 * magSum) {
          rolloffHz = (k * sampleRate) / FRAME;
          break;
        }
      }
      rolloffs.push(rolloffHz);
    }
  }

  const spectrum: number[] = [];
  const spectrumBands = 64;
  const binsPerBand = Math.floor(spectrumAvg.length / spectrumBands);
  for (let b = 0; b < spectrumBands; b++) {
    let acc = 0;
    for (let k = b * binsPerBand; k < (b + 1) * binsPerBand; k++) acc += spectrumAvg[k]!;
    spectrum.push(round((acc / Math.max(1, binsPerBand)) / Math.max(1, frameCount), 6));
  }

  const spectralCentroid = mean(centroids);
  const spectralRolloff = mean(rolloffs);
  const spectralFlatness = mean(flatnessValues);
  const centroidStability = cv(centroids);
  const energyVariation = cv(frameRms);
  const silenceRatio = silentFrames / Math.max(1, frameCount);
  const activeRms = frameRms.filter((r) => r > 0.002);
  const loudest = activeRms.length ? Math.max(...activeRms) : 0;
  const quietest = activeRms.length ? Math.min(...activeRms) : 0;
  const dynamicRangeDb =
    loudest > 0 && quietest > 0 ? 20 * Math.log10(loudest / quietest) : 0;

  const features: Record<string, unknown> = {
    durationSeconds: round(duration, 3),
    sampleRate,
    channels,
    fileSizeBytes: file.size,
    format: file.type || "unknown",
    rmsEnergy: round(rms, 5),
    peakAmplitude: round(peak, 5),
    crestFactor: round(crestFactor, 3),
    zeroCrossingRate: round(zcr, 5),
    spectralCentroidHz: round(spectralCentroid, 1),
    spectralRolloff95Hz: round(spectralRolloff, 1),
    spectralFlatness: round(spectralFlatness, 5),
    centroidStabilityCv: round(centroidStability, 4),
    energyVariationCv: round(energyVariation, 4),
    silenceRatio: round(silenceRatio, 4),
    clippingRatio: round(clippingRatio, 6),
    dynamicRangeDb: round(dynamicRangeDb, 2),
    framesAnalysed: frameCount,
    waveform,
    spectrum,
    spectrumMaxHz: round(sampleRate / 2, 0),
  };

  const evidence: EvidenceItem[] = [];
  const baseConfidence = duration >= 5 ? 90 : duration >= 2 ? 72 : 55;
  const push = (i: EvidenceItem) => evidence.push(i);

  {
    const c = silenceRatio < 0.005 ? 16 : silenceRatio < 0.02 ? 8 : 0;
    push({
      id: "aud-silence",
      modality: "audio",
      category: "Background",
      name: "Silence / room-tone ratio",
      measured: round(silenceRatio * 100, 2) + "%",
      description:
        c > 0
          ? "Almost no low-level passages. Natural recordings usually contain pauses with room tone; synthesised speech often does not."
          : "Contains low-level passages consistent with natural recording pauses.",
      severity: c >= 16 ? "high" : c > 0 ? "moderate" : "info",
      confidence: baseConfidence,
      contribution: c,
    });
  }

  {
    const c = dynamicRangeDb > 0 && dynamicRangeDb < 20 ? 14 : dynamicRangeDb < 30 ? 7 : 0;
    push({
      id: "aud-dynamic-range",
      modality: "audio",
      category: "Dynamics",
      name: "Dynamic range",
      measured: `${round(dynamicRangeDb, 2)} dB`,
      description:
        c > 0
          ? "A narrow loudness range across the clip, typical of synthesised or heavily normalised audio."
          : "Loudness varies across a range typical of natural recordings.",
      severity: c >= 14 ? "moderate" : c > 0 ? "low" : "info",
      confidence: baseConfidence,
      contribution: c,
    });
  }

  {
    const limit = sampleRate * 0.3;
    const c = spectralRolloff > 0 && spectralRolloff < limit ? 12 : 0;
    push({
      id: "aud-rolloff",
      modality: "audio",
      category: "Spectral",
      name: "95% spectral rolloff",
      measured: `${round(spectralRolloff, 0)} Hz`,
      description:
        c > 0
          ? "Energy stops well below the Nyquist limit, indicating band-limited synthesis or an aggressive codec."
          : "High-frequency energy extends as expected for the sample rate.",
      severity: c > 0 ? "moderate" : "info",
      confidence: baseConfidence,
      contribution: c,
    });
  }

  {
    const c = spectralFlatness > 0.35 ? 10 : spectralFlatness > 0 && spectralFlatness < 0.02 ? 8 : 0;
    push({
      id: "aud-flatness",
      modality: "audio",
      category: "Spectral",
      name: "Spectral flatness",
      measured: round(spectralFlatness, 5).toString(),
      description:
        spectralFlatness > 0.35
          ? "The spectrum is unusually noise-like, which can indicate artefacts or generated texture."
          : c > 0
            ? "The spectrum is unusually tonal with little broadband content, common in synthesised tones."
            : "Spectral flatness is in a typical range for recorded audio.",
      severity: c > 0 ? "low" : "info",
      confidence: baseConfidence - 5,
      contribution: c,
    });
  }

  {
    const c = energyVariation > 0 && energyVariation < 0.25 ? 12 : 0;
    push({
      id: "aud-energy-uniformity",
      modality: "audio",
      category: "Dynamics",
      name: "Frame energy variation",
      measured: round(energyVariation, 4).toString(),
      description:
        c > 0
          ? "Frame-to-frame loudness is unusually uniform for natural speech or music."
          : "Frame-to-frame loudness varies naturally.",
      severity: c > 0 ? "moderate" : "info",
      confidence: baseConfidence,
      contribution: c,
    });
  }

  {
    const c = centroidStability > 0 && centroidStability < 0.12 ? 12 : 0;
    push({
      id: "aud-centroid-stability",
      modality: "audio",
      category: "Spectral",
      name: "Spectral centroid stability",
      measured: round(centroidStability, 4).toString(),
      description:
        c > 0
          ? "The spectral balance barely changes over time, a pattern typical of machine-generated audio."
          : "Spectral balance shifts over time as expected in natural audio.",
      severity: c > 0 ? "moderate" : "info",
      confidence: baseConfidence,
      contribution: c,
    });
  }

  {
    const c = clippingRatio > 0.01 ? 8 : 0;
    push({
      id: "aud-clipping",
      modality: "audio",
      category: "Integrity",
      name: "Clipping ratio",
      measured: round(clippingRatio * 100, 4) + "%",
      description:
        c > 0
          ? "A noticeable share of samples sit at full scale, indicating clipping or aggressive limiting."
          : "Few or no samples reach full scale.",
      severity: c > 0 ? "low" : "info",
      confidence: 92,
      contribution: c,
    });
  }

  {
    const ttsRates = [16000, 22050, 24000];
    const c = channels === 1 && ttsRates.includes(sampleRate) ? 8 : 0;
    push({
      id: "aud-format",
      modality: "audio",
      category: "Format",
      name: "Channel and sample-rate profile",
      measured: `${channels} ch @ ${sampleRate} Hz`,
      description:
        c > 0
          ? "Mono audio at a sample rate commonly used by speech synthesis pipelines."
          : "Channel and sample-rate profile is typical of general recording or distribution.",
      severity: c > 0 ? "low" : "info",
      confidence: 95,
      contribution: c,
    });
  }

  {
    const c = zcr > 0 && zcr < 0.02 ? 6 : 0;
    push({
      id: "aud-zcr",
      modality: "audio",
      category: "Time domain",
      name: "Zero crossing rate",
      measured: round(zcr, 5).toString(),
      description:
        c > 0
          ? "Very low zero-crossing activity, meaning little high-frequency or fricative content."
          : "Zero-crossing activity is in a typical range.",
      severity: c > 0 ? "low" : "info",
      confidence: baseConfidence - 5,
      contribution: c,
    });
  }

  const notes: string[] = [];
  if (duration < 2) notes.push("Clip is shorter than 2 seconds, so spectral statistics are less stable.");
  if (frameCount < 10) notes.push("Few analysis frames were available.");

  return {
    modality: "audio",
    features,
    evidence,
    quality: {
      completeness: 1,
      validity: clamp(duration / 10, 0.3, 1),
      notes,
    },
  };
}

export const audioStd = stdDev;
