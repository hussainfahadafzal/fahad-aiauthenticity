import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({
  mediaType: z.string(),
  finalScore: z.number(),
  confidence: z.number(),
  riskLevel: z.string(),
  signals: z
    .array(
      z.object({
        name: z.string(),
        measured: z.string(),
        contribution: z.number(),
        severity: z.string(),
      }),
    )
    .max(40),
});

/**
 * Optional narrative synthesis. The model is only allowed to explain the numbers
 * that the deterministic engine already measured — it never produces scores.
 */
export const explainAnalysis = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => schema.parse(data))
  .handler(async ({ data }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return { explanation: null as string | null, error: "AI explanation unavailable" };

    const prompt = [
      `Modality: ${data.mediaType}`,
      `Risk score: ${data.finalScore}/100 (${data.riskLevel})`,
      `Analysis confidence: ${data.confidence}%`,
      "Measured signals:",
      ...data.signals.map(
        (s) => `- ${s.name}: ${s.measured} | severity ${s.severity} | +${s.contribution} risk points`,
      ),
    ].join("\n");

    const instructions =
      "You explain content-authenticity analysis results for an academic forensics tool. Use ONLY the measured values given to you. Never invent numbers, never claim certainty, never state that content is definitely real or fake. Write 3 short paragraphs: what was measured, what it suggests, and what it cannot prove. Keep it under 180 words.";

    try {
      const response = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Lovable-API-Key": apiKey,
          "X-Lovable-AIG-SDK": "fetch",
        },
        body: JSON.stringify({
          model: "openai/gpt-6-astra",
          instructions,
          input: [{ role: "user", content: [{ type: "input_text", text: prompt }] }],
          stream: true,
          store: false,
          reasoning: { effort: "low", summary: "auto" },
        }),
      });
      if (!response.ok || !response.body) {
        return { explanation: null as string | null, error: `AI gateway error ${response.status}` };
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let text = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (!payload || payload === "[DONE]") continue;
          try {
            const event = JSON.parse(payload) as {
              type?: string;
              delta?: string;
              response?: { output_text?: string };
            };
            if (event.type === "response.output_text.delta" && typeof event.delta === "string") {
              text += event.delta;
            } else if (event.type === "response.completed" && event.response?.output_text) {
              if (!text) text = event.response.output_text;
            }
          } catch {
            // ignore keep-alive or partial frames
          }
        }
      }

      const content = text.trim();
      if (!content) {
        return { explanation: null as string | null, error: "AI explanation returned no text" };
      }
      return { explanation: content, error: null as string | null };
    } catch {
      return { explanation: null as string | null, error: "AI explanation request failed" };
    }
  });
