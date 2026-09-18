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

    try {
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3.8-flash",
          messages: [
            {
              role: "system",
              content:
                "You explain content-authenticity analysis results for an academic forensics tool. Use ONLY the measured values given to you. Never invent numbers, never claim certainty, never state that content is definitely real or fake. Write 3 short paragraphs: what was measured, what it suggests, and what it cannot prove. Max 180 words.",
            },
            { role: "user", content: prompt },
          ],
        }),
      });
      if (!response.ok) {
        return { explanation: null as string | null, error: `AI gateway error ${response.status}` };
      }
      const json = (await response.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const content = json.choices?.[0]?.message?.content ?? null;
      return { explanation: content, error: null as string | null };
    } catch {
      return { explanation: null as string | null, error: "AI explanation request failed" };
    }
  });
