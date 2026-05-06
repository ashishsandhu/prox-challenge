import type { ConversationState } from "@/core/conversationState";
import { detectProcess, extractMaterial, extractThickness, type WeldProcess } from "@/data/ProductGrounding";

export type PlannerIntent =
  | "setup"
  | "polarity"
  | "duty_cycle"
  | "process_selection"
  | "settings_recommendation"
  | "troubleshooting"
  | "weld_image_diagnosis"
  | "manual_image_question"
  | "wire_loading"
  | "front_panel_controls"
  | "explanation"
  | "general";

export type PlannerVisualType =
  | "setup_diagram"
  | "duty_cycle_matrix"
  | "process_selection_matrix"
  | "settings_card"
  | "troubleshooting_flow"
  | "image_diagnosis_panel"
  | "manual_image_card"
  | "none";

export type SetupTopic = "torch" | "ground" | "wire feed" | "electrode" | "gas" | "foot pedal";

export type PlannerSlots = {
  process: WeldProcess;
  voltage?: "120V" | "240V";
  amperage?: number;
  topic?: SetupTopic;
};

export type OutputPlan = {
  intent: PlannerIntent;
  process: WeldProcess;
  slots: PlannerSlots;
  requiredFacts: string[];
  visualType: PlannerVisualType;
  visualId?: string;
  needsClaudeVision: boolean;
  needsClarification: boolean;
  clarificationQuestion?: string;
};

export function extractSlots(message: string): PlannerSlots {
  const lower = message.toLowerCase();
  const process = detectProcess(message);
  const voltage: PlannerSlots["voltage"] = /\b240\s*v?\b/.test(lower)
    ? "240V"
    : /\b120\s*v?\b/.test(lower)
      ? "120V"
      : undefined;
  const ampMatch = lower.match(/\b(\d{2,3})\s*a(?:mp(?:s|erage)?)?\b/);
  const amperage = ampMatch ? Number(ampMatch[1]) : undefined;

  let topic: SetupTopic | undefined;
  if (/\btig torch\b|\btorch\b/.test(lower)) topic = "torch";
  else if (/\belectrode holder\b|\belectrode\b|\brod\b/.test(lower)) topic = "electrode";
  else if (/\bfoot pedal\b/.test(lower)) topic = "foot pedal";
  else if (/\bground clamp\b|\bwork lead\b|\bground\b/.test(lower)) topic = "ground";
  else if (/\bwire feed\b|\bwire cable\b|\bmig gun\b/.test(lower)) topic = "wire feed";
  else if (/\bgas line\b|\bregulator\b|\bshielding gas\b|\bgas hose\b/.test(lower)) topic = "gas";

  return { process, voltage, amperage, topic };
}

// Strict 5-priority keyword routing. Mentioning a process noun (TIG/MIG/etc.)
// alone never selects process_selection — that branch needs explicit
// choose/compare phrasing or "X vs Y".

const SETUP_RE =
  /\b(connect|connects|connected|connection|connecting|socket|sockets|polarity|ground|torch|electrode|hook ?up|cable|cables|plug|wire feed|wiring|wire (?:up|it up|them up)|how (?:do i|to|can i|should i) wire|setups?|set ?ups?|setting up|where (do|does|should) .* (go|plug|connect))\b/;

const DUTY_RE =
  /\bduty\b|\bweld continuously\b|\bcontinuously at\b|\boverheat(?:ing)?\b|\bthermal shutdown\b|\b\d{2,3}\s*a(?:mp(?:s|erage)?)?\b/;

const TROUBLE_RE =
  /\bporosity\b|\bporous\b|\bpinholes?\b|\bspatter\b|\bproblem\b|\bwrong\b|\bbird.?nest\b|\bburn[- ]through\b|\bdefect\b|\bunstable arc\b|\bcraters?\b|\bholes? in\b|\bbubbles?\b|\bslipping\b|\bno arc\b|\bwon'?t arc\b|\bweak weld\b|\bweld(?:s)? (?:has|have|look|looks|seems?|are)\b/;

// Specific defect nouns. Used to tell apart a real troubleshooting question
// ("my welds have pinholes") from a vague one ("my weld looks bad") that
// cannot be answered without knowing what the user actually sees.
const SPECIFIC_DEFECT_RE =
  /\bporosity\b|\bporous\b|\bpinholes?\b|\bspatter\b|\bbird.?nest\b|\bburn[- ]through\b|\bcraters?\b|\bundercut\b|\bcracking\b|\bcracks?\b|\bunstable arc\b|\bholes? in\b|\bbubbles?\b|\bslipping\b|\bno arc\b|\bwon'?t arc\b|\bweak weld\b|\bdrop[- ]?through\b|\bwavy\b|\btoo (?:hot|cold)\b|\bwon'?t stick\b/;

// Vague trouble phrasing on its own (no defect noun). Examples: "my weld
// looks bad", "something is wrong with my weld", "weld doesn't look right".
const VAGUE_TROUBLE_RE =
  /\bbad weld\b|\bweak weld\b|\bugly weld\b|\bweld(?:s)? (?:looks?|seems?|are) (?:bad|off|wrong|weird|ugly|terrible)\b|\bsomething(?:'s| is) wrong\b|\bdoesn'?t look right\b|\bmessed up\b|\blooks off\b/;

// Regression-after-change cue: the user reports they switched/changed/swapped
// process or material AND describes a degraded result. Example: "I switched
// from MIG to flux-core and now it's bad — why". This phrasing names two
// processes so it would otherwise fall into the multi-process setup branch
// and surface a comparison table; instead it should route to troubleshooting
// with a 1–2 sentence diagnosis (the change itself is the diagnostic hint).
const CHANGE_CUE_RE =
  /\b(?:switch(?:ed|ing)?|chang(?:ed|ing)?|swap(?:ped|ping)?|mov(?:ed|ing)?|went|going)(?:\s+[a-z]+){0,2}\s+(?:from|to|over)\b/;
const REGRESSION_PROBLEM_RE =
  /\b(?:now|since|after|then)\b[^.!?]{0,60}\b(?:bad|worse|broken|won'?t|not working|messed up|terrible|ugly|wrong|off|porous|sooty|sputter(?:ing)?|unstable|no arc)\b|\b(?:weld|bead|result|output|arc|puddle)s?\b[^.!?]{0,30}\b(?:bad|worse|broken|won'?t|not working|messed up|terrible|ugly|wrong|off|porous|sooty|sputter(?:ing)?|unstable)\b/;
function isRegressionAfterChange(lower: string): boolean {
  return CHANGE_CUE_RE.test(lower) && REGRESSION_PROBLEM_RE.test(lower);
}

const PROCESS_SELECTION_RE =
  /\bchoose\b|\bwhich process\b|\bwhat process\b|\bcompare\b|\bbest process\b|\bshould i use\b|\bdifference between\b|\b(mig|tig|flux(?:-?core)?|stick)\s+(vs\.?|versus)\s+(mig|tig|flux(?:-?core)?|stick)\b|\bdon'?t have gas\b/;

// Bare process keyword: user typed ONLY a process name with no other context.
// "mig", "tig", "stick", "flux-core", "flux core", "MIG" etc.
// Treat these as setup requests — they want the polarity diagram and setup steps.
const PROCESS_ONLY_RE =
  /^\s*(mig|tig|stick|flux[- ]?core|flux)\s*$/i;

// Stopped/shutdown/overheated follow-ups — route to duty_cycle so the gauge shows.
const STOPPED_RE =
  /\b(stopped|shut ?down|shut off|turned off|cut out|tripped|overheated?|thermal|fan|cooling|cool down|cooled?)\b/;

// Explanation / consequence questions. These ask "what happens if ...", "why
// ...", "what does X cause/mean/affect", "what are the consequences of ...".
// They must NOT be routed to setup/duty/troubleshooting/settings — those
// branches would attach a checklist or setup diagram and Claude would write
// procedure steps instead of answering the actual question. The explanation
// branch wins over all visual intents so the response is consequence-first
// prose with optional "Correct setup:" / "Why:" / "Next:" lines.
const EXPLANATION_RE =
  /\bwhat happens (?:if|when|after|while)\b|\bwhat (?:does|do) [a-z0-9 \-\/'\u2019]{1,40}(?:cause|mean|affect|do to)\b|\bwhat does (?:it|that) mean\b|\bwhat (?:is|are) the (?:effect|effects|impact|impacts|consequence|consequences|result|results)\b|\bwhy (?:does|do|is|are|would|should|can[\'\u2019]?t|won[\'\u2019]?t|doesn[\'\u2019]?t|don[\'\u2019]?t)\b|\bwhy do i need\b/;

// Phrases that pull a question OUT of the explanation branch even when the
// user also asks "why" / "what happens if". Lets a combined question like
// "why is my weld cold and how do I fix it" still surface the troubleshooting
// flow. Keep this list narrow — we only override on explicit fix / setup /
// step-by-step requests.
const EXPLAIN_OVERRIDE_RE =
  /\bhow (?:do i|to|can i|should i) (?:fix|repair|resolve|correct|set ?up|wire|connect)\b|\bwalk me through\b|\bshow me (?:the )?(?:steps|setup|diagram|wiring)\b|\bstep[- ]by[- ]step\b/;

// True when the message is asking for an explanation / consequence rather
// than a setup, duty-cycle, troubleshooting, or settings answer. Exported so
// the agent-response normalizer can skip auto-attached setup recipes for
// explanation questions.
export function isExplanationQuestion(message: string): boolean {
  const lower = message.toLowerCase();
  if (EXPLAIN_OVERRIDE_RE.test(lower)) return false;
  return EXPLANATION_RE.test(lower);
}

// "Show / display / open / pull up / give me ..." paired with a visual noun
// (image, diagram, visual, manual page, picture, photo, figure, chart,
// illustration, panel, controls). Intentionally narrow: it routes only when
// the user explicitly asks to see something, not when they ask how to do
// something.
const SHOW_VERB_RE =
  /\b(show|display|open|pull up|bring up|give me|see|view|look at|find me)\b/;
const VISUAL_NOUN_RE =
  /\b(image|images|diagram|diagrams|visual|visuals|manual page|manual pages|picture|pictures|photo|photos|figure|figures|chart|charts|illustration|illustrations|panel|controls)\b/;
// "Draw / create / make / sketch / render / generate / build" — the user wants
// a generated diagram, not a manual image. These verbs keep the request on
// the setup_diagram path even when "diagram" appears in the sentence.
const GENERATED_VERB_RE = /\b(draw|create|make|sketch|render|generate|build|design)\b/;
// Weld-appearance terms route a manual-image request to the weld-diagnosis
// page (Owner's Manual p.37).
const WELD_APPEARANCE_RE =
  /\b(weld appearance|weld defects?|porosity|porous|pinholes?|spatter|burn[- ]through|wavy bead|poor penetration|weld diagnosis|bad weld|defects?)\b/;
// Front panel / controls terms route to the front-panel-controls page.
const FRONT_PANEL_RE = /\b(front panel|knobs?|buttons?|lcd|labels?)\b/;

function isManualImageRequest(lower: string): boolean {
  return SHOW_VERB_RE.test(lower) && VISUAL_NOUN_RE.test(lower) && !GENERATED_VERB_RE.test(lower);
}

// Picks an indexed manual-image id from the user's phrasing. Order matters:
// weld appearance wins over front panel, which wins over process-specific
// wiring. Returns undefined when no grounded image fits — the route then
// returns an honest "no manual image indexed" answer.
function selectManualImageId(lower: string, process: WeldProcess): string | undefined {
  if (WELD_APPEARANCE_RE.test(lower)) return "weld-diagnosis";
  if (FRONT_PANEL_RE.test(lower)) return "front-panel-controls";
  if (/\bduty cycle\b/.test(lower)) return "duty-cycle-chart";
  if (/\bwire (?:loading|feed)\b|\bspool\b|\bdrive roller\b/.test(lower)) return "wire-feed-interior";
  if (/\bselection chart\b|\bprocess selection\b/.test(lower)) return "process-selection-chart";
  if (process !== "unknown") return `${process}-setup-diagram`;
  return undefined;
}

export function planOutput({
  message,
  hasUploadedImage,
  conversationState
}: {
  message: string;
  hasUploadedImage: boolean;
  conversationState?: ConversationState;
}): OutputPlan {
  const lower = message.toLowerCase();
  const slots = extractSlots(message);
  const process = slots.process;
  const mentionedProcesses = extractMentionedProcesses(message);

  // 1. Uploaded image -> image_diagnosis (highest priority)
  if (hasUploadedImage) {
    const isExplicitManualRequest = isManualImageRequest(lower);
    return {
      intent: !isExplicitManualRequest ? "weld_image_diagnosis" : "manual_image_question",
      process,
      slots,
      requiredFacts: ["Image classification", "Visible cues", "Safety-relevant checks"],
      visualType: !isExplicitManualRequest ? "image_diagnosis_panel" : "manual_image_card",
      visualId: selectManualImageId(lower, process) ?? "weld-diagnosis",
      needsClaudeVision: !isExplicitManualRequest,
      needsClarification: false
    };
  }

  // 2. Manual image / visual request — high priority. "Show me the manual
  //    image / diagram / visual / panel" wins over setup and troubleshooting
  //    so we serve the indexed manual page instead of a generated diagram or
  //    a generic checklist. "Draw / create / make / sketch ..." is excluded
  //    so generated-diagram requests still hit the setup branch below.
  if (isManualImageRequest(lower)) {
    const visualId = selectManualImageId(lower, process);
    return {
      intent: "manual_image_question",
      process,
      slots,
      requiredFacts: ["Show the indexed manual image grounded in the manual."],
      visualType: "manual_image_card",
      visualId,
      needsClaudeVision: false,
      needsClarification: false
    };
  }

  // 3. Explanation / consequence ("what happens if polarity is reversed",
  //    "why does flux-core not need gas", "what does CTWD affect"). Wins over
  //    setup/duty/troubleshooting/settings so the answer is consequence-first
  //    prose with no auto-attached checklist or setup diagram. The override
  //    inside isExplanationQuestion lets combined questions like "why is my
  //    weld cold and how do I fix it" still fall through to troubleshooting.
  if (isExplanationQuestion(message)) {
    return {
      intent: "explanation",
      process,
      slots,
      requiredFacts: ["Explain the consequence or reason in 1\u20132 sentences", "Optional corrective setup or next step"],
      visualType: "none",
      visualId: undefined,
      needsClaudeVision: false,
      needsClarification: false
    };
  }

  // 4. Setup / polarity (BEFORE process_selection so a TIG/MIG mention does not
  //    trigger the comparison matrix). Skipped when the same message also
  //    carries an explicit defect noun ("porosity", "spatter") or the verb
  //    "troubleshoot" — those phrasings ("troubleshoot mig setup porosity")
  //    are diagnosis questions that happen to mention setup, not setup
  //    questions, so we let the troubleshooting branch below own them.
  const troubleTakesPrecedence =
    /\btroubleshoot(?:ing)?\b/.test(lower) || SPECIFIC_DEFECT_RE.test(lower) || isRegressionAfterChange(lower);
  if (SETUP_RE.test(lower) && !troubleTakesPrecedence) {
    const isMultiProcessSetup = mentionedProcesses.length >= 2;
    const needsClarification = process === "unknown" && !isMultiProcessSetup && !conversationState?.pending;
    const setupVisualId = process !== "unknown" && !isMultiProcessSetup ? `${process}-setup-diagram` : undefined;
    return {
      intent: "setup",
      process,
      slots,
      requiredFacts: ["Correct polarity mapping", "Cable destination sockets", "Process-specific gas requirement"],
      visualType: needsClarification ? "none" : "setup_diagram",
      visualId: setupVisualId,
      needsClaudeVision: false,
      needsClarification,
      clarificationQuestion: needsClarification
        ? [
          "Happy to walk you through the setup \u2014 a couple of quick details first:",
          "- Which process are you using (MIG, flux-core, TIG, or stick)?",
          "- Do you have shielding gas available?",
          "- What material are you welding?",
          "",
          "Once I have that, I\u2019ll give you the exact cable diagram and steps."
        ].join("\n")
        : undefined
    };
  }

  // Multi-process explain/describe questions without explicit setup words:
  // "explain flux-core and MIG", "talk about all four processes". These
  // should still render setup diagrams, a comparison table, and pre-weld
  // checklists because the useful answer is visual/comparative.
  if (mentionedProcesses.length >= 2 && !troubleTakesPrecedence) {
    return {
      intent: "setup",
      process,
      slots,
      requiredFacts: ["Brief process descriptions", "Per-process setup comparison", "Pre-weld checks"],
      visualType: "setup_diagram",
      visualId: undefined,
      needsClaudeVision: false,
      needsClarification: false
    };
  }

  // 3. Duty cycle
  if (DUTY_RE.test(lower)) {
    return {
      intent: "duty_cycle",
      process,
      slots,
      requiredFacts: ["Input voltage", "Amperage row", "Weld/rest minutes in 10-minute window"],
      visualType: "duty_cycle_matrix",
      visualId: "duty-cycle-chart",
      needsClaudeVision: false,
      needsClarification: false
    };
  }

  // 4. Troubleshooting. If only vague phrasing matched (no specific defect
  //    noun like porosity/spatter/burn-through), we cannot diagnose without
  //    guessing. Ask for the defect type or a photo instead of returning a
  //    generic checklist. Regression-after-change ("switched from MIG to
  //    flux-core and now it's bad") is a special case: the change itself is
  //    the diagnostic hint, so we route straight to the troubleshooting flow
  //    without asking the user to name a defect.
  if (isRegressionAfterChange(lower)) {
    return {
      intent: "troubleshooting",
      process,
      slots,
      requiredFacts: ["Likely cause tied to the recent process/material change", "Checks in order", "Manual diagnosis references"],
      visualType: "troubleshooting_flow",
      visualId: "weld-diagnosis",
      needsClaudeVision: false,
      needsClarification: false
    };
  }
  if (TROUBLE_RE.test(lower) || VAGUE_TROUBLE_RE.test(lower)) {
    const hasSpecificDefect = SPECIFIC_DEFECT_RE.test(lower);
    if (!hasSpecificDefect) {
      return {
        intent: "troubleshooting",
        process,
        slots,
        requiredFacts: ["Defect type", "Process", "Image (optional)"],
        visualType: "none",
        visualId: undefined,
        needsClaudeVision: false,
        needsClarification: true,
        clarificationQuestion: [
          "Got it \u2014 let me narrow it down. A couple of details would help:",
          "- What does the bead actually look like (pinholes, spatter, burn-through, wavy, bird-nesting)?",
          "- Which process are you running (MIG, flux-core, TIG, or stick)?",
          "- If you can, snap a close-up photo and I\u2019ll diagnose it directly."
        ].join("\n")
      };
    }
    return {
      intent: "troubleshooting",
      process,
      slots,
      requiredFacts: ["Likely causes", "Checks in order", "Manual diagnosis references"],
      visualType: "troubleshooting_flow",
      visualId: "weld-diagnosis",
      needsClaudeVision: false,
      needsClarification: false
    };
  }

  // 5. Process selection — only explicit choose/compare/X-vs-Y phrasings.
  if (PROCESS_SELECTION_RE.test(lower)) {
    return {
      intent: "process_selection",
      process,
      slots,
      requiredFacts: ["Process comparison matrix", "Gas/outdoor constraints", "Material target"],
      visualType: "process_selection_matrix",
      visualId: "process-selection-chart",
      needsClaudeVision: false,
      needsClarification: false
    };
  }

  // 6. Bare process keyword — "mig", "tig", "stick", "flux-core" alone.
  //    User wants the setup/polarity diagram for that process.
  if (PROCESS_ONLY_RE.test(lower) && process !== "unknown") {
    return {
      intent: "setup",
      process,
      slots,
      requiredFacts: ["Correct polarity mapping", "Cable destination sockets", "Process-specific gas requirement"],
      visualType: "setup_diagram",
      visualId: `${process}-setup-diagram`,
      needsClaudeVision: false,
      needsClarification: false
    };
  }

  // 7. Stopped / shutdown / overheated — route to duty_cycle so gauge renders.
  if (STOPPED_RE.test(lower)) {
    return {
      intent: "duty_cycle",
      process,
      slots,
      requiredFacts: ["Duty cycle limits", "Thermal overload behaviour", "Recovery steps"],
      visualType: "duty_cycle_matrix",
      visualId: "duty-cycle-chart",
      needsClaudeVision: false,
      needsClarification: false
    };
  }

  // 8. General — no visual; Claude answers the exact question.
  return {
    intent: "general",
    process,
    slots,
    requiredFacts: ["Answer the user's exact question"],
    visualType: process !== "unknown" ? "setup_diagram" : "none",
    visualId: process !== "unknown" ? `${process}-setup-diagram` : undefined,
    needsClaudeVision: false,
    needsClarification: false
  };
}

export function structuredCacheKey(plan: OutputPlan, message: string) {
  const material = extractMaterial(message) ?? "unknown-material";
  const thickness = extractThickness(message) ?? "unknown-thickness";
  const amp = message.toLowerCase().match(/(\d+)\s*a(?:mp)?/)?.[1] ?? "unknown-amp";
  const voltage = /240/.test(message) ? "240V" : /120/.test(message) ? "120V" : "unknown-voltage";
  return [plan.intent, plan.process, voltage, amp, material, thickness].join("|").toLowerCase();
}

const WIRE_LOADING_RE = /\b(load(?:ing)?|spool|drive roller|wire feed compartment|wire tension|liner)\b/;
const SETTINGS_RE = /\b(setting|settings|recommend|wire speed|voltage setting|thickness|gauge|ga\b|mild steel|stainless|aluminum|1\/8|3\/16|1\/4)\b/;

// "All four setups", "every process", "show me all of them" — collective
// phrasing that should expand to every welding process the welder supports.
// Accept both "setup" and "set up" spellings because users often write
// "all the four set ups" while standing in front of the machine.
const ALL_PROCESSES_RE =
  /\ball (?:the )?(?:four|4)?\s*(?:welding\s*)?(?:setups?|set\s*ups?|processes?|modes?)\b|\bevery (?:welding\s*)?(?:process|setup|set\s*up|mode)\b|\b(?:all|each) of (?:them|the (?:four|4 )?(?:processes|setups?|set\s*ups?))\b|\bfour (?:welding\s*)?(?:processes|setups?|set\s*ups?)\b/;

const ALL_PROCESSES: Array<Exclude<WeldProcess, "unknown">> = ["mig", "flux-core", "tig", "stick"];

// Returns every welding process the user named, in order of first appearance.
// Recognizes synonyms (gmaw, fcaw, gtaw, smaw, gasless, solid-core) and the
// collective phrases captured by ALL_PROCESSES_RE (which expands to all four).
// Shared by the API route (for visual fan-out) and the planner (for visual
// triggering on multi-process explain/compare questions).
export function extractMentionedProcesses(message: string): Array<Exclude<WeldProcess, "unknown">> {
  const lower = message.toLowerCase();
  if (ALL_PROCESSES_RE.test(lower)) return [...ALL_PROCESSES];
  const patterns: Array<[Exclude<WeldProcess, "unknown">, RegExp]> = [
    ["flux-core", /\bflux[\s-]?core(?:d)?\b|\bfcaw\b|\bgasless\b/g],
    ["mig", /\bmig\b|\bgmaw\b|\bsolid[\s-]?core\b/g],
    ["tig", /\btig\b|\btiug\b|\bgtaw\b/g],
    ["stick", /\bstick\b|\bsmaw\b/g]
  ];
  const hits: Array<{ process: Exclude<WeldProcess, "unknown">; index: number }> = [];
  for (const [process, regex] of patterns) {
    const match = regex.exec(lower);
    if (match) hits.push({ process, index: match.index });
  }
  hits.sort((a, b) => a.index - b.index);
  return hits.map((h) => h.process);
}

// Multi-visual planner: returns the ordered visuals to render for this message.
// Always derived from the live message — never carries state from prior turns.
//
// Regression cases (these MUST stay green):
//
//  1. "I'm welding 1/8 steel outdoors with no gas at 200A on 240V. Which
//     process should I use, how should I wire it, and how long can I weld?"
//     -> [process_selection_matrix, setup_diagram(flux-core), duty_cycle_matrix]
//
//  2. "My flux-core welds have pinholes and look porous. What's wrong?"
//     -> [troubleshooting_flow, manual_image_card(weld diagnosis)]
//
//  3. "If I'm running 200A on 240V, how long can I weld?"
//     -> [duty_cycle_matrix]   (no stale setup diagram)
//
//  4. "I'm setting up flux-core outdoors with no gas. Where exactly do my
//     cables go?"
//     -> [setup_diagram(flux-core)]   (no stale duty cycle)
export function planVisuals(message: string, hasUploadedImage: boolean): PlannerVisualType[] {
  // Uploaded image -> diagnosis panel + cause/check/fix flow + the manual's
  // weld-diagnosis reference page (so the image becomes reasoning evidence,
  // not just decoration).
  if (hasUploadedImage) return ["image_diagnosis_panel", "troubleshooting_flow", "manual_image_card"];

  const lower = message.toLowerCase();
  const slots = extractSlots(message);

  // Manual image / visual request — short-circuit so the workspace shows the
  // indexed manual page only (no setup diagram, no checklist).
  if (isManualImageRequest(lower)) return ["manual_image_card"];

  // Explanation / consequence questions — no auto-attached visuals. Answer
  // is consequence-first prose. The user can ask a follow-up like "how do I
  // fix it" or "show me the setup" to get the relevant visual on the next
  // turn (those phrases are picked up by EXPLAIN_OVERRIDE_RE so a combined
  // question still routes through the visual branches below).
  if (isExplanationQuestion(message)) return [];

  const visuals: PlannerVisualType[] = [];

  const isSetup = SETUP_RE.test(lower);
  const isDuty = DUTY_RE.test(lower);
  const isTrouble = TROUBLE_RE.test(lower) || isRegressionAfterChange(lower);
  const isProcessChoice = PROCESS_SELECTION_RE.test(lower);
  const isWireLoading = WIRE_LOADING_RE.test(lower);
  const isSettings = SETTINGS_RE.test(lower) && !isSetup && !isDuty && !isTrouble;

  // Process choice goes first when explicitly asked OR implied by "no gas /
  // outdoors" combined with setup/duty context.
  if (isProcessChoice || (/(no gas|don'?t have gas|outdoors|outside)/.test(lower) && (isSetup || isDuty))) {
    visuals.push("process_selection_matrix");
  }

  if (isTrouble) visuals.push("troubleshooting_flow");

  if (isSetup && slots.process !== "unknown") visuals.push("setup_diagram");
  // Implied flux-core setup from "no gas / outdoors" + cable phrasing.
  else if (isSetup && /(no gas|don'?t have gas|outdoors|outside)/.test(lower)) visuals.push("setup_diagram");
  // Multi-process explain / compare: when the user names 2+ processes (or
  // says "all setups" / "every process"), force a setup_diagram so the
  // workspace + chat-bubble comparison table render even without explicit
  // setup keywords ("explain flux core and tig", "show me all four setups").
  // Skipped on troubleshooting questions — a porosity/spatter question that
  // happens to mention two processes is NOT a setup comparison.
  else if (!isTrouble && extractMentionedProcesses(message).length >= 2) visuals.push("setup_diagram");

  if (isDuty) visuals.push("duty_cycle_matrix");

  if (isWireLoading) visuals.push("manual_image_card");

  if (isSettings) visuals.push("settings_card");

  // Troubleshooting always pairs with the weld diagnosis manual image so the
  // visual cue (porosity holes, spatter, etc.) becomes reasoning evidence.
  if (isTrouble && !visuals.includes("manual_image_card")) visuals.push("manual_image_card");

  // Empty -> no visual (chat-only answer).
  return visuals;
}
