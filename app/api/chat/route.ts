import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { AgentResponseSchema, localGroundedResponse, normalizeAgentResponse, type AgentResponse, type VisualSpec } from "@/core/agentResponse";
import { nextConversationState, resolveConversationalQuestion, type ConversationState } from "@/core/conversationState";
import {
  dedupeRefs,
  dutyCycleRows,
  manualImages,
  ownerRef,
  polaritySetups,
  processManualImageIndex,
  quickRef,
  retrieveManualContext,
  troubleshootingChecks,
  type ManualImage,
  type ManualRef,
  type WeldProcess
} from "@/data/ProductGrounding";
import { findManualImageById, getManualImageRef, type ManualImageIndexEntry } from "@/data/VisualRegistry";
import { extractMentionedProcesses, planOutput, planVisuals, structuredCacheKey, type OutputPlan, type PlannerIntent, type PlannerVisualType } from "@/engines/IntentRouter";
import { aiPlanOutput } from "@/engines/AIPlanner";
import type { VisualType } from "@/data/ProductGrounding";
import {
  getImageInterpretation,
  getTroubleshootingItems,
  getVisualKnowledgeForIntent,
  weldDiagnosisKnowledge
} from "@/data/SchemaGrounding";
import { detectSmartWarnings } from "@/engines/RiskAssessmentEngine";
import { runVulcanAgent, vulcanAgentToolNames } from "@/engines/Director";

export const runtime = "nodejs";

// System prompt: keep tight so Claude stays within the JSON budget and answers
// the specific question instead of asking for clarification or padding output.
const systemPrompt = [
  "You are a welding assistant for the Vulcan OmniPro 220.",
  "",
  "ANSWER STYLE (strict — match length to the question):",
  "1. Direct questions ('what', 'where', 'which', 'how long', 'how much'): answer in 1–2 sentences first, then optionally one short clarification line. Do NOT include full setup steps unless the user asked.",
  "2. 'How to', 'walk me through', or multi-part questions: provide structured numbered steps (max 5). If a pre-weld checklist will render inline, skip the numbered steps and write 1–2 sentences of context only.",
  "3. Problem descriptions (holes, porosity, slipping wire, no arc, burn-through, etc.): give the most likely cause in 1\u20132 sentences. The interactive troubleshooting checklist below will carry the cause/check/fix steps \u2014 do NOT list them in prose.",
  "4. Definitions ('what is X', 'define X', 'explain X', 'what does X mean'): give a clear 1\u20132 sentence definition grounded in welding context. Do NOT route to troubleshooting or ask for setup details.",
  "4a. Explanation / consequence ('what happens if ...', 'what happens when ...', 'why does/do/is/are ...', 'what does X cause/mean/affect', 'what are the consequences of ...', 'why do I need ...'): answer the consequence or reason FIRST in 1\u20132 sentences. Do NOT default to setup steps. Do NOT include a numbered procedure or a checklist preview. After the consequence, you MAY add at most one short follow-up line prefixed with 'Correct setup:', 'Why:', or 'Next:' \u2014 keep it to a single sentence. Set visualType=\"text\" for these answers. Examples:\n   - Q: 'what happens if polarity is reversed in TIG' \u2192 'Reversed TIG polarity drives heat into the tungsten instead of the workpiece, so the tungsten overheats, balls/melts, contaminates the weld, and the arc goes unstable. Correct setup: ground clamp \u2192 positive (+), TIG torch \u2192 negative (\u2212).'\n   - Q: 'why does flux-core not need gas' \u2192 'Flux-core wire has flux inside the wire that burns and creates its own shielding, so it protects the puddle without an external gas bottle. Why: the self-shielding also makes flux-core a better choice outdoors where wind would blow shielding gas away.'\n   - Q: 'what happens if I exceed duty cycle' \u2192 'The welder overheats and the thermal cutout shuts the output down until it cools. Next: leave the power on so the fan keeps cooling the machine, then use shorter weld periods and longer rests.'",
  "5. Always include a brief 'why' (one sentence max) for technical answers — the reason behind the recommendation.",
  "6. Never restate the same fact (duty cycle, polarity, etc.) more than once in the same answer.",
  "7. Real-world order: answer what they asked first, then expand only if needed.",
  "8. Never default to 'tell me more', 'describe your setup', or similar fallback phrases when the question can be answered directly.",
  "",
  "SCOPE:",
  "- Answer ONLY the user's exact question. If they ask about TIG, answer TIG only. If they ask flux-core, answer flux-core only.",
  "- Never enumerate all four processes (MIG, flux-core, TIG, stick) unless the user explicitly asked to choose or compare.",
  "- If the user describes a wrong setup, call it out and show the corrected setup.",
  "- Only mention an uploaded image if the user attached one this turn.",
  "- Use known context: 'garage' = indoors (no wind concern); 'outdoors' = wind/draft concern. Do not re-ask context the user already gave.",
  "",
  "GROUNDING:",
  "- Ground every fact in the Vulcan OmniPro 220 manual. Do not add unsupported real-world advice.",
  "- Do not reorder manual troubleshooting steps unless the manual itself orders them differently for that process.",
  "- For flux-core porosity questions, do NOT lead with shielding-gas / regulator checks — flux-core is self-shielded; lead with polarity, clean metal, dry/clean wire, CTWD, and steady drag technique.",
  "- Do not repeat in prose what a diagram or table already shows.",
  "",
  "VISUALS (grounded only):",
  "- If the user asks to show, display, open, label, or pull up a manual image / diagram / visual / panel, do not troubleshoot first and do not ask clarifying questions.",
  "- For manual image requests, return visualType=\"manual-image\" and a short one-sentence answer.",
  "- Use real manual images whenever available. Never invent product visuals, \u201Ctypical welder\u201D layouts, fake diagrams, fake labels, or fake image details.",
  "- Generated diagrams (setup_diagram, duty cycle table) are allowed only when based on structured manual data (polaritySetups, dutyCycleRows).",
  "- If no grounded manual visual exists for the request, say so clearly instead of inventing one.",
  "- An interactive troubleshooting flow and pre-weld checklist render inline below your prose in the chat bubble. When one is attached, keep prose to a maximum of 2 short sentences (diagnosis or context only) and let the checklist carry the steps. Do NOT restate, summarize, paraphrase, or preview the checklist items in prose. Never write phrases like 'follow these steps', 'here is the procedure', or numbered lists when a checklist is attached.",
  "- MULTI-PROCESS COMPARE: when the user asks about (or names) 2+ welding processes (e.g. 'explain flux core and tig', 'show me all four setups', 'compare MIG and stick'), a comparison table AND per-process pre-weld checklists render inline below your prose. In this case the `answer` field MUST be a markdown bullet list \u2014 one bullet per named process, in the order they were named, each bullet 1\u20132 short lines describing ONLY identity and use-case (what the process is and when to reach for it: indoor vs outdoor, materials, skill level, gas vs gasless). Bullet format: `- **MIG**: ...one or two short sentences...`. Example for two processes: `- **Flux-core**: Gasless and built for outdoor or drafty work on dirty mild steel.\\n- **TIG**: Precision process for thin steel, stainless, or aluminum indoors where bead appearance matters.` STRICT: do NOT mention sockets, polarity (positive/negative/+/\u2212), cable destinations, ground clamp routing, wire feed routing, electrode holder routing, gas pressure, CFH, or pre-weld steps in any bullet \u2014 every one of those facts is already in the table and checklists below your prose. No intro sentence, no closing tip, no headings \u2014 bullets only.",
  "- ALWAYS provide exactly 3 concise, highly relevant followUpPrompts based on the current context to guide the user's next step.",
  "- INTENT INFERENCE: If the user asks a follow-up about limits, stopping mid-weld, or asks 'what is that' in the context of overheating/duty cycle, YOU MUST set visualType='duty-cycle' so the animated gauge appears.",
  "",
  "CONVERSATION CONTEXT RULES (CRITICAL):",
  "- You will receive a CONVERSATION HISTORY section in the prompt. You MUST read it to understand follow-up messages.",
  "- Short follow-ups like 'whats that', 'how?', 'show', 'show me', 'what does that mean', 'the limit', 'how much', 'explain' ALWAYS refer to the most recent topic in the conversation history. NEVER ask the user to clarify what they mean if the conversation history makes it obvious.",
  "- If the user says 'show' after a polarity/setup topic, show the setup diagram. If after duty cycle, show the gauge. If after troubleshooting, show the troubleshooting flow. ALWAYS render something visual.",
  "- ALWAYS produce a meaningful visualType based on conversation context. Never return visualType='text' for a follow-up that continues a visual topic. Returning 'text' with no visual when the user is clearly following up a technical topic is a FAILURE.",
  "- If you cannot determine the exact follow-up intent from history, make the best inference and answer it. Never return a generic 'I need more info' response when context is available."
].join("\n");

// Detects the generic "Use MIG / TIG / flux-core" comparison block when the
// user asked a specific question.
function isGenericMultiProcessAnswer(answer: string): boolean {
  const lower = answer.toLowerCase();
  if (!/use mig if|use mig for|use mig when/.test(lower)) return false;
  const processCount = ["mig", "tig", "flux", "stick"].filter((p) => lower.includes(p)).length;
  return processCount >= 3;
}

// Detects the localGroundedResponse "Tell me what you are setting up..."
// fallback so we can replace it with a real diagnosis when an image is present.
function isGenericClarificationFallback(answer: string): boolean {
  return /tell me what you are setting up or fixing/i.test(answer);
}

// Composes a chat answer directly from imageDiagnosis so the user always gets
// a real visual diagnosis (never the generic clarification fallback) when an
// image is attached.
function composeImageDiagnosisAnswer(d: NonNullable<AgentResponse["imageDiagnosis"]>): string {
  const lines: string[] = [];
  lines.push(`This looks like **${d.likelyIssue}** (confidence: ${d.confidence}).`);
  if (d.visualClues.length) {
    lines.push("");
    lines.push("Visible clues:");
    d.visualClues.slice(0, 4).forEach((c) => lines.push(`- ${c}`));
  }
  if (d.fixes.length) {
    lines.push("");
    lines.push("First checks:");
    d.fixes.slice(0, 4).forEach((f, i) => lines.push(`${i + 1}. ${f}`));
  }
  if (d.caution) {
    lines.push("");
    lines.push(`Note: ${d.caution}`);
  }
  return lines.join("\n");
}

// Builds the short, grounded one-sentence answer for a manual_image_question.
// When no indexed image fits the request, returns an honest message instead of
// inventing a "typical welder" layout.
function composeManualImageAnswer(
  question: string,
  entry: ManualImageIndexEntry | undefined,
  image: ManualImage | undefined
): string {
  if (!entry || !image) {
    return "I don\u2019t have a manual image indexed for that exact view, so I can\u2019t show a grounded manual visual. I can still show a simplified diagram if it can be built from structured manual data.";
  }
  const lower = question.toLowerCase();
  if (entry.id === "weld-diagnosis") {
    return "Here\u2019s the manual image showing weld appearance and common defects (porosity, spatter, burn-through, wavy bead).";
  }
  if (entry.id === "front-panel-controls") {
    return "Here\u2019s the manual image of the front panel controls and output sockets.";
  }
  if (entry.id.endsWith("-setup-diagram")) {
    const proc = entry.id.replace("-setup-diagram", "").toUpperCase();
    return `Here\u2019s the manual\u2019s ${proc} setup diagram from the Owner\u2019s Manual.`;
  }
  if (entry.id === "duty-cycle-chart") {
    return "Here\u2019s the manual\u2019s duty-cycle chart with the 120V and 240V ratings.";
  }
  if (entry.id === "wire-feed-interior") {
    return "Here\u2019s the manual image of the wire feed compartment (drive roller, tensioner, inlet guide).";
  }
  if (entry.id === "process-selection-chart") {
    return "Here\u2019s the manual\u2019s process selection chart comparing MIG, flux-core, TIG, and stick.";
  }
  // Fallback: still grounded — mention only what the indexed entry guarantees.
  void lower;
  return `Here\u2019s the manual image: ${entry.title} (${entry.source} p.${entry.page}).`;
}

// Detects "what is X / define X / explain X / what does X mean" phrasing.
function isDefinitionQuestion(text: string): boolean {
  return /\b(what(?:'?s| is| are| does)|define|explain|meaning of|tell me about)\b/i.test(text);
}

// For definition-style questions about known terms (CTWD, porosity, duty
// cycle, polarity, stickout), pull KB facts so Claude has manual-grounded
// snippets and refs to ground its answer in. Returns empty when no known
// term is matched — Claude still answers, but with whatever the base
// retrieveManualContext provided.
function getDefinitionContextSnippets(question: string): { snippets: string[]; refs: ManualRef[] } {
  const lower = question.toLowerCase();
  const snippets: string[] = [];
  const refs: ManualRef[] = [];

  if (/\bporosity\b|\bporous\b|\bpinholes?\b/.test(lower)) {
    snippets.push("Definition — Porosity: pinholes or small craters in the bead caused by gas trapped in the puddle as it solidifies (Owner's Manual, p. 37).");
    troubleshootingChecks.porosity.forEach((c) => snippets.push(`Manual porosity check: ${c}`));
    refs.push(ownerRef("Troubleshooting and weld diagnosis", "37"));
  }

  if (/\bctwd\b|\bcontact[- ]?tip[- ]?to[- ]?work\b|\bstick[- ]?out\b|\bstickout\b/.test(lower)) {
    snippets.push("Definition — CTWD: contact-tip-to-work distance, the distance from the contact tip inside the gun nozzle to the workpiece.");
    snippets.push("Manual CTWD guidance: maintain 1/2\" or less CTWD (Owner's Manual, p. 35).");
    snippets.push("Manual CTWD guidance: too long → porosity, weak penetration, wandering arc; reduce CTWD.");
    snippets.push("Manual CTWD guidance: too short → wire stubs into the tip; back off slightly.");
    refs.push(ownerRef("Wire Weld diagrams – CTWD", "35"));
    refs.push(ownerRef("Burn-through / inadequate penetration", "36"));
  }

  if (/\bduty[- ]?cycle\b/.test(lower)) {
    snippets.push("Definition — Duty cycle: the percentage of a 10-minute window the welder can run continuously at a given amperage before it needs to cool (Owner's Manual, p. 7).");
    dutyCycleRows.forEach((r) => snippets.push(`Manual duty-cycle row: ${r.input} ${r.amperage} ${r.dutyCycle} → ${r.weldMinutes} min weld / ${r.restMinutes} min rest.`));
    refs.push(ownerRef("Duty cycle ratings", "7"));
  }

  if (/\bpolarity\b/.test(lower)) {
    snippets.push("Definition — Polarity: which welding cable plugs into the positive (+) vs negative (−) socket on the welder. Controls heat distribution between the electrode and workpiece (Owner's Manual, p. 13).");
    (Object.values(polaritySetups)).forEach((p) => {
      snippets.push(`Manual polarity (${p.label}): positive socket = ${p.positive}; negative socket = ${p.negative}; wire feed ${p.wireFeed}.`);
    });
    refs.push(ownerRef("Polarity and connections", "13"));
    refs.push(quickRef("Polarity quick reference", "1"));
  }

  if (/\bmanual\b|\bpage\b|\bp\.\s*\d+/.test(lower)) {
    const pageMatch = lower.match(/\b(?:page|p\.)\s*(\d+)\b/);
    if (pageMatch) {
      const pageNum = pageMatch[1];
      if (pageNum === "37") {
        snippets.push("Manual Page 37: Troubleshooting and weld diagnosis. Covers porosity (pinholes), excessive spatter, wavy beads, and burn-through.");
        refs.push(ownerRef("Wire weld troubleshooting", "37"));
      } else if (pageNum === "13") {
        snippets.push("Manual Page 13: Flux-cored welding setup and DCEN polarity.");
        refs.push(ownerRef("Flux-cored welding setup", "13"));
      } else if (pageNum === "14") {
        snippets.push("Manual Page 14: MIG welding setup and DCEP polarity.");
        refs.push(ownerRef("MIG welding setup", "14"));
      } else if (pageNum === "7") {
        snippets.push("Manual Page 7: Specifications and duty cycle ratings.");
        refs.push(ownerRef("Specifications", "7"));
      } else if (pageNum === "8") {
        snippets.push("Manual Page 8: Front panel controls and connection points.");
        refs.push(ownerRef("Front panel controls", "8"));
      } else if (pageNum === "24") {
        snippets.push("Manual Page 24: TIG setup and DCEN polarity.");
        refs.push(ownerRef("TIG setup polarity", "24"));
      } else if (pageNum === "27") {
        snippets.push("Manual Page 27: Stick setup and DCEP polarity.");
        refs.push(ownerRef("Stick setup polarity", "27"));
      }
    }
  }

  return { snippets, refs };
}

// Builds cause/check/fix items from the live image diagnosis so the
// troubleshooting flow visual reflects what was actually seen in the photo
// (not generic catalog defaults).
function troubleshootingItemsFromDiagnosis(
  d: NonNullable<AgentResponse["imageDiagnosis"]>
): Array<{ cause: string; check: string; fix: string }> {
  const len = Math.max(d.checks.length, d.fixes.length, d.visualClues.length);
  const items: Array<{ cause: string; check: string; fix: string }> = [];
  for (let i = 0; i < len; i++) {
    items.push({
      cause: d.visualClues[i] ?? d.likelyIssue,
      check: d.checks[i] ?? "Inspect the bead and surrounding metal.",
      fix: d.fixes[i] ?? "Adjust based on the cause above."
    });
  }
  return items;
}

// Map planner visual types to UI visual types so the workspace always reflects
// the routed intent and never holds a stale visual from a previous turn.
const plannerVisualToUi: Record<PlannerVisualType, VisualType> = {
  setup_diagram: "polarity",
  duty_cycle_matrix: "duty-cycle",
  process_selection_matrix: "process-selection",
  settings_card: "settings",
  troubleshooting_flow: "troubleshooting",
  image_diagnosis_panel: "image-diagnosis",
  manual_image_card: "manual-image",
  none: "text"
};

// Builds the canonical, ordered list of visuals for this response. The server
// always rebuilds this from the live planner output so the workspace shows
// exactly the right diagrams/tables/flows for the latest turn — never stale
// visuals from a previous question.
function buildVisualsFromPlan(
  plannedVisuals: PlannerVisualType[],
  response: AgentResponse,
  question: string
): VisualSpec[] {
  const out: VisualSpec[] = [];
  const seen = new Set<string>();
  const slotProcess: WeldProcess = response.process;
  // Multi-process awareness: if the question names two or more processes,
  // emit a setup_diagram for each instead of just the planner's primary.
  const mentioned = extractMentionedProcesses(question);
  const setupProcesses: Exclude<WeldProcess, "unknown">[] =
    mentioned.length >= 2
      ? mentioned
      : [slotProcess !== "unknown" ? slotProcess : "flux-core"];

  function pushManualImage(image: ManualImage | undefined, q: string) {
    if (!image) return;
    const key = `manual_image:${image.src}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ kind: "manual_image", image, interpretation: getImageInterpretation(image.src, q) });
  }

  for (const v of plannedVisuals) {
    if (v === "setup_diagram") {
      for (const proc of setupProcesses) {
        const key = `setup_diagram:${proc}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ kind: "setup_diagram", process: proc });
        const wiring = manualImages[processManualImageIndex[proc]];
        pushManualImage(wiring, question);
      }
    } else if (v === "duty_cycle_matrix" && response.dutyCycleRows?.length) {
      out.push({
        kind: "duty_cycle",
        rows: response.dutyCycleRows,
        highlightKey: response.highlightContext?.highlightKey,
        highlightLabel: response.highlightContext?.highlightLabel
      });
    } else if (v === "process_selection_matrix") {
      out.push({ kind: "process_matrix", recommendedProcess: response.recommendedProcess });
    } else if (v === "troubleshooting_flow") {
      out.push({
        kind: "troubleshooting_flow",
        items: response.troubleshootingItems,
        checklist: response.checklist,
        symptom: question
      });
    } else if (v === "manual_image_card") {
      const candidate = response.manualImages?.[0];
      pushManualImage(candidate, question);
    } else if (v === "settings_card" && response.settingRecommendation) {
      out.push({ kind: "settings_card", recommendation: response.settingRecommendation });
    } else if (v === "image_diagnosis_panel" && response.imageDiagnosis) {
      const ref = response.refs?.[0];
      out.push({
        kind: "image_diagnosis",
        diagnosis: response.imageDiagnosis,
        reference: ref ? { title: ref.title, page: ref.page } : undefined
      });
    }
  }

  // Answer-driven page attachment: if the user explicitly named a page,
  // ensure the artifact is present even if the planner didn't request it.
  const pageMatch = question.match(/\b(?:page|p\.)\s*(\d+)\b/i);
  if (pageMatch) {
    const pageNum = pageMatch[1];
    const image = manualImages.find((img) => img.refs.some((r) => r.page === pageNum));
    if (image) pushManualImage(image, question);
  }

  return out;
}

// Answer-driven setup attachment. When Claude's prose describes how to wire
// the welder (ground clamp into +, wire feed cable into −, DCEP/DCEN, etc.)
// but the planner did not classify the question as setup, attach the
// matching setup diagram + manual image so the workspace mirrors the answer.
const WIRING_PART_RE =
  /\b(ground clamp|work lead|electrode holder|wire feed cable|wire-feed cable|torch cable|tig torch|mig gun|stinger)\b/i;
// Note: the parenthesized variants ("positive (+)", "negative (−)") cannot
// use a trailing \b — `)` and the following punctuation are both non-word so
// no word boundary exists. They get their own branch without a trailing \b.
const POLARITY_TARGET_RE =
  /\b(?:dcep|dcen)\b|\b(?:positive|negative)\s+(?:socket|terminal)\b|\b(?:positive|negative)\s*\([\+\-\u2212]\)|\binto\s+(?:the\s+)?(?:positive|negative)\b/i;

function answerDescribesWiring(text: string | undefined): boolean {
  if (!text) return false;
  if (/\bdcep\b|\bdcen\b/i.test(text)) return true;
  return WIRING_PART_RE.test(text) && POLARITY_TARGET_RE.test(text);
}

function attachAnswerDrivenSetupVisuals(
  visuals: VisualSpec[],
  response: AgentResponse,
  question: string,
  intent: PlannerIntent
): VisualSpec[] {
  // Explanation / consequence questions stay visual-less even if the prose
  // names the correct wiring (e.g. "what happens if polarity is reversed in
  // TIG" — the answer mentions DCEN but the user asked a conceptual question).
  if (intent === "explanation") return visuals;
  // Image-diagnosis and manual-image flows already own the workspace.
  if (intent === "weld_image_diagnosis" || intent === "manual_image_question") return visuals;
  if (visuals.some((v) => v.kind === "setup_diagram")) return visuals;
  if (!answerDescribesWiring(response.answer)) return visuals;

  const fromQuestion = extractMentionedProcesses(question);
  const fromAnswer = extractMentionedProcesses(response.answer ?? "");
  // Only fan out to multiple processes when the QUESTION itself named 2+
  // processes (a genuine compare/explain-all). Otherwise restrict to a single
  // primary process so Claude's "use X, not Y" prose mentions don't inflate
  // a single-process recommendation into a comparison table + per-process
  // checklists in the chat bubble. Troubleshooting questions never fan out:
  // "switched from MIG to flux-core and now it's bad" names two processes but
  // only one is currently active — the destination — so the diagnosis should
  // surface a single setup diagram for the active process, not a side-by-side.
  const merged: Array<Exclude<WeldProcess, "unknown">> = [];
  if (fromQuestion.length >= 2 && intent !== "troubleshooting") {
    for (const p of [...fromQuestion, ...fromAnswer]) {
      if (!merged.includes(p)) merged.push(p);
    }
  } else if (response.process !== "unknown") {
    merged.push(response.process);
  } else if (fromAnswer.length > 0) {
    merged.push(fromAnswer[0]);
  } else {
    merged.push("flux-core");
  }

  const out = [...visuals];
  const seen = new Set<string>();
  for (const v of out) {
    if (v.kind === "setup_diagram") seen.add(`setup_diagram:${v.process}`);
    else if (v.kind === "manual_image") seen.add(`manual_image:${v.image.src}`);
  }
  for (const proc of merged) {
    const setupKey = `setup_diagram:${proc}`;
    if (seen.has(setupKey)) continue;
    seen.add(setupKey);
    out.push({ kind: "setup_diagram", process: proc });
    const wiring = manualImages[processManualImageIndex[proc]];
    if (wiring) {
      const imgKey = `manual_image:${wiring.src}`;
      if (!seen.has(imgKey)) {
        seen.add(imgKey);
        out.push({
          kind: "manual_image",
          image: wiring,
          interpretation: getImageInterpretation(wiring.src, question)
        });
      }
    }
  }
  return out;
}

// Garage Setup Tools: append a pre-weld checklist (only when the planner is
// confident about the process and the intent is setup-related) and a warnings
// card (only when the deterministic detector finds something). Both are
// additive — they never replace the primary visual or the text answer.
function augmentVisualsWithGarageTools(
  visuals: VisualSpec[],
  intent: PlannerIntent,
  process: WeldProcess,
  warnings: ReturnType<typeof detectSmartWarnings>
): VisualSpec[] {
  const out = [...visuals];
  const hasChecklist = out.some((v) => v.kind === "pre_weld_checklist");
  // Multi-setup: when the planner emitted setup_diagrams for 2+ processes
  // (multi-process explain/compare), emit one pre_weld_checklist per process
  // so the chat-bubble pager can flip between them.
  const setupProcesses: Array<Exclude<WeldProcess, "unknown">> = [];
  for (const v of out) {
    if (v.kind === "setup_diagram" && !setupProcesses.includes(v.process)) {
      setupProcesses.push(v.process);
    }
  }
  // Pre-weld checklists are pre-build steps (cables, polarity, gas, wire).
  // They are meaningless for troubleshooting / weld-image diagnosis questions,
  // but multi-process explanation questions still need them because the user is
  // asking to understand setup choices side-by-side. The multi-setup trigger
  // is explicitly gated on a non-troubleshooting intent so a regression-after-
  // change question that happens to attach two setup diagrams doesn't drag a
  // pre-build checklist into a diagnosis answer.
  const setupLikeIntent: PlannerIntent[] = ["setup", "polarity", "settings_recommendation"];
  const checklistAllowed =
    setupLikeIntent.includes(intent) || (setupProcesses.length >= 2 && intent !== "troubleshooting");
  if (checklistAllowed && !hasChecklist && setupProcesses.length >= 2) {
    const lastSetupIndex = out.map((v) => v.kind).lastIndexOf("setup_diagram");
    const insertAt = lastSetupIndex >= 0 ? lastSetupIndex + 1 : out.length;
    const checklists: VisualSpec[] = setupProcesses.map((p) => ({ kind: "pre_weld_checklist", process: p }));
    out.splice(insertAt, 0, ...checklists);
  } else if (checklistAllowed && !hasChecklist && process !== "unknown") {
    const setupIndex = out.findIndex((v) => v.kind === "setup_diagram");
    const checklist: VisualSpec = { kind: "pre_weld_checklist", process };
    if (setupIndex >= 0) {
      out.splice(setupIndex + 1, 0, checklist);
    } else {
      out.push(checklist);
    }
  }
  if (warnings.length) {
    out.unshift({ kind: "warnings", warnings });
  }
  return out;
}

function setupRefsFromVisuals(visuals: VisualSpec[]): ManualRef[] {
  const refs: ManualRef[] = [];
  for (const v of visuals) {
    if (v.kind === "setup_diagram") refs.push(...polaritySetups[v.process].refs);
    if (v.kind === "manual_image") refs.push(...v.image.refs);
  }
  return dedupeRefs(refs);
}

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type ChatRequest = {
  messages: ChatMessage[];
  conversationState?: ConversationState;
  image?: {
    data: string;
    mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
  };
};

const responseJsonInstruction = `Return only compact JSON with this shape:
{
  "answer": "Clear, practical explanation. **Bold** important terms. Numbered steps (max 3 unless a full procedure is asked). Optional Tip / Next.",
  "reasoning_summary": "Optional. 1 short sentence on WHY this answer is correct (which chart/diagram/section drove the decision).",
  "highlights": {"process":"optional", "key_setting":"optional (e.g. '200A @ 240V → 25%')", "warning":"optional safety/contradiction warning"},
  "visualType": "polarity" | "duty-cycle" | "troubleshooting" | "manual-image" | "settings" | "process-selection" | "image-diagnosis" | "text",
  "process": "mig" | "flux-core" | "tig" | "stick" | "unknown",
  "refs": [{"title":"...", "source":"Owner's Manual" | "Quick Start Guide" | "Selection Chart", "page":"optional", "url":"..."}],
  "checklist": ["optional troubleshooting steps"],
  "manualImages": [{"title":"...", "description":"...", "src":"...", "refs":[...]}],
  "settingRecommendation": {"process":"mig|flux-core|tig|stick", "material":"...", "thickness":"...", "inputVoltage":"120V|240V", "summary":"...", "steps":["..."], "caution":"optional"},
  "recommendedProcess": "mig|flux-core|tig|stick",
  "imageDiagnosis": {"category":"weld_bead_defect|wiring_setup|front_panel|wire_feed|unknown","likelyIssue":"...","visualClues":["..."],"checks":["..."],"fixes":["..."],"confidence":"low|medium|high","caution":"optional"},
  "troubleshootingItems": [{"cause":"...", "check":"...", "fix":"..."}],
  "highlightContext": {"type":"duty-cycle|polarity|troubleshooting", "highlightKey":"optional", "highlightLabel":"optional", "emphasis":"optional"},
  "followUpPrompts": ["Question 1?", "Question 2?", "Question 3?"]
}

Rules:
- "answer" is REQUIRED and must be a complete, specific answer to the user's question.
- "followUpPrompts" is REQUIRED — always provide exactly 3 short, highly relevant follow-up questions the user is likely to ask next, based on the current topic and conversation history.
- "reasoning_summary" and "highlights" are optional — include only when they add value (warning chip on contradictions, key_setting on duty cycle, etc.).
- For troubleshooting questions, fill "troubleshootingItems" with cause→check→fix triples.
- For duty cycle, fill "highlightContext.highlightKey" as "<voltage>-<amperage>" and "highlightLabel" as "<weld> min weld / <rest> min rest".
- IMPORTANT: write measurements as words inside JSON strings to keep the JSON valid: use "1/8 inch" NOT 1/8" with an inch-mark, and "1/2 inch" NOT 1/2". Unescaped inch-marks break JSON parsing.
- Output ONLY the JSON object — no prose before or after, no markdown code fences.`;

function latestUserMessage(messages: ChatMessage[]) {
  return [...messages].reverse().find((message) => message.role === "user")?.content.trim() ?? "";
}

// Builds a compact conversation transcript for the LLM so it understands
// the full context of the conversation, not just the latest message.
// This is the core fix for follow-up ambiguity: "whats that", "show", "how?"
// are only interpretable with the prior exchange visible.
// We take up to 6 prior turns (3 pairs), trimming the current user message
// so it doesn't appear twice.
function buildConversationHistory(messages: ChatMessage[], currentUserMessage: string): string {
  // All messages except the last user turn (which is injected as "User question (latest)")
  const priorMessages = messages.filter((m) => !(m.role === "user" && m.content.trim() === currentUserMessage.trim()));
  // Take the last 6 messages (3 user+assistant pairs)
  const relevant = priorMessages.slice(-6);
  if (relevant.length === 0) return "";
  const lines = ["CONVERSATION HISTORY (most important for understanding follow-up questions):"];
  for (const msg of relevant) {
    const role = msg.role === "user" ? "User" : "Assistant";
    // Truncate long assistant answers to 200 chars so context stays tight
    const content = msg.role === "assistant" && msg.content.length > 200
      ? msg.content.slice(0, 200) + "..."
      : msg.content;
    lines.push(`${role}: ${content}`);
  }
  lines.push("---");
  lines.push("Use the above history to understand what 'that', 'it', 'the limit', 'show', 'how?' etc. refer to in the latest question.");
  return lines.join("\n");
}

function extractJson(text: string) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return undefined;
  const slice = text.slice(start, end + 1);
  try {
    return JSON.parse(slice);
  } catch {
    // Lenient repair: most common Claude failure is unescaped inch-marks
    // inside string values (e.g. `1/8" steel`), which break JSON.parse.
    try {
      return JSON.parse(repairCommonJsonIssues(slice));
    } catch {
      return undefined;
    }
  }
}

// Escapes inch-marks like `1/8"` that appear inside JSON string values. A
// quote preceded by a digit and NOT followed by a JSON terminator
// (`,` `}` `]` `:` or whitespace + same) is treated as an inch-mark.
function repairCommonJsonIssues(json: string): string {
  return json.replace(/(\d)"(?!\s*[,}\]:])/g, '$1\\"');
}

// Recovers the `answer` value from a malformed JSON blob that we still
// couldn't parse after repair. Returns "" when no answer field can be
// located so the route can fall back cleanly without dumping raw JSON.
function recoverAnswerFromMalformedJson(text: string): string {
  const match = text.match(/"answer"\s*:\s*"([\s\S]*?)"\s*[,\n]\s*"[a-zA-Z_][\w]*"\s*:/);
  if (!match) return "";
  return match[1].replace(/\\n/g, "\n").replace(/\\"/g, '"').replace(/\\\\/g, "\\").trim();
}

// Strips markdown code fences and any embedded JSON block so prose answers
// (when Claude drifts off the JSON contract) come through clean. If the
// text is itself raw JSON we couldn't parse, attempt to recover the
// `answer` field rather than dumping the whole JSON object into the UI.
function cleanProseAnswer(text: string): string {
  let out = text.trim();
  out = out.replace(/^```(?:json|markdown|md)?\s*/i, "").replace(/\s*```$/i, "");
  if (out.startsWith("{") && out.endsWith("}")) {
    const recovered = recoverAnswerFromMalformedJson(out);
    return recovered;
  }
  const jsonStart = out.indexOf("{");
  const jsonEnd = out.lastIndexOf("}");
  if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
    const before = out.slice(0, jsonStart).trim();
    const after = out.slice(jsonEnd + 1).trim();
    const proseOnly = [before, after].filter(Boolean).join("\n\n").trim();
    if (proseOnly.length > 0) out = proseOnly;
  }
  return out.trim();
}

// Streams the value of the `answer` field out of a JSON document as it
// arrives from Claude. On each delta the buffer grows; we re-extract the
// current answer and return only the new suffix so the client can append.
// Tracks whether the closing quote of the answer string has been seen so
// the route can signal "answer text is settled" to the client even though
// Claude is still emitting the rest of the JSON (refs, visualType, etc.).
// Falls back to streaming the raw buffer when Claude drifts off the JSON
// contract and produces prose instead.
class StreamingAnswerExtractor {
  private buffer = "";
  private emittedLen = 0;
  private mode: "unknown" | "json" | "prose" = "unknown";
  private answerComplete = false;

  feed(delta: string): string {
    this.buffer += delta;
    if (this.mode === "unknown") {
      const trimmed = this.buffer.trimStart();
      if (trimmed.length === 0) return "";
      // Treat fenced blocks as JSON-bearing too; the extractor will skip the
      // fence and locate the `"answer"` key when it appears.
      this.mode = trimmed.startsWith("{") || trimmed.startsWith("```") ? "json" : "prose";
    }
    const result =
      this.mode === "json"
        ? this.extractAnswerSoFar()
        : { value: this.buffer, done: false };
    if (result.done) this.answerComplete = true;
    if (result.value.length > this.emittedLen) {
      const out = result.value.slice(this.emittedLen);
      this.emittedLen = result.value.length;
      return out;
    }
    return "";
  }

  isAnswerComplete(): boolean {
    return this.answerComplete;
  }

  private extractAnswerSoFar(): { value: string; done: boolean } {
    const m = /"answer"\s*:\s*"/.exec(this.buffer);
    if (!m) return { value: "", done: false };
    let i = m.index + m[0].length;
    let out = "";
    while (i < this.buffer.length) {
      const c = this.buffer[i];
      if (c === "\\") {
        const next = this.buffer[i + 1];
        if (next === undefined) return { value: out, done: false };
        out += next === "n" ? "\n" : next === "t" ? "\t" : next === "r" ? "\r" : next;
        i += 2;
        continue;
      }
      if (c === '"') return { value: out, done: true };
      out += c;
      i++;
    }
    return { value: out, done: false };
  }
}

// NDJSON sink: each call to write() enqueues one JSON line on the stream so
// the client can parse events incrementally. The route returns this stream
// as the response body and writes status/preview/answer_delta/complete
// events as work progresses.
function createNdjsonStream() {
  const encoder = new TextEncoder();
  let controllerRef: ReadableStreamDefaultController<Uint8Array> | null = null;
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      controllerRef = c;
    }
  });
  return {
    stream,
    write(event: Record<string, unknown>) {
      controllerRef?.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
    },
    close() {
      try {
        controllerRef?.close();
      } catch {
        // already closed
      }
    }
  };
}

// Builds the lightweight preview response surfaced before Claude finishes
// generating. Carries planner-driven visuals AND the manual refs from
// retrieval so source chips appear immediately instead of popping in at the
// very end with the `complete` event.
function buildPreviewResponse(
  question: string,
  outputPlan: OutputPlan,
  hasImage: boolean,
  fallback: AgentResponse,
  refs: AgentResponse["refs"]
): AgentResponse {
  const previewVisuals = buildVisualsFromPlan(
    planVisuals(question, hasImage),
    fallback,
    question
  );
  return {
    answer: "",
    visualType: plannerVisualToUi[outputPlan.visualType],
    process: fallback.process,
    refs,
    visuals: previewVisuals,
    outputPlan
  };
}

function nextStateForResponse(
  question: string,
  response: AgentResponse,
  previousState: ConversationState | undefined,
  resolved: Parameters<typeof nextConversationState>[3]
): ConversationState {
  if (extractMentionedProcesses(question).length >= 2) return {};
  return nextConversationState(question, response, previousState, resolved);
}

export async function POST(request: Request) {
  const body = (await request.json()) as ChatRequest;
  const rawQuestion = latestUserMessage(body.messages);

  if (!rawQuestion) {
    return NextResponse.json({ error: "A user message is required." }, { status: 400 });
  }

  const sink = createNdjsonStream();
  void runChatPipeline(body, rawQuestion, sink).catch((err) => {
    console.error("[chat] pipeline crash", err);
    sink.write({
      type: "complete",
      response: {
        ...localGroundedResponse(rawQuestion),
        warning: "The assistant hit an unexpected error. Please try again."
      }
    });
    sink.close();
  });

  return new Response(sink.stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no"
    }
  });
}

async function runChatPipeline(
  body: ChatRequest,
  rawQuestion: string,
  sink: ReturnType<typeof createNdjsonStream>
) {
  const resolved = resolveConversationalQuestion({
    messages: body.messages,
    question: rawQuestion,
    state: body.conversationState
  });
  const question = resolved.question;
  const outputPlan = await aiPlanOutput({
    message: question,
    hasUploadedImage: Boolean(body.image?.data),
    conversationState: body.conversationState
  });
  const cacheKey = structuredCacheKey(outputPlan, question);

  // Shortcuts (prebuilt answers, response cache, tryDirectResponse) are
  // intentionally bypassed: every request goes to Claude so each answer is
  // grounded in the user's exact question instead of a generic template.

  const context = retrieveManualContext(question);
  const fallback = localGroundedResponse(question);
  const indexedVisual = findManualImageById(outputPlan.visualId);
  const visualFacts = indexedVisual ? indexedVisual.extractedFacts : [];

  // Surface a preview response so the workspace can render the
  // planner-driven visuals (setup diagram, duty-cycle table, etc.) once the
  // answer starts streaming. Refs are intentionally omitted here so source
  // chips attach only after the answer is fully written (they arrive with
  // the `complete` event).
  sink.write({
    type: "preview",
    response: buildPreviewResponse(question, outputPlan, Boolean(body.image?.data), fallback, [])
  });

  // Drop the MIG-only gas/regulator check from the snippets sent to Claude
  // when the question is flux-core porosity. Flux-core is self-shielded, so
  // the manual's gas-bottle check does not apply and would derail the answer.
  const lowerQ = question.toLowerCase();
  const isFluxCorePorosity =
    /\bflux[- ]?core\b|gasless|self[- ]shield/.test(lowerQ) &&
    /\bporosity\b|\bporous\b|\bpinholes?\b|\bbubbles?\b|\bholes?\b/.test(lowerQ);
  if (isFluxCorePorosity) {
    context.snippets = context.snippets.filter(
      (s) => !/cylinder valve|regulator flow|gas hose|drafts at the weld|shielding gas/i.test(s)
    );
  }

  // Definition questions ("what is X / define X") get extra KB-grounded
  // snippets and refs added to the context so Claude can answer directly
  // from the manual. We do NOT short-circuit with a hand-written answer —
  // Claude generates the response, just with richer KB grounding.
  const isDefinition = isDefinitionQuestion(question);
  if (isDefinition) {
    const def = getDefinitionContextSnippets(question);
    if (def.snippets.length) {
      context.snippets.push(...def.snippets);
      context.refs = dedupeRefs([...context.refs, ...def.refs]);
    }
  }

  // Whether the conversation has prior assistant turns (user is following up, not starting fresh).
  // If so, Claude has all the history it needs to infer intent from short messages like "show",
  // "how?", "what's that?" — the clarification short-circuit should be bypassed so Claude
  // can resolve the follow-up using conversation context instead of demanding new info.
  const hasPriorContext = body.messages.some((m) => m.role === "assistant");

  // Ambiguity short-circuit: if the planner detected critical info is missing
  // (vague setup, vague troubleshooting), return a focused 3-bullet
  // clarification instead of guessing. Skips Claude entirely. The user's reply
  // is resolved on the next turn via conversationState.pending.
  // Definition questions bypass this — "what is polarity" should be answered,
  // not pivoted into a setup dialog.
  // Also bypassed when there is prior conversation context — Claude can infer
  // the intent from the history rather than interrupting with a clarification.
  if (
    outputPlan.needsClarification &&
    outputPlan.clarificationQuestion &&
    !body.image?.data &&
    !resolved.resolvedFromPending &&
    !isDefinition &&
    !hasPriorContext
  ) {
    // Use polarity/troubleshooting visualType (not "text") so the existing
    // pending-state machinery in nextConversationState recognizes the question
    // and tracks the missing slot.
    const clarificationVisualType: VisualType =
      outputPlan.intent === "troubleshooting" ? "troubleshooting" : "polarity";
    const clarification: AgentResponse = {
      answer: outputPlan.clarificationQuestion,
      visualType: clarificationVisualType,
      process: outputPlan.process,
      refs: [],
      visuals: [],
      outputPlan
    };
    const conversationState = nextStateForResponse(question, clarification, body.conversationState, resolved);
    console.log("[chat] clarification short-circuit for intent:", outputPlan.intent);
    sink.write({
      type: "complete",
      response: {
        ...clarification,
        conversationState,
        usedModel: "planner-clarification" as const,
        cacheKey
      }
    });
    sink.close();
    return;
  }

  // Manual image / visual request short-circuit. We never call Claude here:
  // either we serve the indexed manual image grounded in the manual, or we
  // honestly say no grounded visual exists for this view. No troubleshooting,
  // no clarification, no generic process dump.
  if (outputPlan.intent === "manual_image_question") {
    const linkedManual = indexedVisual
      ? manualImages.find((image) => image.src === indexedVisual.imagePath)
      : undefined;
    const answer = composeManualImageAnswer(question, indexedVisual, linkedManual);
    const refs: ManualRef[] = indexedVisual ? [getManualImageRef(indexedVisual)] : [];
    const visuals: VisualSpec[] = linkedManual
      ? [{ kind: "manual_image", image: linkedManual, interpretation: getImageInterpretation(linkedManual.src, question) }]
      : [];
    const response: AgentResponse = {
      answer,
      visualType: "manual-image",
      process: outputPlan.process,
      refs,
      visuals,
      manualImages: linkedManual ? [linkedManual] : [],
      outputPlan
    };
    const conversationState = nextStateForResponse(question, response, body.conversationState, resolved);
    sink.write({ type: "answer_delta", delta: answer });
    sink.write({ type: "answer_done" });
    sink.write({
      type: "complete",
      response: {
        ...response,
        conversationState,
        usedModel: "manual-image-grounded" as const,
        cacheKey
      }
    });
    sink.close();
    return;
  }

  if (!process.env.ANTHROPIC_API_KEY && !process.env.GOOGLE_API_KEY && !process.env.GROQ_API_KEY) {
    const conversationState = nextStateForResponse(question, fallback, body.conversationState, resolved);
    const localImage = indexedVisual
      ? manualImages.find((image) => image.src === indexedVisual.imagePath)
      : undefined;
    const localResponse: AgentResponse = {
      ...fallback,
      manualImages: localImage ? [localImage] : fallback.manualImages
    };
    if (outputPlan.intent === "troubleshooting" && !localResponse.troubleshootingItems?.length) {
      localResponse.troubleshootingItems = getTroubleshootingItems(question, outputPlan.slots.process);
    }
    const localPlannedVisuals = planVisuals(question, Boolean(body.image?.data));
    const localPlanVisuals = buildVisualsFromPlan(localPlannedVisuals, localResponse, question);
    const localBaseVisuals = attachAnswerDrivenSetupVisuals(
      localPlanVisuals,
      localResponse,
      question,
      outputPlan.intent
    );
    const localWarnings = detectSmartWarnings(question, localResponse.process);
    const localVisuals = augmentVisualsWithGarageTools(
      localBaseVisuals,
      outputPlan.intent,
      localResponse.process,
      localWarnings
    );
    if (localWarnings.length && !localResponse.highlights?.warning) {
      localResponse.highlights = { ...(localResponse.highlights ?? {}), warning: localWarnings[0].text };
    }
    const responseData = {
      ...localResponse,
      outputPlan,
      visuals: localVisuals,
      conversationState,
      usedModel: "local-fallback" as const,
      cacheKey,
      warning: "Local mode is on. Add ANTHROPIC_API_KEY, GOOGLE_API_KEY, or GROQ_API_KEY to .env and restart to enable AI reasoning."
    };
    sink.write({ type: "complete", response: responseData });
    sink.close();
    return;
  }

  const hasAnthropic = Boolean(process.env.ANTHROPIC_API_KEY);
  const hasGoogle = Boolean(process.env.GOOGLE_API_KEY);
  const hasGroq = Boolean(process.env.GROQ_API_KEY);
  const client = hasAnthropic ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }) : undefined;
  const model = process.env.ANTHROPIC_MODEL ?? "claude-opus-4-7";
  const hasImage = Boolean(body.image?.data);
  const intentKnowledge = getVisualKnowledgeForIntent(outputPlan.intent, outputPlan.slots);
  const prompt = [
    "You are a practical garage-side welding helper for the Vulcan OmniPro 220.",
    "",
    "ANSWER SCOPE (CRITICAL):",
    "- Answer ONLY the user's exact question. Do not pivot to generic process comparisons.",
    "- If the user asks about a specific process (e.g., TIG), answer about that process only.",
    "- Do NOT enumerate all four processes (MIG, flux-core, TIG, stick) unless the user explicitly asked to choose or compare.",
    `- Detected slots — process: ${outputPlan.slots.process}, voltage: ${outputPlan.slots.voltage ?? "unspecified"}, amperage: ${outputPlan.slots.amperage ?? "unspecified"}, topic: ${outputPlan.slots.topic ?? "unspecified"}.`,
    "",
    "GROUNDING RULES (CRITICAL):",
    "- Use ONLY facts from the retrieved manual context below. Do NOT invent ratings, page numbers, or setup values.",
    "- If the user asks for a specific value and it is not in the provided context, say 'The manual does not specify that' and provide what IS known.",
    "- Never use general welding knowledge that is not grounded in the provided context.",
    "- Do not guess at wire speeds, voltages, or amperage values. Always reference the manual or selection chart.",
    "- Only ask for clarification when no reasonable answer is possible from the context. If a likely cause or process is obvious from the question, answer directly.",
    "",
    "TONE:",
    "- Write like you are helping someone in real time: conversational, direct, practical.",
    "- Never say phrases like 'the manual says', 'the manual specifies', or 'according to the manual'.",
    "- Use 'Got it.' as a transition before asking clarifying questions.",
    "",
    "FORMATTING:",
    "- First sentence MUST directly answer the user's question before any list or extra explanation.",
    "- Bold important cable/socket names: **ground clamp → negative (−)**",
    "- Direct questions ('what / where / which / how long'): answer in 1–2 sentences, no numbered steps. Only use numbered steps when the user asks 'how to', 'walk me through', or a multi-part question (max 5 steps).",
    "- Add at most one 'Tip: ...' or one warning. No long paragraphs.",
    "- Use 'Next:' to guide what to do after this task",
    "- Never return only raw tables/lists without a direct answer sentence first.",
    "- For duty-cycle responses, compute weld/rest time FIRST in the answer, then fill highlightContext.highlightKey as '<input>-<amperage>' and highlightContext.highlightLabel as '<weld> min weld / <rest> min rest'.",
    "- For polarity responses, fill highlightContext.emphasis with the key connection pair (example: 'Ground → +, Torch → −').",
    "- For process_selection, set recommendedProcess and explain WHY in one sentence (gas? outdoors? thickness? finish?).",
    "- For troubleshooting, return checklist[] of short imperative steps in cause→check→fix order.",
    "",
    "FACTS (from manual context below):",
    "- Flux-core: ground clamp → positive (+), wire feed cable → negative (−), no shielding gas",
    "- MIG: ground clamp → negative (−), wire feed cable → positive (+), shielding gas required",
    "- TIG: ground clamp → positive (+), TIG torch → negative (−), gas to regulator, foot pedal inside machine, wire feed disconnected",
    "- Stick: ground clamp → negative (−), electrode holder → positive (+), wire feed disconnected",
    "- Duty cycle 120V: 40% at 100A (4 min weld/6 min rest), 100% at 75A (10 min weld/0 rest)",
    "- Duty cycle 240V: 25% at 200A (2.5 min weld/7.5 min rest), 100% at 115A (10 min weld/0 rest)",
    "",
    "VISUAL KNOWLEDGE FACTS (from indexed manual images):",
    visualFacts.map((fact) => `- ${fact}`).join("\n"),
    "",
    intentKnowledge,
    "",
    hasImage
      ? [
        "IMAGE DIAGNOSIS MODE: The user uploaded an image \u2014 analyze it directly.",
        "- Do NOT ask generic clarification questions before diagnosing what you can see.",
        "- Start with the most likely visual diagnosis.",
        "- Compare what you see to the manual's weld diagnosis catalog: porosity, excessive spatter, wavy bead, burn-through, poor penetration, contamination.",
        "- State visible clues, likely causes, and the first checks to run.",
        "- Likely causes to consider: wrong polarity, dirty metal, contaminated wire, shielding gas issue (MIG only), CTWD/stickout/travel speed.",
        "- If uncertain, say so explicitly but still describe what is visible \u2014 never refuse to diagnose just because the photo isn't perfect.",
        "- Set visualType=\"image-diagnosis\" and fill imageDiagnosis with category, likelyIssue, visualClues, checks, fixes, and confidence."
      ].join("\n")
      : "IMAGE: No image is attached. Do NOT mention images, do NOT say 'I don't see an image', and do NOT ask for one.",
    "",
    responseJsonInstruction,
    "",
    `Planned intent: ${outputPlan.intent}`,
    `Planned visual type: ${outputPlan.visualType}`,
    `Planned visual id: ${outputPlan.visualId ?? "none"}`,
    `Detected visual type: ${context.visualType}`,
    `Detected process: ${context.process}`,
    `Tools you may call during reasoning (Claude Agent SDK / MCP): ${vulcanAgentToolNames.join(", ")}. Call lookup_vulcan_manual_context only if the inline manual context below does not already contain the fact you need. Call lookup_vulcan_visual_knowledge only if you need additional indexed visual/diagram facts. Default to the inline context to keep responses fast.`,
    "",
    "Retrieved manual context (use ONLY these facts):",
    context.snippets.map((snippet) => `- ${snippet}`).join("\n"),
    "References:",
    context.refs.map((ref) => `- ${ref.source}: ${ref.title} (${ref.url})`).join("\n"),
    "",
    body.conversationState?.pending
      ? `Clarification state: waiting for ${body.conversationState.pending.missing}. Known so far -> process: ${body.conversationState.pending.process ?? "unknown"}, material: ${body.conversationState.pending.material ?? "unknown"}, thickness: ${body.conversationState.pending.thickness ?? "unknown"}.`
      : "",
    resolved.resolvedFromPending ? `Conversation note: the latest user message "${rawQuestion}" answered the previous clarification. Continue the original question with the resolved detail.` : "",
    "",
    buildConversationHistory(body.messages, rawQuestion),
    "",
    `User question (latest): ${question}`
  ].join("\n");

  // Temporary debug logging for image-diagnosis routing. Never logs the full
  // base64 payload \u2014 only its length so we can confirm it reached the API.
  console.log("[chat] imagePresent:", Boolean(body.image?.data));
  if (body.image?.data) {
    console.log("[chat] imageMediaType:", body.image.mediaType);
    console.log("[chat] base64Length:", body.image.data.length);
  }
  console.log("[chat] intent:", outputPlan.intent);

  try {
    let imageDiagnosis: AgentResponse["imageDiagnosis"] | undefined;
    if (body.image?.data && outputPlan.needsClaudeVision) {
      imageDiagnosis = await analyzeUploadedImage(client, model, body.image.data, body.image.mediaType, question);
    }

    // Inject the pre-computed image diagnosis as text so the agent prompt
    // (string-only) still has the visual interpretation when an image was
    // attached. The raw image is consumed by analyzeUploadedImage above.
    const promptWithDiagnosis = imageDiagnosis
      ? `${prompt}\n\nPre-computed image diagnosis (from vision step):\n${JSON.stringify(imageDiagnosis)}`
      : prompt;

    // First-pass extractor: streams text deltas to the client as Claude
    // generates the JSON response. We only stream the inside of the `answer`
    // field so the client never sees raw JSON braces or other keys.
    // Emits `answer_done` once when the extractor detects the closing quote
    // of the answer field so the client can end the "streaming" indicator
    // even though Claude is still emitting the JSON tail (visualType, refs,
    // etc.). Cuts the perceived latency of the "slow tail" significantly.
    const extractor = new StreamingAnswerExtractor();
    let answerDoneSent = false;
    const callAgent = async (extraInstruction?: string, stream = true) => {
      const finalPrompt = extraInstruction
        ? `${promptWithDiagnosis}\n\nIMPORTANT: ${extraInstruction}`
        : promptWithDiagnosis;
      
      if (hasAnthropic) {
        return runVulcanAgent({
          prompt: finalPrompt,
          systemPrompt,
          model,
          maxTurns: 6,
          onTextDelta: stream
            ? (delta) => {
              const newText = extractor.feed(delta);
              if (newText) sink.write({ type: "answer_delta", delta: newText });
              if (!answerDoneSent && extractor.isAnswerComplete()) {
                answerDoneSent = true;
                sink.write({ type: "answer_done" });
              }
            }
            : undefined
        });
      } else if (hasGoogle) {
        const isDense = hasImage || outputPlan.intent === "troubleshooting" || outputPlan.intent === "weld_image_diagnosis" || outputPlan.intent === "settings_recommendation";
        const geminiModel = isDense ? "gemini-3.1-pro-preview" : "gemini-3.1-flash-lite-preview";

        const { GoogleGenAI } = require("@google/genai");
        const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });
        const responseStream = await ai.models.generateContentStream({
            model: geminiModel,
            contents: `${systemPrompt}\n\n${finalPrompt}`
        });
        
        let fullText = "";
        for await (const chunk of responseStream) {
            const delta = chunk.text;
            if (!delta) continue;
            fullText += delta;
            if (stream) {
              const newText = extractor.feed(delta);
              if (newText) sink.write({ type: "answer_delta", delta: newText });
              if (!answerDoneSent && extractor.isAnswerComplete()) {
                answerDoneSent = true;
                sink.write({ type: "answer_done" });
              }
            }
        }
        return { text: fullText, numTurns: 1, durationMs: 0, toolCalls: 0 };
      } else {
        const Groq = require("groq-sdk");
        const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
        const chatCompletion = await groq.chat.completions.create({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: finalPrompt }
          ],
          model: "llama-3.3-70b-versatile",
          temperature: 0.1,
          stream: true,
        });

        let fullText = "";
        for await (const chunk of chatCompletion) {
          const delta = chunk.choices[0]?.delta?.content || "";
          fullText += delta;
          if (stream && delta) {
            const newText = extractor.feed(delta);
            if (newText) sink.write({ type: "answer_delta", delta: newText });
            if (!answerDoneSent && extractor.isAnswerComplete()) {
              answerDoneSent = true;
              sink.write({ type: "answer_done" });
            }
          }
        }
        return { text: fullText, numTurns: 1, durationMs: 0, toolCalls: 0 };
      }
    };

    let agentResult = await callAgent();
    let text = agentResult.text;
    let parsedJson = extractJson(text);
    let answerText: string = typeof parsedJson?.answer === "string" ? parsedJson.answer : text;

    // Generic-response guard: if Claude returned a multi-process comparison
    // for what should be a specific question, retry once with a corrective
    // instruction. Skip streaming on the retry so the client doesn't see two
    // partial answers — the final `complete` event will replace the streamed
    // first attempt with the corrected text.
    if (isGenericMultiProcessAnswer(answerText) && outputPlan.intent !== "process_selection") {
      sink.write({ type: "answer_reset" });
      agentResult = await callAgent(
        "Answer only the specific question. Do not compare all processes. Stay focused on what the user actually asked.",
        false
      );
      text = agentResult.text;
      parsedJson = extractJson(text);
      answerText = typeof parsedJson?.answer === "string" ? parsedJson.answer : text;
    }

    const parsed = AgentResponseSchema.partial().safeParse(parsedJson);
    const partialData = parsed.success ? parsed.data : undefined;
    // Preserve Claude's response when JSON parsing fails or the model omits
    // "answer". Without this, normalizeAgentResponse falls back to
    // localGroundedResponse, whose generic case ("Tell me what you are setting
    // up or fixing...") leaks into the UI for any question that doesn't match
    // a known visualType (e.g. "what is CTWD").
    const claudeAnswer =
      typeof partialData?.answer === "string" && partialData.answer.trim().length > 0
        ? partialData.answer
        : cleanProseAnswer(text);
    const dataForNormalize: typeof partialData = claudeAnswer
      ? { ...(partialData ?? {}), answer: claudeAnswer }
      : partialData;
    const response = normalizeAgentResponse(question, dataForNormalize);
    const linkedManual = indexedVisual ? manualImages.find((img) => img.src === indexedVisual.imagePath) : undefined;
    if (linkedManual && !response.manualImages?.length) {
      response.manualImages = [linkedManual];
    }
    response.outputPlan = outputPlan;
    // Enforce planner-driven visual selection so the workspace cannot show a
    // stale or mismatched visual from a previous turn or from the model.
    response.visualType = plannerVisualToUi[outputPlan.visualType];
    if (response.visualType === "duty-cycle") {
      response.dutyCycleRows = dutyCycleRows;
    }
    if (outputPlan.visualType === "image_diagnosis_panel") {
      if (imageDiagnosis) {
        response.imageDiagnosis = imageDiagnosis;
        // If Claude fell back to the generic clarification text, replace it
        // with a real diagnosis composed from the imageDiagnosis payload so
        // the user always sees a focused answer when an image is attached.
        if (isGenericClarificationFallback(response.answer)) {
          console.log("[chat] generic fallback detected with image \u2014 substituting imageDiagnosis answer");
          response.answer = composeImageDiagnosisAnswer(imageDiagnosis);
        }
        // Derive cause/check/fix items from the live diagnosis so the
        // troubleshooting flow shows what was actually seen, not a generic
        // catalog default.
        if (!response.troubleshootingItems?.length) {
          response.troubleshootingItems = troubleshootingItemsFromDiagnosis(imageDiagnosis);
        }
      }
      if (!response.answer.toLowerCase().includes("can’t confirm") && !response.answer.toLowerCase().includes("cannot confirm")) {
        response.answer = `${response.answer}\n\nCommon mistake:\n- Over-trusting one photo. Verify polarity, shielding/feed, and clean metal before changing technique.\n\nNext:\n1. Run the checks listed in the diagnosis panel.\n2. Make a short test bead.\n3. Share a clearer close-up if results are still inconsistent.`;
      }
    }
    if (indexedVisual) {
      response.refs = dedupeRefs([...response.refs, getManualImageRef(indexedVisual)]);
    }
    if (outputPlan.intent === "troubleshooting" && !response.troubleshootingItems?.length) {
      response.troubleshootingItems = getTroubleshootingItems(question, outputPlan.slots.process);
    }
    // Always rebuild the visuals[] from the live plan so the workspace cannot
    // carry a stale visual from a prior turn.
    const plannedVisuals = planVisuals(question, Boolean(body.image?.data));
    const planBuiltVisuals = buildVisualsFromPlan(plannedVisuals, response, question);
    const baseVisuals = attachAnswerDrivenSetupVisuals(
      planBuiltVisuals,
      response,
      question,
      outputPlan.intent
    );
    const warnings = detectSmartWarnings(question, response.process);
    response.visuals = augmentVisualsWithGarageTools(
      baseVisuals,
      outputPlan.intent,
      response.process,
      warnings
    );
    if (response.visuals.some((v) => v.kind === "setup_diagram")) {
      response.refs = dedupeRefs([...response.refs, ...setupRefsFromVisuals(response.visuals)]);
    }
    if (warnings.length && !response.highlights?.warning) {
      response.highlights = { ...(response.highlights ?? {}), warning: warnings[0].text };
    }
    const conversationState = nextStateForResponse(question, response, body.conversationState, resolved);

    sink.write({
      type: "complete",
      response: {
        ...response,
        conversationState,
        usedModel: model,
        cacheKey
      }
    });
    sink.close();
  } catch (error) {
    console.error(error);
    const fallbackPlannedVisuals = planVisuals(question, Boolean(body.image?.data));
    const fallbackPlanVisuals = buildVisualsFromPlan(fallbackPlannedVisuals, fallback, question);
    const fallbackBaseVisuals = attachAnswerDrivenSetupVisuals(
      fallbackPlanVisuals,
      fallback,
      question,
      outputPlan.intent
    );
    const fallbackWarnings = detectSmartWarnings(question, fallback.process);
    const fallbackVisuals = augmentVisualsWithGarageTools(
      fallbackBaseVisuals,
      outputPlan.intent,
      fallback.process,
      fallbackWarnings
    );
    if (outputPlan.intent === "troubleshooting" && !fallback.troubleshootingItems?.length) {
      fallback.troubleshootingItems = getTroubleshootingItems(question, outputPlan.slots.process);
    }
    const conversationState = nextStateForResponse(question, fallback, body.conversationState, resolved);
    sink.write({
      type: "complete",
      response: {
        ...fallback,
        visuals: fallbackVisuals,
        outputPlan,
        conversationState,
        usedModel: "local-fallback",
        cacheKey,
        warning: "Claude was unavailable, so I used the built-in setup data."
      }
    });
    sink.close();
  }
}

async function analyzeUploadedImage(
  client: Anthropic | undefined,
  model: string,
  imageData: string,
  mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif",
  question: string
): Promise<AgentResponse["imageDiagnosis"]> {
  const diagnosisCatalog = weldDiagnosisKnowledge
    .map((d) => `- ${d.defect}: cues=[${d.visualCues.join("; ")}]; causes=[${d.likelyCauses.join("; ")}]; fixes=[${d.fixes.join("; ")}]`)
    .join("\n");
  const prompt = `Classify this welding-related image. Compare what you see against the known defect catalog below and return only compact JSON.

Known defect catalog (match cues, then borrow likelyIssue/checks/fixes wording):
${diagnosisCatalog}

JSON shape:
{
  "category": "weld_bead_defect|wiring_setup|front_panel|wire_feed|unknown",
  "likelyIssue": "...",
  "visualClues": ["..."],
  "checks": ["..."],
  "fixes": ["..."],
  "confidence": "low|medium|high",
  "caution": "optional"
}
If unclear, set category=unknown, confidence=low, and caution="I can’t confirm from this image, but here are the checks I’d run first."
User question: ${question}`;

  let text = "";
  if (client) {
    const message = await client.messages.create({
      model,
      max_tokens: 500,
      temperature: 0.1,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image",
              source: { type: "base64", media_type: mediaType, data: imageData }
            }
          ]
        }
      ]
    });
    text = message.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n");
  } else if (process.env.GOOGLE_API_KEY) {
    const { GoogleGenAI } = require("@google/genai");
    const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });
    const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: [
            prompt,
            { inlineData: { data: imageData, mimeType: mediaType } }
        ]
    });
    text = response.text;
  } else {
    const Groq = require("groq-sdk");
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const response = await groq.chat.completions.create({
      model: "meta-llama/llama-4-scout-17b-16e-instruct",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image_url",
              image_url: {
                url: `data:${mediaType};base64,${imageData}`
              }
            }
          ]
        }
      ],
      temperature: 0.1,
    });
    text = response.choices[0]?.message?.content || "";
  }
  const parsed = extractJson(text) as AgentResponse["imageDiagnosis"] | undefined;
  if (!parsed) {
    return {
      category: "unknown",
      likelyIssue: "Image is unclear for confident diagnosis",
      visualClues: ["Limited visual detail", "Angle/lighting makes fault pattern unclear"],
      checks: ["Confirm polarity wiring", "Check gas/feed setup", "Clean and re-test on scrap"],
      fixes: ["Retake close-up image with better lighting"],
      confidence: "low",
      caution: "I can’t confirm from this image, but here are the checks I’d run first."
    };
  }
  return parsed;
}
