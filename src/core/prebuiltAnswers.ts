import type { AgentResponse } from "@/core/agentResponse";
import type { ConversationState } from "@/core/conversationState";
import { manualImages, manualRefs, ownerRef, quickRef, selectionRef } from "@/data/ProductGrounding";

// Prebuilt high-frequency answers to skip retrieval entirely

const processSelectionGuide = `Choose based on where you're working and what you need:

**MIG** (solid-core, gas-shielded): Best for clean indoor work with shielding gas. Produces clean beads with less spatter. **Ground clamp → negative**, **wire feed cable → positive**.

**Flux-core** (gasless): Practical for outdoors or when you don't have shielding gas. Self-shielded wire, more spatter but forgiving. **Ground clamp → positive**, **wire feed cable → negative**.

**Stick** (SMAW): Useful for thicker material, dirty/rusty surfaces, and outdoor work. Slower but tough. **Electrode holder → positive**, **ground clamp → negative**.

**TIG** (tungsten): For precision and clean welds, especially on stainless and aluminum. Slower and requires separate torch, gas, and foot pedal. **TIG torch → negative**, **ground clamp → positive**.

Start with the selection chart: if the material and thickness are available, it will guide you on which process makes sense. Next step after choosing: connect the cables using the setup diagram for your process.`;

const dutyCycleExplanation = `At 200A on 240V, you can weld for 2.5 minutes, then let the machine cool for 7.5 minutes.

Duty cycle is the percentage of a 10-minute window you can weld before resting to let the welder cool:

**120V input:**
- At 100A: 40% duty (4 min weld, 6 min rest)
- At 75A: 100% duty (weld continuously)

**240V input:**
- At 200A: 25% duty (2.5 min weld, 7.5 min rest)
- At 115A: 100% duty (weld continuously)

If you exceed duty cycle limits, the machine will throttle or shut down to prevent overheating. To reduce rest time, either lower the amperage or use 240V for more power.`;

const polarity101 = `Polarity determines which cable connects to the positive socket and which to negative:

- **Positive socket** (hot, typically on the right) supplies power to the electrode/torch/wire
- **Negative socket** (ground return, typically on the left) connects to the workpiece via the ground clamp

Different processes use opposite polarities:
- **MIG**: ground clamp → negative, wire feed cable → positive
- **Flux-core**: ground clamp → positive, wire feed cable → negative
- **TIG**: TIG torch → negative, ground clamp → positive
- **Stick**: electrode holder → positive, ground clamp → negative

Wrong polarity will produce a weak or unstable arc, poor penetration, or excessive spatter. Check the front panel diagram and the setup guide for your process.`;

const wireLoadingGuide = `Here's how to load the wire spool correctly:

1. Slide the spool onto the spindle so wire unwinds from the bottom toward the inlet guide
2. Run the wire through both feed guides (the upper and lower wheels that guide the wire)
3. Place the wire against the tension adjustment screw, then tighten until the wire bends 2–3 inches away from the tension point (not too tight or you'll crush it)
4. Feed a few inches of cold wire (with power off) to confirm smooth feeding through the liner
5. Trim off the tip cleanly where it exits the contact tip socket
6. Connect the contact tip and nozzle, set your process, and you're ready to weld

Common mistake: Threading the wire over the spool instead of under it, which causes feeding problems and bird-nesting.`;

const troubleshootingPortosity = `Porosity (small holes in the bead) usually points to shielding or polarity issues:

1. **Check polarity first** – incorrect polarity causes instability and porosity
2. **For MIG (gas-shielded):**
   - Verify gas cylinder is open and regulator is set to 20–30 SCFH
   - Check gas hose for kinks or leaks; replace if cracked
   - Clean the nozzle to remove spatter blockage
   - Reduce drafts and wind around the weld area
   - Clean the workpiece of oil, paint, or rust
3. **For flux-core (gasless):**
   - Confirm you're using self-shielded flux-core wire (not solid-core that needs gas)
   - Check polarity is correct: ground clamp positive, wire cable negative
   - Clean the joint area thoroughly
4. **General fixes:**
   - Trim the contaminated end of wire and re-feed
   - Check the contact tip for wear or deformation
   - Reduce stick-out (distance from nozzle to workpiece) to keep the puddle protected
   - Make one small test bead to see what changed`;

const troubleshootingWireFeed = `Wire feed or bird-nesting issues usually come from spool loading or tension:

1. **Check the spool direction** – wire should unwind from the bottom, not over the top
2. **Verify drive roller and contact tip match wire diameter** – mismatches cause slipping or jamming
3. **Adjust tension** – too loose causes slipping, too tight crushes the wire
4. **Keep the gun cable straight** when loading wire – coils and kinks cause binding
5. **Use cold feed test** (power off, trigger feed) – if it jams, re-seat the wire and start over
6. **Replace the contact tip if worn** – worn tips have rough edges that catch the wire
7. **Check the wire liner** for debris or damage – if cracked, it can cause feeding resistance

After each fix, do a cold feed test before welding.`;

const troubleshootingBadWelds = `Bad weld appearance (weak, porosity, spatter, burn-through) usually traces back to three things:

1. **Polarity** – check it matches the process
2. **Settings** – wire speed and voltage should match material thickness and process
3. **Contact** – clean clamp contact point and clamp directly to steel, not rust or mill scale

Adjustment sequence:
1. Check and fix polarity if wrong
2. Verify settings on the selection chart for your material and thickness
3. Clean the work clamp contact point and move the clamp closer to the joint
4. Inspect: contact tip, nozzle, electrode – replace if worn or cracked
5. Make one small test weld after each adjustment so you know what fixed it

Do not make multiple changes at once, or you won't know which one worked.`;

export const prebuiltAnswers: Record<string, AgentResponse> = {
    process_selection: {
        answer: `Use MIG if you want easiest clean indoor welds. Use flux-core if you do not have gas or are outdoors. Use TIG for precision clean welds. Use stick for rugged or thicker/dirty material.\n\n${processSelectionGuide}`,
        visualType: "process-selection",
        process: "unknown",
        recommendedProcess: "mig",
        refs: [
            selectionRef("Welding process selection chart"),
            selectionRef("Process comparison guide")
        ]
    },

    duty_cycle: {
        answer: dutyCycleExplanation,
        visualType: "duty-cycle",
        process: "unknown",
        refs: [ownerRef("Duty cycle ratings", "7")],
        highlightContext: {
            type: "duty-cycle",
            highlightKey: "240V-200A",
            highlightLabel: "2.5 min weld / 7.5 min rest"
        },
        dutyCycleRows: [
            { input: "120V", amperage: "100A", dutyCycle: "40%", weldMinutes: 4, restMinutes: 6 },
            { input: "120V", amperage: "75A", dutyCycle: "100%", weldMinutes: 10, restMinutes: 0 },
            { input: "240V", amperage: "200A", dutyCycle: "25%", weldMinutes: 2.5, restMinutes: 7.5 },
            { input: "240V", amperage: "115A", dutyCycle: "100%", weldMinutes: 10, restMinutes: 0 }
        ]
    },

    polarity_101: {
        answer: polarity101,
        visualType: "text",
        process: "unknown",
        refs: [
            ownerRef("Polarity setup guide", "8"),
            quickRef("Front panel controls", "1")
        ]
    },

    wire_loading: {
        answer: wireLoadingGuide,
        visualType: "manual-image",
        process: "unknown",
        refs: [quickRef("Wire spool loading", "1"), ownerRef("Wire feed tension", "17")],
        manualImages: [manualImages[1]]
    },

    troubleshooting_porosity: {
        answer: troubleshootingPortosity,
        visualType: "troubleshooting",
        process: "unknown",
        checklist: [
            "Confirm the selected process matches the wire: gasless flux-core should not use shielding gas; solid MIG wire needs shielding gas.",
            "For flux-core, verify polarity is DCEN: wire feed cable negative and ground clamp positive.",
            "Clean oil, paint, rust, mill scale, and moisture from the joint area.",
            "If using gas-shielded MIG, check cylinder valve, regulator flow, gas hose, and drafts at the weld.",
            "Trim contaminated wire and confirm the contact tip and nozzle are clean.",
            "Reduce stick-out and keep a steady travel angle so the puddle stays protected."
        ],
        refs: [ownerRef("Troubleshooting and weld diagnosis", "37")]
    },

    troubleshooting_wire_feed: {
        answer: troubleshootingWireFeed,
        visualType: "troubleshooting",
        process: "unknown",
        checklist: [
            "Make sure the spool unwinds toward the inlet guide without crossing over itself.",
            "Match the drive roller groove and contact tip to the wire diameter.",
            "Set enough tension to feed consistently without crushing the wire.",
            "Keep the gun lead straight while loading wire.",
            "Clip the wire cleanly before feeding it through the liner."
        ],
        refs: [quickRef("Wire spool loading", "1"), ownerRef("Wire feed tension", "17")]
    },

    troubleshooting_bad_welds: {
        answer: troubleshootingBadWelds,
        visualType: "troubleshooting",
        process: "unknown",
        checklist: [
            "Check polarity first for the selected process.",
            "Verify material thickness and choose settings from the setup chart.",
            "Clean the work clamp contact point and clamp directly to the workpiece when possible.",
            "Inspect consumables: contact tip, nozzle, electrode, and ground lead.",
            "Make one adjustment at a time: voltage/arc length, wire speed/amperage, then travel speed."
        ],
        refs: [ownerRef("Troubleshooting and weld diagnosis", "37")]
    }
};

// Normalize query to match prebuilt answer keys.
// Priority order mirrors lib/outputPlanner.ts: setup > duty_cycle > troubleshooting >
// wire_loading > process_selection. Process-specific setup questions are intentionally
// NOT matched here so they fall through to tryDirectResponse, which returns a
// deterministic per-process recipe via getDirectPolarityAnswer.
export function normalizeQueryIntent(input: string): string | null {
    const lower = input.toLowerCase().trim();

    const mentionsProcess = /\b(mig|tig|flux(?:[- ]?core)?|stick|smaw|gtaw|gmaw|fcaw)\b/.test(lower);

    const isSetupQuestion =
        /\bpolarity\b|\bdcen\b|\bdcep\b|\bwhich cable\b|\bcable goes where\b|\bwhich socket\b|\b(positive|negative|\+|−)\s*(socket|terminal)\b/.test(lower)
        || /\bwhere (do|does|should) (i|it|they) (connect|plug|go|hook)\b/.test(lower)
        || /\bhow (do i|to) (connect|hook|plug|wire|set)\b/.test(lower)
        || (/\b(torch|tig torch|electrode holder|ground clamp|work lead|wire feed cable|wire feed power|foot pedal)\b/.test(lower)
            && /\b(where|which|how|what|connect|cable|socket|plug|hook|goes)\b/.test(lower));

    // 1. Setup/polarity. If process is known, fall through so tryDirectResponse handles
    //    it with the per-process step-by-step recipe. Without a process, only the
    //    explicit "polarity" overview question gets the polarity_101 prebuilt; vague
    //    "how do I set it up?" questions fall through so the planner can ask for the
    //    missing process.
    if (isSetupQuestion) {
        if (mentionsProcess) return null;
        if (/\bpolarity\b/.test(lower)) return "polarity_101";
        return null;
    }

    // 2. Duty cycle
    if (/\bduty cycle\b|\bweld continuously\b|\boverheat(?:ing)?\b|\bthermal shutdown\b|\bweld time\b|\brest time\b|\bhow long can i weld\b/.test(lower)) {
        return "duty_cycle";
    }

    // 3. Troubleshooting
    if (/\bporosity\b|\bpin ?holes?\b|\bbubbles? in\b/.test(lower)) {
        return "troubleshooting_porosity";
    }
    if (/\bbird.?nest\b|\bwire (jam|slip|skip|won'?t feed|not feeding|feed problem|feed issue)\b/.test(lower)) {
        return "troubleshooting_wire_feed";
    }
    if (/\b(bad|weak|ugly|poor)\b.*\b(weld|bead)\b|\bspatter\b|\bburn[- ]through\b/.test(lower)) {
        return "troubleshooting_bad_welds";
    }

    // 4. Wire loading
    if (/\b(load|loading|reload)\b.*\b(wire|spool)\b|\bwire spool\b|\bdrive roller\b|\bwire tension\b/.test(lower)) {
        return "wire_loading";
    }

    // 5. Process selection \u2014 only explicit choose/compare phrasings, never on bare
    //    process mentions. Word-boundary anchored to avoid matches like "for" hitting "or".
    if (
        /\bchoose between\b|\bwhich process\b|\bwhat process\b|\bcompare\b|\bbest process\b|\bshould i use\b|\bwhich (one )?should i\b|\bdifference between\b/.test(lower)
        || /\b(mig|tig|flux(?:-?core)?|stick)\s*(vs\.?|versus|or)\s+(mig|tig|flux(?:-?core)?|stick)\b/.test(lower)
        || /\bdon'?t have gas\b|\bno gas\b/.test(lower)
    ) {
        return "process_selection";
    }

    return null;
}

// Server-side in-memory cache (cleared per deployment)
export type CachedResponseData = AgentResponse & {
    warning?: string;
    usedModel?: string;
    conversationState?: ConversationState;
    cacheHit?: boolean;
};

const queryCache = new Map<string, { response: CachedResponseData; timestamp: number }>();
const CACHE_TTL_MS = 1000 * 60 * 60; // 1 hour

export function getCachedResponse(normalizedKey: string): CachedResponseData | null {
    const cached = queryCache.get(normalizedKey);
    if (!cached) return null;

    const isExpired = Date.now() - cached.timestamp > CACHE_TTL_MS;
    if (isExpired) {
        queryCache.delete(normalizedKey);
        return null;
    }

    return cached.response;
}

export function setCachedResponse(normalizedKey: string, response: CachedResponseData): void {
    queryCache.set(normalizedKey, {
        response,
        timestamp: Date.now()
    });
}

// Generate cache key from query
export function generateCacheKey(query: string): string {
    return query
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s]/g, "") // Remove special characters
        .replace(/\s+/g, "-") // Replace spaces with hyphens
        .slice(0, 100); // Cap length
}
