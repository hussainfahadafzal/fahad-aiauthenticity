/** Deterministic numeric helpers shared by all analyzers. No randomness anywhere. */

export function mean(values: ArrayLike<number>): number {
  if (values.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < values.length; i++) sum += values[i]!;
  return sum / values.length;
}

export function stdDev(values: ArrayLike<number>): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  let acc = 0;
  for (let i = 0; i < values.length; i++) acc += (values[i]! - m) ** 2;
  return Math.sqrt(acc / (values.length - 1));
}

/** Coefficient of variation (std / mean). 0 when mean is 0. */
export function cv(values: ArrayLike<number>): number {
  const m = mean(values);
  if (m === 0) return 0;
  return stdDev(values) / m;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function round(value: number, digits = 2): number {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}

/** Shannon entropy in bits of a histogram. */
export function entropyOfHistogram(histogram: ArrayLike<number>, total: number): number {
  if (total <= 0) return 0;
  let h = 0;
  for (let i = 0; i < histogram.length; i++) {
    const p = histogram[i]! / total;
    if (p > 0) h -= p * Math.log2(p);
  }
  return h;
}

/** In-place iterative radix-2 FFT. Arrays must be a power of two in length. */
export function fft(re: Float32Array, im: Float32Array) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const tr = re[i]!;
      re[i] = re[j]!;
      re[j] = tr;
      const ti = im[i]!;
      im[i] = im[j]!;
      im[j] = ti;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    for (let i = 0; i < n; i += len) {
      for (let k = 0; k < len / 2; k++) {
        const wr = Math.cos(ang * k);
        const wi = Math.sin(ang * k);
        const ur = re[i + k]!;
        const ui = im[i + k]!;
        const vr = re[i + k + len / 2]! * wr - im[i + k + len / 2]! * wi;
        const vi = re[i + k + len / 2]! * wi + im[i + k + len / 2]! * wr;
        re[i + k] = ur + vr;
        im[i + k] = ui + vi;
        re[i + k + len / 2] = ur - vr;
        im[i + k + len / 2] = ui - vi;
      }
    }
  }
}

/** Stable id derived from content, so the same input yields the same id prefix. */
export function hashString(input: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x1000193;
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    h1 = (h1 ^ c) * 16777619;
    h2 = (h2 + c * (i + 1)) >>> 0;
    h1 >>>= 0;
  }
  return (h1.toString(16) + h2.toString(16)).padStart(12, "0").slice(0, 12);
}
