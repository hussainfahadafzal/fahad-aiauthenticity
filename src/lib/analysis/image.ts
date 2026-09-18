import type { EvidenceItem, ModalityAnalysis } from "./types";
import { clamp, entropyOfHistogram, mean, round, stdDev } from "./util";

const MAX_SIDE = 640;

function readAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error ?? new Error("Could not read file"));
    reader.readAsArrayBuffer(file.slice(0, 256 * 1024));
  });
}

/** Detects the real EXIF APP1 marker in the file header bytes (no filename guessing). */
function detectExif(buffer: ArrayBuffer): boolean {
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length - 6; i++) {
    if (
      bytes[i] === 0x45 &&
      bytes[i + 1] === 0x78 &&
      bytes[i + 2] === 0x69 &&
      bytes[i + 3] === 0x66 &&
      bytes[i + 4] === 0x00
    ) {
      return true;
    }
  }
  return false;
}

async function decode(file: File): Promise<{ data: ImageData; width: number; height: number }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas 2D context unavailable in this browser");
  ctx.drawImage(bitmap, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h);
  bitmap.close?.();
  return { data, width: bitmap.width, height: bitmap.height };
}

export async function analyzeImage(file: File): Promise<ModalityAnalysis> {
  const header = await readAsArrayBuffer(file);
  const hasExif = detectExif(header);
  const { data, width, height } = await decode(file);
  const px = data.data;
  const w = data.width;
  const h = data.height;
  const n = w * h;

  const luma = new Float32Array(n);
  const hist = new Uint32Array(256);
  let sumR = 0;
  let sumG = 0;
  let sumB = 0;
  let sumSat = 0;
  const colors = new Set<number>();

  for (let i = 0; i < n; i++) {
    const r = px[i * 4]!;
    const g = px[i * 4 + 1]!;
    const b = px[i * 4 + 2]!;
    sumR += r;
    sumG += g;
    sumB += b;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    sumSat += max === 0 ? 0 : (max - min) / max;
    const y = 0.299 * r + 0.587 * g + 0.114 * b;
    luma[i] = y;
    hist[Math.min(255, Math.round(y))]!;
    hist[Math.min(255, Math.round(y))] = (hist[Math.min(255, Math.round(y))] ?? 0) + 1;
    colors.add(((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3));
  }

  const brightness = mean(luma);
  const contrast = stdDev(luma);
  const entropy = entropyOfHistogram(hist, n);

  // Sobel gradients + local high-pass residual (noise floor on flat regions).
  const gradients: number[] = [];
  const flatResiduals: number[] = [];
  let laplacianAbsSum = 0;
  let laplacianCount = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const p = (dx: number, dy: number) => luma[(y + dy) * w + (x + dx)]!;
      const gx =
        -p(-1, -1) - 2 * p(-1, 0) - p(-1, 1) + p(1, -1) + 2 * p(1, 0) + p(1, 1);
      const gy =
        -p(-1, -1) - 2 * p(0, -1) - p(1, -1) + p(-1, 1) + 2 * p(0, 1) + p(1, 1);
      const g = Math.sqrt(gx * gx + gy * gy);
      gradients.push(g);
      const lap = 4 * luma[i]! - p(-1, 0) - p(1, 0) - p(0, -1) - p(0, 1);
      laplacianAbsSum += Math.abs(lap);
      laplacianCount++;
      if (g < 20) flatResiduals.push(Math.abs(lap) / 4);
    }
  }

  const gradientMean = mean(gradients);
  const edgeDensity =
    gradients.length === 0 ? 0 : gradients.filter((g) => g > 40).length / gradients.length;
  const sharpness = laplacianCount === 0 ? 0 : laplacianAbsSum / laplacianCount;
  const noiseFloor = flatResiduals.length < 32 ? 0 : mean(flatResiduals);
  const noiseToSharpness = sharpness / Math.max(noiseFloor, 0.05);

  // JPEG 8x8 blockiness: difference across block boundaries vs inside blocks.
  let boundaryDiff = 0;
  let boundaryCount = 0;
  let interiorDiff = 0;
  let interiorCount = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 1; x < w; x++) {
      const d = Math.abs(luma[y * w + x]! - luma[y * w + x - 1]!);
      if (x % 8 === 0) {
        boundaryDiff += d;
        boundaryCount++;
      } else {
        interiorDiff += d;
        interiorCount++;
      }
    }
  }
  const blockiness =
    interiorCount === 0 || boundaryCount === 0
      ? 1
      : boundaryDiff / boundaryCount / Math.max(interiorDiff / interiorCount, 0.0001);

  const bitsPerPixel = (file.size * 8) / Math.max(1, width * height);
  const aspectRatio = width / Math.max(1, height);
  const uniqueColorRatio = colors.size / n;
  const saturation = sumSat / n;
  const standardSizes = [512, 640, 768, 1024, 1280, 1536, 2048];
  const isSquare = Math.abs(aspectRatio - 1) < 0.005;
  const standardGenerativeSize =
    isSquare && standardSizes.includes(width) && standardSizes.includes(height);

  const features: Record<string, unknown> = {
    width,
    height,
    analysedWidth: w,
    analysedHeight: h,
    aspectRatio: round(aspectRatio, 3),
    fileSizeBytes: file.size,
    format: file.type || "unknown",
    bitsPerPixel: round(bitsPerPixel, 3),
    meanR: round(sumR / n, 2),
    meanG: round(sumG / n, 2),
    meanB: round(sumB / n, 2),
    brightness: round(brightness, 2),
    contrast: round(contrast, 2),
    entropyBits: round(entropy, 3),
    edgeDensity: round(edgeDensity, 4),
    gradientMean: round(gradientMean, 3),
    sharpness: round(sharpness, 3),
    noiseFloor: round(noiseFloor, 3),
    noiseToSharpnessRatio: round(noiseToSharpness, 2),
    blockinessRatio: round(blockiness, 3),
    uniqueColorRatio: round(uniqueColorRatio, 4),
    saturationMean: round(saturation, 4),
    hasExifMetadata: hasExif,
    standardGenerativeSize,
  };

  const evidence: EvidenceItem[] = [];
  const push = (item: EvidenceItem) => evidence.push(item);
  const baseConfidence = n >= 40000 ? 90 : n >= 10000 ? 75 : 55;

  // 1. Sensor noise floor.
  if (noiseFloor > 0) {
    const c =
      noiseFloor < 1.5 ? 22 : noiseFloor < 3 ? 14 : noiseFloor < 5 ? 7 : 0;
    push({
      id: "img-noise-floor",
      modality: "image",
      category: "Sensor noise",
      name: "Flat-region noise floor",
      measured: `${round(noiseFloor, 3)} luma levels`,
      description:
        c > 0
          ? "Smooth areas contain less residual noise than typical camera sensor output, which is common in rendered or heavily denoised images."
          : "Smooth areas contain residual noise consistent with camera sensor capture.",
      severity: c >= 22 ? "high" : c >= 14 ? "moderate" : c > 0 ? "low" : "info",
      confidence: baseConfidence,
      contribution: c,
    });
  }

  // 2. Edge sharpness vs noise.
  {
    const c = noiseToSharpness > 30 ? 16 : noiseToSharpness > 18 ? 9 : 0;
    push({
      id: "img-sharpness-noise",
      modality: "image",
      category: "Frequency structure",
      name: "Sharpness-to-noise ratio",
      measured: round(noiseToSharpness, 2).toString(),
      description:
        c > 0
          ? "Edges are very sharp relative to the measured noise floor, a pattern typical of synthesised or upscaled imagery."
          : "Edge sharpness and noise are in a proportion typical of photographic capture.",
      severity: c >= 16 ? "high" : c > 0 ? "moderate" : "info",
      confidence: baseConfidence,
      contribution: c,
    });
  }

  // 3. Compression block structure.
  {
    const c = blockiness < 1.05 ? 10 : 0;
    push({
      id: "img-blockiness",
      modality: "image",
      category: "Compression",
      name: "8x8 block boundary ratio",
      measured: round(blockiness, 3).toString(),
      description:
        c > 0
          ? "No measurable JPEG block structure, so the file shows no evidence of a normal capture-and-compress history."
          : "Block boundary differences indicate a lossy compression history.",
      severity: c > 0 ? "moderate" : "info",
      confidence: baseConfidence - 10,
      contribution: c,
    });
  }

  // 4. Capture metadata.
  push({
    id: "img-exif",
    modality: "image",
    category: "Metadata",
    name: "EXIF capture metadata",
    measured: hasExif ? "present" : "absent",
    description: hasExif
      ? "An EXIF block is present in the file header."
      : "No EXIF block was found in the file header. Generated images usually lack it, but so do re-saved or platform-stripped photos.",
    severity: hasExif ? "info" : "moderate",
    confidence: 85,
    contribution: hasExif ? 0 : 12,
  });

  // 5. Dimensions.
  {
    const c = standardGenerativeSize ? 12 : isSquare ? 5 : 0;
    push({
      id: "img-dimensions",
      modality: "image",
      category: "Geometry",
      name: "Output dimensions",
      measured: `${width} x ${height}`,
      description:
        standardGenerativeSize
          ? "Dimensions match a square output size commonly produced by generative image models."
          : isSquare
            ? "Dimensions are exactly square, which is uncommon for direct camera capture."
            : "Dimensions are consistent with camera or editor output.",
      severity: c >= 12 ? "moderate" : c > 0 ? "low" : "info",
      confidence: 95,
      contribution: c,
    });
  }

  // 6. Tonal complexity.
  {
    const c = entropy < 6.5 ? 8 : 0;
    push({
      id: "img-entropy",
      modality: "image",
      category: "Texture",
      name: "Luma entropy",
      measured: `${round(entropy, 3)} bits`,
      description:
        c > 0
          ? "Tonal complexity is lower than typical natural scenes, indicating smooth synthetic gradients or limited detail."
          : "Tonal complexity is within the natural-scene range.",
      severity: c > 0 ? "low" : "info",
      confidence: baseConfidence,
      contribution: c,
    });
  }

  // 7. Colour palette breadth.
  {
    const c = uniqueColorRatio < 0.15 ? 8 : 0;
    push({
      id: "img-colors",
      modality: "image",
      category: "Colour",
      name: "Unique colour ratio",
      measured: round(uniqueColorRatio, 4).toString(),
      description:
        c > 0
          ? "A narrow colour palette relative to pixel count, which can indicate rendering or palette quantisation."
          : "Colour palette breadth is typical of photographic content.",
      severity: c > 0 ? "low" : "info",
      confidence: baseConfidence - 5,
      contribution: c,
    });
  }

  // 8. Data density.
  {
    const c = bitsPerPixel > 4 ? 6 : bitsPerPixel < 0.15 ? 6 : 0;
    push({
      id: "img-bpp",
      modality: "image",
      category: "Compression",
      name: "Bits per pixel",
      measured: round(bitsPerPixel, 3).toString(),
      description:
        bitsPerPixel > 4
          ? "Very high data density per pixel, typical of lossless exports rather than camera JPEGs."
          : bitsPerPixel < 0.15
            ? "Very low data density per pixel, indicating aggressive recompression that erases forensic traces."
            : "Data density per pixel is in the common photographic range.",
      severity: c > 0 ? "low" : "info",
      confidence: 80,
      contribution: c,
    });
  }

  // 9. Saturation.
  {
    const c = saturation > 0.55 ? 6 : 0;
    push({
      id: "img-saturation",
      modality: "image",
      category: "Colour",
      name: "Mean saturation",
      measured: round(saturation, 4).toString(),
      description:
        c > 0
          ? "Average saturation is higher than typical unedited photographs."
          : "Average saturation is in the typical photographic range.",
      severity: c > 0 ? "low" : "info",
      confidence: baseConfidence - 10,
      contribution: c,
    });
  }

  const notes: string[] = [];
  if (n < 10000) notes.push("Image is very small, so texture statistics are less stable.");
  if (!hasExif) notes.push("No EXIF metadata was available to corroborate capture details.");

  return {
    modality: "image",
    features,
    evidence,
    quality: {
      completeness: hasExif ? 1 : 0.9,
      validity: clamp(n / 90000, 0.35, 1),
      notes,
    },
  };
}
