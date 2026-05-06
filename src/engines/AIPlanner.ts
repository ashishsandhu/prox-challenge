import { GoogleGenAI } from "@google/genai";
import type { OutputPlan, PlannerIntent, PlannerVisualType } from "./IntentRouter";
import { detectProcess, type WeldProcess } from "@/data/ProductGrounding";
import type { ConversationState } from "@/core/conversationState";

const plannerPrompt = `You are a high-speed intent classifier for a welding assistant (Vulcan OmniPro 220).
Analyze the user's message and context to decide the technical intent and visual requirements.

INTENTS:
- setup: wiring/sockets/cables/polarity.
- duty_cycle: limits/overheating/shutdowns.
- process_selection: comparing MIG/TIG/Stick/Flux-core.
- troubleshooting: weld defects/problems.
- weld_image_diagnosis: ONLY when an image is present and they ask about the weld quality.
- manual_image_question: asking for a specific page/diagram from the book.
- settings_recommendation: asking for voltage/wire-speed for a specific material.

RULES:
1. If 'hasUploadedImage' is true and the question is diagnostic, ALWAYS use 'weld_image_diagnosis'.
2. Extract the 'process' (mig, tig, flux-core, stick, or unknown).
3. Decide 'visualType' (setup_diagram, duty_cycle_matrix, troubleshooting_flow, image_diagnosis_panel, etc.).
4. Set 'needsClaudeVision' to true if and only if 'intent' is 'weld_image_diagnosis'.

Return ONLY compact JSON:
{
  "intent": "...",
  "process": "...",
  "visualType": "...",
  "visualId": "...",
  "needsClaudeVision": boolean,
  "needsClarification": boolean,
  "clarificationQuestion": "..."
}`;

export async function aiPlanOutput({
  message,
  hasUploadedImage,
  conversationState
}: {
  message: string;
  hasUploadedImage: boolean;
  conversationState?: ConversationState;
}): Promise<OutputPlan> {
  if (!process.env.GOOGLE_API_KEY) {
    // Fallback to deterministic router if no API key
    const { planOutput } = await import("./IntentRouter");
    return planOutput({ message, hasUploadedImage, conversationState });
  }

  const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });
  const prompt = `${plannerPrompt}\n\nUser Message: "${message}"\nHas Image: ${hasUploadedImage}\nContext: ${JSON.stringify(conversationState ?? {})}`;

  try {
    const result = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite-preview",
      contents: prompt
    });
    const text = (result.text ?? "").trim().replace(/^```json\s*|\s*```$/g, "");
    const parsed = JSON.parse(text);

    return {
      intent: parsed.intent as PlannerIntent,
      process: (parsed.process || detectProcess(message)) as WeldProcess,
      slots: { process: (parsed.process || detectProcess(message)) as WeldProcess },
      requiredFacts: ["AI generated plan"],
      visualType: parsed.visualType as PlannerVisualType,
      visualId: parsed.visualId,
      needsClaudeVision: parsed.needsClaudeVision ?? hasUploadedImage,
      needsClarification: parsed.needsClarification ?? false,
      clarificationQuestion: parsed.clarificationQuestion
    };
  } catch (error) {
    console.error("[AI Planner] failed, falling back", error);
    const { planOutput } = await import("./IntentRouter");
    return planOutput({ message, hasUploadedImage, conversationState });
  }
}
