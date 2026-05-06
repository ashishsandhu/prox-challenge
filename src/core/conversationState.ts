import { classifyQuestion, detectProcess, extractMaterial, extractThickness, type VisualType, type WeldProcess } from "@/data/ProductGrounding";

export type PendingQuestion = {
  intent: VisualType;
  question: string;
  missing: "process" | "material" | "thickness";
  process?: Exclude<WeldProcess, "unknown">;
  material?: string;
  thickness?: string;
};

export type ConversationState = {
  pending?: PendingQuestion;
};

export function isShortProcessAnswer(input: string): input is Exclude<WeldProcess, "unknown"> {
  const normalized = input.trim().toLowerCase();
  return /^(mig|gmaw|solid core|solid-core)$/.test(normalized)
    || /^(flux|flux-core|flux core|fcaw|gasless)$/.test(normalized)
    || /^(tig|gtaw)$/.test(normalized)
    || /^(stick|smaw|arc)$/.test(normalized);
}

export function normalizeProcessAnswer(input: string): Exclude<WeldProcess, "unknown"> {
  const text = input.trim().toLowerCase();
  if (/flux|fcaw|gasless/.test(text)) return "flux-core";
  if (/tig|gtaw/.test(text)) return "tig";
  if (/stick|smaw|arc/.test(text)) return "stick";
  return "mig";
}

export function isShortMaterialAnswer(input: string) {
  return isLikelyShortClarificationReply(input) && Boolean(extractMaterial(input));
}

export function normalizeMaterialAnswer(input: string) {
  return extractMaterial(input) ?? input.trim().toLowerCase();
}

export function isShortThicknessAnswer(input: string) {
  return isLikelyShortClarificationReply(input) && Boolean(extractThickness(input));
}

export function normalizeThicknessAnswer(input: string) {
  return extractThickness(input) ?? input.trim().toLowerCase();
}

export function resolveConversationalQuestion({
  messages,
  question,
  state
}: {
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  question: string;
  state?: ConversationState;
}) {
  const pending = state?.pending ?? inferPendingFromMessages(messages);
  if (!pending) {
    return { question, resolvedFromPending: false };
  }

  if (pending.missing === "process" && isShortProcessAnswer(question)) {
    const process = normalizeProcessAnswer(question);
    return {
      question: composeResolvedQuestion(pending, { process }),
      resolvedFromPending: true,
      process,
      material: pending.material,
      thickness: pending.thickness
    };
  }

  if (pending.missing === "material" && isShortMaterialAnswer(question)) {
    const material = normalizeMaterialAnswer(question);
    return {
      question: composeResolvedQuestion(pending, { material }),
      resolvedFromPending: true,
      process: pending.process,
      material,
      thickness: pending.thickness
    };
  }

  if (pending.missing === "thickness" && isShortThicknessAnswer(question)) {
    const thickness = normalizeThicknessAnswer(question);
    return {
      question: composeResolvedQuestion(pending, { thickness }),
      resolvedFromPending: true,
      process: pending.process,
      material: pending.material,
      thickness
    };
  }

  return { question, resolvedFromPending: false };
}

export function nextConversationState(
  question: string,
  response: { answer: string; visualType: VisualType; process: WeldProcess; settingRecommendation?: unknown },
  state?: ConversationState,
  resolved?: { process?: Exclude<WeldProcess, "unknown">; material?: string; thickness?: string }
) {
  const baseQuestion = state?.pending?.question ?? question;
  const intent = response.visualType === "text" ? classifyQuestion(baseQuestion) : response.visualType;
  const process = response.process === "unknown"
    ? resolved?.process ?? state?.pending?.process ?? detectKnownProcess(question)
    : response.process;
  const material = resolved?.material ?? state?.pending?.material ?? extractMaterial(question);
  const thickness = resolved?.thickness ?? state?.pending?.thickness ?? extractThickness(question);

  const asksForProcess = /(which|what)\s+process|are you using\s+(?:mig|tig|flux-core|stick)|mig,\s*tig,\s*flux-core,\s*or\s*stick/i.test(response.answer);
  const asksForMaterial = /(what|which)\s+(?:material|metal)|what are you welding/i.test(response.answer);
  const asksForThickness = /(what|which)\s+(?:thickness|gauge)|how thick/i.test(response.answer);

  if (intent === "settings" || response.visualType === "settings") {
    if (!process && (response.process === "unknown" || asksForProcess)) {
      return {
        pending: {
          intent: "settings",
          question: baseQuestion,
          missing: "process",
          material,
          thickness
        }
      } satisfies ConversationState;
    }

    if (!material && (asksForMaterial || !response.settingRecommendation)) {
      return {
        pending: {
          intent: "settings",
          question: baseQuestion,
          missing: "material",
          process,
          thickness
        }
      } satisfies ConversationState;
    }

    if (!thickness && (asksForThickness || !response.settingRecommendation)) {
      return {
        pending: {
          intent: "settings",
          question: baseQuestion,
          missing: "thickness",
          process,
          material
        }
      } satisfies ConversationState;
    }

    return {} satisfies ConversationState;
  }

  if (response.process === "unknown" && (response.visualType === "polarity" || asksForProcess)) {
    return {
      pending: {
        intent: response.visualType,
        question: baseQuestion,
        missing: "process",
        material,
        thickness
      }
    } satisfies ConversationState;
  }

  return {} satisfies ConversationState;
}

function inferPendingFromMessages(messages: Array<{ role: "user" | "assistant"; content: string }>): PendingQuestion | undefined {
  const previousAssistant = [...messages].reverse().find((message) => message.role === "assistant")?.content ?? "";
  const missing = inferMissingSlot(previousAssistant);
  if (!missing) return undefined;

  const previousUserMessages = messages.filter((message) => message.role === "user").slice(0, -1);
  const previousUser = previousUserMessages.at(-1)?.content;
  if (!previousUser) return undefined;

  const process = detectKnownProcess(previousUser);
  const material = extractMaterial(previousUser);
  const thickness = extractThickness(previousUser);

  return {
    intent: classifyQuestion(previousUser),
    question: previousUser,
    missing,
    process,
    material,
    thickness
  };
}

function composeResolvedQuestion(
  pending: PendingQuestion,
  next: { process?: Exclude<WeldProcess, "unknown">; material?: string; thickness?: string }
) {
  const process = next.process ?? pending.process;
  const material = next.material ?? pending.material;
  const thickness = next.thickness ?? pending.thickness;
  const details: string[] = [];

  if (process) details.push(`Process clarification: ${process}`);
  if (material) details.push(`Material clarification: ${material}`);
  if (thickness) details.push(`Thickness clarification: ${thickness}`);

  if (!details.length) return pending.question;
  return `${pending.question}\n\n${details.join("\n")}`;
}

function detectKnownProcess(input: string): Exclude<WeldProcess, "unknown"> | undefined {
  const process = detectProcess(input);
  return process === "unknown" ? undefined : process;
}

function isLikelyShortClarificationReply(input: string) {
  const words = input.trim().split(/\s+/).filter(Boolean);
  return words.length > 0 && words.length <= 7 && !/[.!?]/.test(input);
}

function inferMissingSlot(answer: string): PendingQuestion["missing"] | undefined {
  if (/(which|what)\s+process|mig|flux-core|tig|stick|are you using/i.test(answer)) return "process";
  if (/(what|which)\s+(material|metal)|what are you welding/i.test(answer)) return "material";
  if (/(what|which)\s+(thickness|gauge)|how thick/i.test(answer)) return "thickness";
  return undefined;
}
