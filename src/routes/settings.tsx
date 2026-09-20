import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
  type EngineSettings,
} from "@/lib/analysis/config";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — AuthenticityAI" },
      {
        name: "description",
        content: "Adjust modality fusion weights, risk band thresholds and optional AI explanation.",
      },
      { property: "og:title", content: "Settings — AuthenticityAI" },
      { property: "og:description", content: "Configure fusion weights and risk thresholds for the scoring engine." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const [settings, setSettings] = useState<EngineSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    setSettings(loadSettings());
  }, []);

  const weightSum =
    settings.weights.image + settings.weights.audio + settings.weights.text;

  function update(next: EngineSettings) {
    setSettings(next);
  }

  function persist() {
    saveSettings(settings);
    toast.success("Settings saved — applied to future analyses");
  }

  const weightRow = (key: keyof EngineSettings["weights"], label: string) => (
    <div key={key}>
      <div className="flex items-center justify-between text-sm">
        <Label htmlFor={`w-${key}`}>{label}</Label>
        <span className="font-mono text-xs">
          {settings.weights[key].toFixed(2)} ({weightSum > 0 ? Math.round((settings.weights[key] / weightSum) * 100) : 0}%
          normalised)
        </span>
      </div>
      <Slider
        id={`w-${key}`}
        className="mt-3"
        value={[settings.weights[key] * 100]}
        min={0}
        max={100}
        step={5}
        onValueChange={([v]) =>
          update({
            ...settings,
            weights: { ...settings.weights, [key]: (v ?? 0) / 100 },
          })
        }
      />
    </div>
  );

  const thresholdRow = (key: keyof EngineSettings["thresholds"], label: string) => (
    <div key={key}>
      <div className="flex items-center justify-between text-sm">
        <Label htmlFor={`t-${key}`}>{label}</Label>
        <span className="font-mono text-xs">{settings.thresholds[key]}</span>
      </div>
      <Slider
        id={`t-${key}`}
        className="mt-3"
        value={[settings.thresholds[key]]}
        min={5}
        max={99}
        step={1}
        onValueChange={([v]) =>
          update({
            ...settings,
            thresholds: { ...settings.thresholds, [key]: v ?? 0 },
          })
        }
      />
    </div>
  );

  return (
    <AppShell>
      <div className="max-w-2xl">
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Stored in this browser and recorded with every analysis so results stay reproducible.
        </p>

        <section className="panel mt-6 space-y-5 p-5">
          <h2 className="text-sm font-semibold">Fusion weights</h2>
          {weightRow("image", "Image")}
          {weightRow("audio", "Audio")}
          {weightRow("text", "Text")}
          <p className="text-xs text-muted-foreground">
            Weights are re-normalised across the modalities present in each analysis, so they never
            need to sum to 1.
          </p>
        </section>

        <section className="panel mt-4 space-y-5 p-5">
          <h2 className="text-sm font-semibold">Risk band thresholds</h2>
          {thresholdRow("low", "Low risk up to")}
          {thresholdRow("moderate", "Moderate risk up to")}
          {thresholdRow("high", "High risk up to")}
          <p className="text-xs text-muted-foreground">
            Scores above the high threshold are reported as Very High.
          </p>
        </section>

        <section className="panel mt-4 flex items-center justify-between gap-4 p-5">
          <div>
            <h2 className="text-sm font-semibold">AI narrative explanation</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Adds a written summary of the measured signals. It can never change a score or invent
              values.
            </p>
          </div>
          <Switch
            checked={settings.aiExplanation}
            onCheckedChange={(v) => update({ ...settings, aiExplanation: v })}
            aria-label="Enable AI narrative explanation"
          />
        </section>

        <div className="mt-6 flex gap-3">
          <Button onClick={persist}>Save settings</Button>
          <Button
            variant="outline"
            onClick={() => {
              setSettings(DEFAULT_SETTINGS);
              saveSettings(DEFAULT_SETTINGS);
              toast.success("Settings restored to defaults");
            }}
          >
            Restore defaults
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
