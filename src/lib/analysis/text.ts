import type { EvidenceItem, ModalityAnalysis } from "./types";
import { clamp, cv, mean, round, stdDev } from "./util";

const STOPWORDS = new Set(
  "the a an and or but if of to in on for with as at by from that this it is are was were be been being not no do does did have has had he she they we you i".split(
    " ",
  ),
);

export function analyzeText(input: string): ModalityAnalysis {
  const text = input.replace(/\r\n/g, "\n");
  const chars = text.length;
  const words = text.toLowerCase().match(/[a-z0-9']+/g) ?? [];
  const wordCount = words.length;
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  const sentenceWordCounts = sentences.map((s) => (s.match(/[A-Za-z0-9']+/g) ?? []).length);
  const avgSentenceLength = mean(sentenceWordCounts);
  const sentenceLengthStd = stdDev(sentenceWordCounts);
  const sentenceLengthCv = cv(sentenceWordCounts);

  const counts = new Map<string, number>();
  for (const w of words) counts.set(w, (counts.get(w) ?? 0) + 1);
  const ttr = wordCount === 0 ? 0 : counts.size / wordCount;
  const hapax = [...counts.values()].filter((c) => c === 1).length;
  const hapaxRatio = counts.size === 0 ? 0 : hapax / counts.size;

  // Repeated 4-grams.
  const grams = new Map<string, number>();
  for (let i = 0; i + 4 <= words.length; i++) {
    const key = words.slice(i, i + 4).join(" ");
    grams.set(key, (grams.get(key) ?? 0) + 1);
  }
  const repeatedGrams = [...grams.entries()].filter(([, c]) => c > 1);
  const repeatedGramRatio = grams.size === 0 ? 0 : repeatedGrams.length / grams.size;
  const topRepeatedGram =
    repeatedGrams.sort((a, b) => b[1] - a[1])[0] ?? null;

  const commas = (text.match(/,/g) ?? []).length;
  const semicolons = (text.match(/;/g) ?? []).length;
  const colons = (text.match(/:/g) ?? []).length;
  const dashes = (text.match(/—|--/g) ?? []).length;
  const questions = (text.match(/\?/g) ?? []).length;
  const exclamations = (text.match(/!/g) ?? []).length;
  const punctuationDensity = chars === 0 ? 0 : (commas + semicolons + colons + dashes + questions + exclamations) / chars;
  const punctuationVariety = [commas, semicolons, colons, dashes, questions, exclamations].filter(
    (v) => v > 0,
  ).length;
  const commasPerSentence = sentences.length === 0 ? 0 : commas / sentences.length;
  const contractions = (text.match(/\b\w+'(t|s|re|ve|ll|d|m)\b/gi) ?? []).length;
  const contractionRate = wordCount === 0 ? 0 : contractions / wordCount;
  const longWords = words.filter((w) => w.length >= 8).length;
  const longWordRatio = wordCount === 0 ? 0 : longWords / wordCount;
  const stopwords = words.filter((w) => STOPWORDS.has(w)).length;
  const stopwordRatio = wordCount === 0 ? 0 : stopwords / wordCount;
  const paragraphWordCounts = paragraphs.map((p) => (p.match(/[A-Za-z0-9']+/g) ?? []).length);
  const paragraphCv = cv(paragraphWordCounts);

  const features: Record<string, unknown> = {
    charCount: chars,
    wordCount,
    sentenceCount: sentences.length,
    paragraphCount: paragraphs.length,
    uniqueWords: counts.size,
    avgSentenceLength: round(avgSentenceLength, 2),
    sentenceLengthStd: round(sentenceLengthStd, 2),
    sentenceLengthCv: round(sentenceLengthCv, 4),
    typeTokenRatio: round(ttr, 4),
    hapaxRatio: round(hapaxRatio, 4),
    repeatedFourGramRatio: round(repeatedGramRatio, 4),
    repeatedFourGramCount: repeatedGrams.length,
    mostRepeatedFourGram: topRepeatedGram ? `${topRepeatedGram[0]} (x${topRepeatedGram[1]})` : "none",
    commas,
    semicolons,
    colons,
    emDashes: dashes,
    questionMarks: questions,
    exclamationMarks: exclamations,
    punctuationDensity: round(punctuationDensity, 5),
    punctuationVariety,
    commasPerSentence: round(commasPerSentence, 3),
    contractionRate: round(contractionRate, 5),
    longWordRatio: round(longWordRatio, 4),
    stopwordRatio: round(stopwordRatio, 4),
    paragraphLengthCv: round(paragraphCv, 4),
  };

  const evidence: EvidenceItem[] = [];
  const push = (i: EvidenceItem) => evidence.push(i);
  const baseConfidence = wordCount >= 300 ? 90 : wordCount >= 120 ? 75 : wordCount >= 40 ? 58 : 40;

  {
    const c =
      sentences.length >= 4 && sentenceLengthCv > 0
        ? sentenceLengthCv < 0.25
          ? 18
          : sentenceLengthCv < 0.35
            ? 10
            : 0
        : 0;
    push({
      id: "txt-sentence-uniformity",
      modality: "text",
      category: "Rhythm",
      name: "Sentence length variation",
      measured: round(sentenceLengthCv, 4).toString(),
      description:
        c > 0
          ? "Sentence lengths are unusually uniform. Human writing typically mixes short and long sentences."
          : "Sentence lengths vary in a way typical of human writing.",
      severity: c >= 18 ? "high" : c > 0 ? "moderate" : "info",
      confidence: baseConfidence,
      contribution: c,
    });
  }

  {
    const c = wordCount >= 200 && ttr < 0.35 ? 10 : 0;
    push({
      id: "txt-ttr",
      modality: "text",
      category: "Lexical diversity",
      name: "Type-token ratio",
      measured: round(ttr, 4).toString(),
      description:
        c > 0
          ? "Lexical diversity is low for this length, meaning vocabulary repeats heavily."
          : "Lexical diversity is within a normal band for this length.",
      severity: c > 0 ? "moderate" : "info",
      confidence: baseConfidence,
      contribution: c,
    });
  }

  {
    const c = repeatedGramRatio > 0.05 ? 14 : repeatedGramRatio > 0.02 ? 7 : 0;
    push({
      id: "txt-ngrams",
      modality: "text",
      category: "Repetition",
      name: "Repeated 4-gram ratio",
      measured: round(repeatedGramRatio, 4).toString(),
      description:
        c > 0
          ? "Multi-word phrases recur more than expected, a common trait of template or model-generated text."
          : "Few repeated multi-word phrases.",
      severity: c >= 14 ? "moderate" : c > 0 ? "low" : "info",
      confidence: baseConfidence,
      contribution: c,
    });
  }

  {
    const c = wordCount >= 120 && contractionRate === 0 ? 10 : 0;
    push({
      id: "txt-contractions",
      modality: "text",
      category: "Register",
      name: "Contraction rate",
      measured: round(contractionRate, 5).toString(),
      description:
        c > 0
          ? "No contractions across a substantial passage, which skews towards formal generated prose."
          : "Contraction usage is typical of natural prose.",
      severity: c > 0 ? "moderate" : "info",
      confidence: baseConfidence - 10,
      contribution: c,
    });
  }

  {
    const c = sentences.length >= 5 && punctuationVariety <= 2 ? 8 : 0;
    push({
      id: "txt-punctuation",
      modality: "text",
      category: "Punctuation",
      name: "Punctuation variety",
      measured: `${punctuationVariety} of 6 mark types`,
      description:
        c > 0
          ? "Punctuation is limited to a couple of mark types, indicating a very regular structure."
          : "A varied mix of punctuation marks is present.",
      severity: c > 0 ? "low" : "info",
      confidence: baseConfidence - 10,
      contribution: c,
    });
  }

  {
    const c = longWordRatio > 0.28 ? 8 : 0;
    push({
      id: "txt-long-words",
      modality: "text",
      category: "Vocabulary",
      name: "Long-word ratio",
      measured: round(longWordRatio, 4).toString(),
      description:
        c > 0
          ? "An unusually high share of long words, typical of formal or generated explanatory writing."
          : "Word-length distribution is typical.",
      severity: c > 0 ? "low" : "info",
      confidence: baseConfidence - 5,
      contribution: c,
    });
  }

  {
    const c = paragraphs.length >= 3 && paragraphCv > 0 && paragraphCv < 0.15 ? 10 : 0;
    push({
      id: "txt-paragraph-uniformity",
      modality: "text",
      category: "Structure",
      name: "Paragraph length variation",
      measured: round(paragraphCv, 4).toString(),
      description:
        c > 0
          ? "Paragraphs are nearly identical in length, a structural regularity common in generated output."
          : "Paragraph lengths vary naturally.",
      severity: c > 0 ? "moderate" : "info",
      confidence: baseConfidence,
      contribution: c,
    });
  }

  {
    const c = commasPerSentence > 2.2 ? 6 : 0;
    push({
      id: "txt-commas",
      modality: "text",
      category: "Punctuation",
      name: "Commas per sentence",
      measured: round(commasPerSentence, 3).toString(),
      description:
        c > 0
          ? "Sentences carry many clauses each, a pattern associated with generated explanatory prose."
          : "Clause density per sentence is typical.",
      severity: c > 0 ? "low" : "info",
      confidence: baseConfidence - 10,
      contribution: c,
    });
  }

  {
    const outside = stopwordRatio > 0 && (stopwordRatio < 0.3 || stopwordRatio > 0.58);
    const c = wordCount >= 80 && outside ? 6 : 0;
    push({
      id: "txt-stopwords",
      modality: "text",
      category: "Vocabulary",
      name: "Function-word ratio",
      measured: round(stopwordRatio, 4).toString(),
      description:
        c > 0
          ? "Function-word density falls outside the usual band for natural English prose."
          : "Function-word density is in the usual band for natural English prose.",
      severity: c > 0 ? "low" : "info",
      confidence: baseConfidence - 10,
      contribution: c,
    });
  }

  const notes: string[] = [];
  if (wordCount < 120)
    notes.push("Text is short, so stylometric measures such as sentence variation are less reliable.");
  if (paragraphs.length < 3) notes.push("Few paragraphs were available for structural comparison.");

  return {
    modality: "text",
    features,
    evidence,
    quality: {
      completeness: 1,
      validity: clamp(wordCount / 400, 0.25, 1),
      notes,
    },
  };
}
