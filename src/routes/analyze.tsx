import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Loader2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { Dropzone } from "@/components/Dropzone";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { loadSettings } from "@/lib/analysis/config";
import { runAnalysis } from "@/lib/analysis/engine";
import type { MediaType } from "@/lib/analysis/types";
import { DISCLAIMER } from "@/lib/analysis/types";
import { explainAnalysis } from "@/lib/explain.functions";
import { saveAnalysis } from "@/lib/store";

export const Route = createFileRoute("/analyze")({
  head: () => ({
    meta: [
      { title: "New Analysis — AuthenticityAI" },
      {
        name: "description",
        content: "Run a deterministic authenticity analysis on an image, audio clip, text passage or a multimodal bundle.",
      },
      { property: "og:title", content: "New Analysis — AuthenticityAI" },
      {
        property: "og:description",
        content: "Upload content and extract real measurable authenticity signals in the browser.",
      },
    ],
  }),
  component: AnalyzePage,
});

function AnalyzePage() {
  const navigate = useNavigate();
  const explain = useServerFn(explainAnalysis);
  const [tab, setTab] = useState<MediaType>("image");
  const [image, setImage] = useState<File | null>(null);
  const [audio, setAudio] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [audioPreview, setAudioPreview] = useState<string | null>(null);

  function pickImage(file: File | null) {
    setImage(file);
    setImagePreview(file ? URL.createObjectURL(file) : null);
  }

  function pickAudio(file: File | null) {
    setAudio(file);
    setAudioPreview(file ? URL.createObjectURL(file) : null);
  }

  const inputsForTab = () => {
    if (tab === "image") return { image: image ?? undefined };
    if (tab === "audio") return { audio: audio ?? undefined };
    if (tab === "text") return { text: text.trim() ? text : undefined };
    return {
      image: image ?? undefined,
      audio: audio ?? undefined,
      text: text.trim() ? text : undefined,
    };
  };

  const ready = (() => {
    const i = inputsForTab();
    return Boolean(i.image || i.audio || i.text);
  })();

  async function handleRun() {
    setBusy(true);
    try {
      const settings = loadSettings();
      const result = await runAnalysis(inputsForTab(), tab, settings);

      if (settings.aiExplanation) {
        try {
          const ai = await explain({
            data: {
              mediaType: result.mediaType,
              finalScore: result.finalScore,
              confidence: result.confidence,
              riskLevel: result.riskLevel,
              signals: result.evidence.map((e) => ({
                name: e.name,
                measured: e.measured,
                contribution: e.contribution,
                severity: e.severity,
              })),
            },
          });
          if (ai.explanation) {
            result.explanation = `${result.explanation}\n\n${ai.explanation}`;
          }
        } catch {
          // AI narrative is optional; measured results stand on their own.
        }
      }

      const saved = await saveAnalysis(result);
      toast.success(`Analysis complete — risk ${saved.finalScore}/100 (${saved.riskLevel})`);
      if (result.modelErrors.length > 0) {
        toast.warning("ML model unavailable — using local signal analysis", {
          description: result.modelErrors[0],
        });
      }
      void navigate({ to: "/results/$id", params: { id: saved.analysisId } });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Analysis failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl">
        <h1 className="text-2xl font-semibold">New analysis</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Everything is measured from your actual input in this browser session. Nothing is guessed
          from the filename.
        </p>

        <Tabs value={tab} onValueChange={(v) => setTab(v as MediaType)} className="mt-6">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
            <TabsTrigger value="image">Image</TabsTrigger>
            <TabsTrigger value="audio">Audio</TabsTrigger>
            <TabsTrigger value="text">Text</TabsTrigger>
            <TabsTrigger value="multimodal">Multimodal</TabsTrigger>
          </TabsList>

          <TabsContent value="image" className="mt-5 space-y-4">
            <Dropzone
              accept="image/*"
              label="Drop an image or click to browse"
              hint="JPEG, PNG or WebP. Pixels are read with Canvas; EXIF presence is read from the real file bytes."
              file={image}
              onFile={pickImage}
            />
            {imagePreview && (
              <img
                src={imagePreview}
                alt="Selected image preview"
                className="max-h-80 w-full rounded-lg border border-border object-contain bg-surface"
              />
            )}
          </TabsContent>

          <TabsContent value="audio" className="mt-5 space-y-4">
            <Dropzone
              accept="audio/*"
              label="Drop an audio file or click to browse"
              hint="WAV, MP3, M4A or OGG. Decoded with the Web Audio API and analysed frame by frame with an FFT."
              file={audio}
              onFile={pickAudio}
            />
            {audioPreview && <audio controls src={audioPreview} className="w-full" />}
          </TabsContent>

          <TabsContent value="text" className="mt-5 space-y-3">
            <label htmlFor="text-input" className="text-sm font-medium">
              Paste the text to analyse
            </label>
            <Textarea
              id="text-input"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={12}
              placeholder="Paste at least a few paragraphs for stable stylometric measurements."
              className="bg-surface font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              {text.trim() ? `${text.trim().split(/\s+/).length} words · ${text.length} characters` : "No text yet"}
            </p>
          </TabsContent>

          <TabsContent value="multimodal" className="mt-5 space-y-5">
            <p className="rounded-md border border-border bg-surface p-3 text-xs text-muted-foreground">
              Supply any combination. Weights are re-normalised across the modalities you actually
              provide, so a missing modality is never scored.
            </p>
            <Dropzone
              accept="image/*"
              label="Image (optional)"
              hint="Adds the image signal group to the fused score."
              file={image}
              onFile={pickImage}
            />
            <Dropzone
              accept="audio/*"
              label="Audio (optional)"
              hint="Adds the audio signal group to the fused score."
              file={audio}
              onFile={pickAudio}
            />
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={6}
              aria-label="Optional text for multimodal analysis"
              placeholder="Optional text…"
              className="bg-surface font-mono text-sm"
            />
          </TabsContent>
        </Tabs>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button size="lg" disabled={!ready || busy} onClick={handleRun}>
            {busy && <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />}
            {busy ? "Analysing…" : "Run analysis"}
          </Button>
          <p className="flex items-start gap-2 text-xs text-muted-foreground">
            <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            {DISCLAIMER}
          </p>
        </div>
      </div>
    </AppShell>
  );
}
