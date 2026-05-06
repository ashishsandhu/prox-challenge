import { z } from "zod";
import type { DutyCycleRow, ManualImage, ManualRef, SettingRecommendation, VisualType, WeldProcess } from "@/data/ProductGrounding";
import {
  dedupeRefs,
  dutyCycleRows,
  extractMaterial,
  extractThickness,
  manualImages,
  type ManualImageGuide,
  polaritySetups,
  processManualImageIndex,
  recommendSettings,
  retrieveManualContext,
  troubleshootingChecks
} from "@/data/ProductGrounding";
import { isExplanationQuestion } from "@/engines/IntentRouter";
import type { ChecklistItem } from "@/engines/quickSetup";
import type { SmartWarning } from "@/engines/RiskAssessmentEngine";

export const AgentResponseSchema = z.object({
  answer: z.string(),
  visualType: z.enum(["polarity", "duty-cycle", "troubleshooting", "manual-image", "settings", "process-selection", "image-diagnosis", "text"]),
  process: z.enum(["mig", "flux-core", "tig", "stick", "unknown"]),
  refs: z.array(
    z.object({
      title: z.string(),
      source: z.enum(["Owner's Manual", "Quick Start Guide", "Selection Chart"]),
      page: z.string().optional(),
      url: z.string()
    })
  ),
  checklist: z.array(z.string()).optional(),
  manualImages: z.array(
    z.object({
      title: z.string(),
      description: z.string(),
      src: z.string(),
      refs: z.array(
        z.object({
          title: z.string(),
          source: z.enum(["Owner's Manual", "Quick Start Guide", "Selection Chart"]),
          page: z.string().optional(),
          url: z.string()
        })
      ),
      guide: z.object({
        heading: z.string(),
        steps: z.array(z.string()),
        next: z.string(),
        overlays: z.array(
          z.object({
            label: z.string(),
            x: z.number(),
            y: z.number(),
            w: z.number().optional(),
            h: z.number().optional()
          })
        )
      }).optional()
    })
  ).optional(),
  settingRecommendation: z.object({
    process: z.enum(["mig", "flux-core", "tig", "stick"]),
    material: z.string(),
    thickness: z.string(),
    inputVoltage: z.enum(["120V", "240V"]),
    summary: z.string(),
    steps: z.array(z.string()),
    caution: z.string().optional()
  }).optional(),
  recommendedProcess: z.enum(["mig", "flux-core", "tig", "stick"]).optional(),
  imageDiagnosis: z.object({
    category: z.enum(["weld_bead_defect", "wiring_setup", "front_panel", "wire_feed", "unknown"]),
    likelyIssue: z.string(),
    visualClues: z.array(z.string()),
    checks: z.array(z.string()),
    fixes: z.array(z.string()),
    confidence: z.enum(["low", "medium", "high"]),
    caution: z.string().optional()
  }).optional(),
  troubleshootingItems: z.array(
    z.object({
      cause: z.string(),
      check: z.string(),
      fix: z.string()
    })
  ).optional(),
  outputPlan: z.object({
    intent: z.string(),
    process: z.enum(["mig", "flux-core", "tig", "stick", "unknown"]),
    requiredFacts: z.array(z.string()),
    visualType: z.string(),
    visualId: z.string().optional(),
    needsClaudeVision: z.boolean(),
    needsClarification: z.boolean(),
    clarificationQuestion: z.string().optional(),
    slots: z.object({
      process: z.enum(["mig", "flux-core", "tig", "stick", "unknown"]),
      voltage: z.enum(["120V", "240V"]).optional(),
      amperage: z.number().optional(),
      topic: z.enum(["torch", "ground", "wire feed", "electrode", "gas", "foot pedal"]).optional()
    }).optional()
  }).optional(),
  // Highlighting context for visual components
  highlightContext: z.object({
    type: z.enum(["duty-cycle", "polarity", "troubleshooting"]).optional(),
    highlightKey: z.string().optional(), // e.g., "200A-240V" for duty cycle
    highlightLabel: z.string().optional(), // e.g., "2.5 min weld / 7.5 min rest"
    emphasis: z.string().optional() // Key phrase to emphasize in answer
  }).optional(),
  // Optional reasoning + highlights surfaced in the chat UI.
  reasoning_summary: z.string().optional(),
  highlights: z.object({
    process: z.string().optional(),
    key_setting: z.string().optional(),
    warning: z.string().optional()
  }).optional(),
  followUpPrompts: z.array(z.string()).optional()
});

type ParsedAgentResponse = z.infer<typeof AgentResponseSchema>;
const PartialAgentResponseSchema = AgentResponseSchema.partial();
type PartialParsedAgentResponse = z.infer<typeof PartialAgentResponseSchema>;

// Manual-image interpretation shown above the image so it acts as reasoning
// evidence ("what this image shows / why it matters / what to check") instead
// of decoration.
export type ImageInterpretation = {
  whatItShows: string;
  whyItMatters: string;
  whatToCheck: string;
};

// Discriminated union of UI-renderable visuals. The server builds an ordered
// list per response so the workspace shows exactly the right
// diagram/table/flow/image and never carries a stale visual from a previous
// turn.
export type VisualSpec =
  | { kind: "setup_diagram"; process: Exclude<WeldProcess, "unknown"> }
  | { kind: "duty_cycle"; rows: DutyCycleRow[]; highlightKey?: string; highlightLabel?: string }
  | { kind: "process_matrix"; recommendedProcess?: Exclude<WeldProcess, "unknown"> }
  | {
    kind: "troubleshooting_flow";
    items?: Array<{ cause: string; check: string; fix: string }>;
    checklist?: string[];
    symptom?: string;
  }
  | { kind: "manual_image"; image: ManualImage; interpretation?: ImageInterpretation }
  | { kind: "settings_card"; recommendation: SettingRecommendation }
  | {
    kind: "image_diagnosis";
    diagnosis: NonNullable<ParsedAgentResponse["imageDiagnosis"]>;
    reference?: { title: string; page?: string };
  }
  | {
    kind: "pre_weld_checklist";
    process: Exclude<WeldProcess, "unknown">;
    items?: ChecklistItem[];
    title?: string;
  }
  | { kind: "warnings"; warnings: SmartWarning[] }
  | { kind: "fault_code"; fault: import("@/data/HardwareFaultRegistry").FaultCode };

export type AgentResponse = Omit<ParsedAgentResponse, "manualImages"> & {
  dutyCycleRows?: DutyCycleRow[];
  manualImages?: ManualImage[];
  settingRecommendation?: SettingRecommendation;
  outputPlan?: ParsedAgentResponse["outputPlan"];
  // Ordered visuals for the workspace. When set, the workspace renders only
  // these in order; when unset, the workspace falls back to legacy rendering.
  visuals?: VisualSpec[];
};

// Visual kinds that render inline in the chat bubble (not the workspace), so
// they should not count toward "View visual" affordance or workspace content.
export const CHAT_ONLY_VISUAL_KINDS: ReadonlySet<VisualSpec["kind"]> = new Set([
  "troubleshooting_flow",
  "pre_weld_checklist"
]);

// True when the workspace's Answer tab would render at least one panel for
// this response. Single source of truth shared by the chat bubble (gates the
// "View visual" pill) and the workspace itself (gates the "no visual for this
// answer" empty state). Mirrors every render branch of DiagnosticCanvas's
// answer tab \u2014 keep the two in lockstep.
export function hasWorkspaceVisuals(response?: AgentResponse): boolean {
  if (!response) return false;
  if (response.visuals?.some((v) => !CHAT_ONLY_VISUAL_KINDS.has(v.kind))) return true;
  if (response.visualType === "polarity") return true;
  if (response.visualType === "duty-cycle" && response.dutyCycleRows?.length) return true;
  if (response.visualType === "process-selection") return true;
  if (response.visualType === "image-diagnosis" && response.imageDiagnosis) return true;
  if (response.settingRecommendation) return true;
  if (response.manualImages?.length) return true;
  return false;
}

export function localGroundedResponse(question: string): AgentResponse {
  const context = retrieveManualContext(question);
  const lower = question.toLowerCase();
  const process = context.process;
  const visualType = context.visualType;

  // Explanation / consequence questions ("what happens if polarity is
  // reversed", "why does duty cycle matter") must NOT route to the polarity /
  // troubleshooting / settings branches below \u2014 those return canonical
  // setup answers + checklists, which is the wrong shape for an explanation.
  // Return a minimal grounded text response so Claude's consequence prose is
  // preserved in normalizeAgentResponse without auto-attached visuals.
  if (isExplanationQuestion(question)) {
    return {
      answer: "",
      visualType: "text",
      process,
      refs: context.refs
    };
  }

  if (visualType === "polarity" && process !== "unknown") {
    const setup = polaritySetups[process];
    return {
      answer: setupAnswer(process),
      visualType,
      process,
      refs: setup.refs,
      manualImages: [manualImages[processManualImageIndex[process]]],
      highlightContext: {
        type: "polarity",
        emphasis: `${setup.positive} → +, ${setup.negative} → −`
      }
    };
  }

  if (visualType === "polarity") {
    return {
      answer: "Which process are you setting up: solid-core MIG, gasless flux-core, TIG, or stick?",
      visualType,
      process: "unknown",
      refs: context.refs
    };
  }

  if (visualType === "duty-cycle") {
    const duty = extractDutyCycleMatch(question);
    const highlightLabel = duty ? `${duty.weldMinutes} min weld / ${duty.restMinutes} min rest` : undefined;
    return {
      answer: duty
        ? `At ${duty.amperage} on ${duty.input}, you can weld for ${duty.weldMinutes} minutes, then let it cool for ${duty.restMinutes} minutes.`
        : "Use a 10-minute duty-cycle timer: weld for the rated minutes, then let the machine cool for the rest.",
      visualType,
      process,
      refs: context.refs,
      dutyCycleRows,
      highlightContext: duty
        ? {
          type: "duty-cycle",
          highlightKey: `${duty.input}-${duty.amperage}`,
          highlightLabel
        }
        : undefined
    };
  }

  if (visualType === "troubleshooting") {
    const checklist = /porosity|pinhole|hole/.test(lower)
      ? troubleshootingChecks.porosity
      : /feed|bird/.test(lower)
        ? troubleshootingChecks.wire
        : troubleshootingChecks.badWeld;
    return {
      answer: "Start with polarity, clean metal, and shielding/feed checks before changing technique. Tip: change one thing at a time so you know what fixed it.",
      visualType,
      process,
      refs: context.refs,
      checklist,
      manualImages: /feed|wire|spool/.test(lower) ? [manualImages[1]] : [manualImages[7]]
    };
  }

  if (visualType === "settings") {
    const material = extractMaterial(question);
    const thickness = extractThickness(question);
    const inputVoltage: "120V" | "240V" = /120\s*v|\b120\b/.test(lower) ? "120V" : "240V";

    if (process === "unknown") {
      return {
        answer: "Are you using MIG, TIG, flux-core, or stick?",
        visualType,
        process: "unknown",
        refs: context.refs
      };
    }

    if (!material) {
      return {
        answer: "Got it. What material are you welding?",
        visualType,
        process,
        refs: context.refs
      };
    }

    if (!thickness) {
      return {
        answer: "Got it. What material thickness are you welding?",
        visualType,
        process,
        refs: context.refs
      };
    }

    return {
      answer: `Start with ${process} for ${thickness} ${material}, then tune from a short test bead.`,
      visualType,
      process,
      refs: context.refs,
      manualImages: [manualImages[2]],
      settingRecommendation: recommendSettings({
        process,
        material,
        thickness,
        inputVoltage
      })
    };
  }

  if (visualType === "process-selection") {
    return {
      answer: "Use MIG for easy clean indoor welds, flux-core when you do not have gas or need outdoor welding, TIG for precision, and stick for rugged or thicker dirty material.",
      visualType,
      process,
      refs: context.refs,
      recommendedProcess: process === "unknown" ? "mig" : process
    };
  }

  if (visualType === "manual-image") {
    return {
      answer: "Load the spool so the wire feeds cleanly into the guide, then match the roller and tip to the wire size. Tip: keep the gun lead straight while feeding wire.",
      visualType,
      process,
      refs: context.refs,
      manualImages: [manualImages[1]]
    };
  }

  return {
    answer: "Tell me what you are setting up or fixing, and I will guide the next step.",
    visualType,
    process,
    refs: context.refs
  };
}

export function normalizeAgentResponse(question: string, parsed?: PartialParsedAgentResponse): AgentResponse {
  const fallback = localGroundedResponse(question);
  const parsedManualImages = parsed?.manualImages?.length ? hydrateManualImages(parsed.manualImages) : undefined;
  const merged: AgentResponse = {
    ...fallback,
    ...parsed,
    refs: dedupeRefs(parsed?.refs?.length ? parsed.refs : fallback.refs),
    manualImages: parsedManualImages ?? fallback.manualImages,
    checklist: parsed?.checklist?.length ? parsed.checklist : fallback.checklist,
    settingRecommendation: parsed?.settingRecommendation ?? fallback.settingRecommendation,
    process: (parsed?.process && parsed.process !== "unknown" ? parsed.process : fallback.process) as WeldProcess,
    visualType: (parsed?.visualType ?? fallback.visualType) as VisualType
  };

  // Explanation / consequence questions skip every auto-attach below: no
  // setup-image fan-out, no settings recommendation, no safety-critical
  // setup enforcer (which would replace Claude's consequence prose with the
  // canonical setup recipe whenever the answer mentions the WRONG polarity
  // \u2014 which is exactly what the user is asking about), and no duty-cycle /
  // polarity prepends further down. Also strip every troubleshooting-shaped
  // field so the chat bubble's legacy fallback (visualType==="troubleshooting"
  // + troubleshootingItems/checklist) cannot mount a DiagnosticProtocol
  // under a pure explanation answer. isExplanationQuestion already returns
  // false when EXPLAIN_OVERRIDE_RE matches ("how do I fix", "walk me
  // through", "show me the steps/setup"), so combined queries like "why is
  // my weld cold and how do I fix it" still flow through troubleshooting.
  const explanationMode = isExplanationQuestion(question);
  if (explanationMode) {
    merged.checklist = undefined;
    merged.troubleshootingItems = undefined;
    if (merged.visualType === "troubleshooting") merged.visualType = "text";
  }

  if (merged.visualType === "duty-cycle") merged.dutyCycleRows = dutyCycleRows;
  if (!explanationMode && merged.visualType === "polarity" && merged.process !== "unknown" && !merged.manualImages?.length) {
    merged.manualImages = [manualImages[processManualImageIndex[merged.process]]];
  }
  if (!explanationMode && merged.visualType === "settings" && !merged.settingRecommendation) {
    const process = merged.process === "unknown" ? "mig" : merged.process;
    merged.settingRecommendation = recommendSettings({
      process,
      material: "mild steel",
      thickness: "1/8 inch",
      inputVoltage: "240V"
    });
  }
  if (!explanationMode && merged.visualType === "polarity" && merged.process !== "unknown") {
    merged.answer = enforceSafetyCriticalSetup(merged.process, merged.answer);
  }

  if (merged.manualImages?.length) {
    merged.manualImages = hydrateManualImages(merged.manualImages);
  }

  const duty = merged.visualType === "duty-cycle" ? extractDutyCycleMatch(question) : undefined;
  if (duty && !merged.highlightContext?.highlightKey) {
    merged.highlightContext = {
      ...merged.highlightContext,
      type: "duty-cycle",
      highlightKey: `${duty.input}-${duty.amperage}`,
      highlightLabel: `${duty.weldMinutes} min weld / ${duty.restMinutes} min rest`
    };
  }

  if (
    !explanationMode &&
    merged.visualType === "duty-cycle" &&
    duty &&
    !startsWithDirectAnswer(merged.answer) &&
    !answerAlreadyCoversDutyCycle(merged.answer, duty)
  ) {
    merged.answer = `At ${duty.amperage} on ${duty.input}, you can weld for ${duty.weldMinutes} minutes, then let it cool for ${duty.restMinutes} minutes.\n\n${merged.answer}`;
  }

  if (
    !explanationMode &&
    merged.visualType === "polarity" &&
    merged.process !== "unknown" &&
    !startsWithDirectAnswer(merged.answer) &&
    !answerAlreadyCoversPolarity(merged.answer)
  ) {
    const setup = polaritySetups[merged.process];
    merged.answer = `${processLabel(merged.process)} setup: **${setup.positive} \u2192 +** and **${setup.negative} \u2192 \u2212**.\n\n${merged.answer}`;
  }

  return merged;
}

// True when the answer already addresses polarity directly (mentions a
// + / − assignment in any form). Used to skip the prepend that would
// otherwise duplicate the polarity assertion for concise direct answers.
function answerAlreadyCoversPolarity(answer: string): boolean {
  const lower = answer.toLowerCase();
  const mentionsPositive = /positive|\(\+\)|→\s*\+/.test(lower);
  const mentionsNegative = /negative|\(−\)|\(-\)|→\s*−|→\s*-/.test(lower);
  return mentionsPositive || mentionsNegative;
}

// True when the answer already states the weld/rest time for the matched
// duty-cycle row. Skips the prepend so the same number is not repeated.
function answerAlreadyCoversDutyCycle(answer: string, duty: { weldMinutes: number; restMinutes: number }): boolean {
  const lower = answer.toLowerCase();
  return lower.includes(`${duty.weldMinutes} min`) || lower.includes(`${duty.weldMinutes}-min`) || lower.includes(`${duty.weldMinutes} minute`);
}

function hydrateManualImages(images: NonNullable<PartialParsedAgentResponse["manualImages"]> | ManualImage[]): ManualImage[] {
  return images.map((image) => {
    const canonical = manualImages.find((candidate) => candidate.src === image.src || candidate.title === image.title);
    return {
      ...image,
      guide: image.guide ?? canonical?.guide ?? fallbackGuide(image.title)
    };
  });
}

function fallbackGuide(title: string): ManualImageGuide {
  return {
    heading: title,
    steps: ["Find the highlighted area.", "Match it to your machine.", "Make the connection or adjustment before welding."],
    next: "Do a quick test before starting the real weld.",
    overlays: []
  };
}

function setupAnswer(process: Exclude<WeldProcess, "unknown">) {
  const answers: Record<Exclude<WeldProcess, "unknown">, string> = {
    mig: `Use DCEP for MIG with gas: **ground clamp → negative (−)** and **wire feed cable → positive (+)**.

**Steps:**
1. Turn off and unplug the welder.
2. Plug the ground clamp into the negative socket.
3. Plug the wire feed power cable into the positive socket.
4. Connect shielding gas to the regulator and welder inlet.
5. Test wire feed before welding.

**Tip:** If shielding gas is not connected, the weld will have porosity. Check the cylinder valve and regulator flow.

**Next:** Select MIG on the front panel and set wire speed/voltage for your material thickness.`,
    "flux-core": `Use DCEN for flux-core gasless: **ground clamp → positive (+)** and **wire feed cable → negative (−)**.

**Steps:**
1. Turn off and unplug the welder.
2. Plug the ground clamp into the positive socket.
3. Plug the wire feed power cable into the negative socket.
4. Leave the gas inlet disconnected—do not use shielding gas.
5. Test wire feed before welding.

**Tip:** Flux-core is self-shielded. If you connect gas, the weld will be weak.

**Next:** Select flux-core on the front panel and set wire speed/voltage for your material.`,
    tig: `Use DCEN for TIG: **ground clamp → positive (+)** and **TIG torch → negative (−)**.

**Steps:**
1. Turn off and unplug the welder.
2. Plug the ground clamp into the positive socket.
3. Plug the TIG torch into the negative socket.
4. Leave the wire feed power cable disconnected.
5. Connect the gas line from the cylinder through the regulator to the TIG torch.
6. Plug the foot pedal into the connector inside the welder.

**Tip:** If the wire feed cable is still plugged in, the torch will not work correctly.

**Next:** Select TIG on the front panel, set amperage and gas flow, then test on scrap metal.`,
    stick: `Use DCEP for stick: **electrode holder → positive (+)** and **ground clamp → negative (−)**.

**Steps:**
1. Turn off and unplug the welder.
2. Plug the electrode holder into the positive socket.
3. Plug the ground clamp into the negative socket.
4. Leave the wire feed power cable disconnected—no wire feed is used.
5. Clamp the ground lead directly to clean bare metal.

**Tip:** Clean rust and paint off the contact area so the clamp makes good contact.

**Next:** Select stick on the front panel and set amperage for your electrode rod size.`
  };

  return answers[process];
}

function startsWithDirectAnswer(answer: string) {
  const firstLine = answer.split("\n").find((line) => line.trim().length > 0) ?? "";
  return /\byou can weld for\b|\bsetup:\b|^\s*at\s+\d+/i.test(firstLine);
}

function processLabel(process: Exclude<WeldProcess, "unknown">) {
  return process === "flux-core" ? "Flux-core" : process.toUpperCase();
}

function extractDutyCycleMatch(question: string) {
  const lower = question.toLowerCase();
  const ampMatch = lower.match(/(\d+)\s*a(?:mp)?/i);
  const voltage: "120V" | "240V" = /240/.test(lower) ? "240V" : "120V";
  const rows = dutyCycleRows.filter((row) => row.input === voltage);
  if (!rows.length) return undefined;
  if (!ampMatch) return rows[0];
  const amperage = Number(ampMatch[1]);
  return rows.reduce((best, row) => {
    const rowAmps = Number(row.amperage.replace("A", ""));
    const bestAmps = Number(best.amperage.replace("A", ""));
    return Math.abs(rowAmps - amperage) < Math.abs(bestAmps - amperage) ? row : best;
  }, rows[0]);
}

// True when the answer covers two or more process-specific setups (e.g. the
// user asked "show me the flux-core setup and stick setup"). Used to skip
// the single-process safety enforcer below, which would otherwise mistake
// one process's correct polarity for the OTHER process's wrong polarity and
// clobber the multi-process answer with a single canonical setup block.
function mentionsMultipleProcessSetups(answer: string): boolean {
  const lower = answer.toLowerCase();
  const hits = [
    /\bmig setup\b/.test(lower),
    /\b(flux[\s-]?core)\s+setup\b/.test(lower),
    /\btig setup\b/.test(lower),
    /\bstick setup\b/.test(lower)
  ].filter(Boolean).length;
  return hits >= 2;
}

// Replaces the answer with the canonical setup procedure ONLY when the
// answer contains a clearly WRONG polarity assertion for the process
// (e.g., "ground clamp → negative" for flux-core). A concise correct
// answer like "Plug the ground clamp into the positive (+) terminal" is
// preserved so the answer style rules (1–2 sentences for direct
// questions) are not overridden.
function enforceSafetyCriticalSetup(process: Exclude<WeldProcess, "unknown">, answer: string) {
  // Multi-process answers (e.g. "flux-core setup and stick setup") naturally
  // contain polarity assertions for the OTHER process that look "wrong" for
  // this one. Bail out so the answer is preserved verbatim.
  if (mentionsMultipleProcessSetups(answer)) return answer;
  const wrongPatterns: Record<Exclude<WeldProcess, "unknown">, RegExp[]> = {
    "flux-core": [
      /ground[^.\n]{0,40}(negative|→\s*[−-])/i,
      /wire feed[^.\n]{0,40}(positive|→\s*\+)/i
    ],
    mig: [
      /ground[^.\n]{0,40}(positive|→\s*\+)/i,
      /wire feed[^.\n]{0,40}(negative|→\s*[−-])/i
    ],
    tig: [
      /ground[^.\n]{0,40}(negative|→\s*[−-])/i,
      /tig torch[^.\n]{0,40}(positive|→\s*\+)/i
    ],
    stick: [
      /ground[^.\n]{0,40}(positive|→\s*\+)/i,
      /electrode[^.\n]{0,40}(negative|→\s*[−-])/i
    ]
  };
  const containsWrong = wrongPatterns[process].some((re) => re.test(answer));
  if (containsWrong) return setupAnswer(process);
  return answer;
}
