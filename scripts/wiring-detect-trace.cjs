// Standalone diagnostic for the answer-driven setup attachment heuristic in
// app/api/chat/route.ts. Mirrors WIRING_PART_RE / POLARITY_TARGET_RE /
// answerDescribesWiring exactly. Not wired into the app — diagnostic only.
const WIRING_PART_RE =
  /\b(ground clamp|work lead|electrode holder|wire feed cable|wire-feed cable|torch cable|tig torch|mig gun|stinger)\b/i;
const POLARITY_TARGET_RE =
  /\b(?:dcep|dcen)\b|\b(?:positive|negative)\s+(?:socket|terminal)\b|\b(?:positive|negative)\s*\([\+\-\u2212]\)|\binto\s+(?:the\s+)?(?:positive|negative)\b/i;

function describesWiring(text) {
  if (!text) return false;
  if (/\bdcep\b|\bdcen\b/i.test(text)) return true;
  return WIRING_PART_RE.test(text) && POLARITY_TARGET_RE.test(text);
}

const cases = [
  // Should TRIGGER (answer is about wiring)
  { expect: true, intent: "general", q: "outdoors no gas, what do I do?", a: "Run flux-core. Connect ground clamp into the positive (+) socket and the wire feed cable into the negative (−) socket." },
  { expect: true, intent: "settings_recommendation", q: "Recommend settings for 1/8 mild steel MIG", a: "Use ~19V at 200 IPM. Wiring: MIG gun into positive socket (DCEP), ground clamp into negative." },
  { expect: true, intent: "polarity", q: "what polarity for TIG", a: "TIG is DCEN: TIG torch into the negative socket, ground clamp into the positive socket." },

  // Explanation answers DO trip the regex (wiring vocab is present), but the
  // intent === "explanation" gate inside attachAnswerDrivenSetupVisuals
  // suppresses the visual end-to-end. This test only validates the regex.
  { expect: true, intent: "explanation", q: "what happens if polarity is reversed in TIG", a: "Reversed TIG drives heat into the tungsten. Correct setup: ground clamp → positive (+), TIG torch → negative (−)." },

  // Should NOT trigger (definition / explanation — no wiring vocab)
  { expect: false, intent: "general", q: "what is duty cycle", a: "Duty cycle is the percentage of a 10-minute period the welder can output at a given amperage before thermal cutoff." },
  { expect: false, intent: "general", q: "why does flux-core not need gas", a: "Flux-core wire has flux inside that burns and shields the puddle, so no external gas bottle is required." },

  // Should NOT trigger (planner already added setup_diagram — handled by the
  // hasSetup check, not this regex; here we only confirm the regex behavior)
  { expect: true, intent: "setup", q: "how do I set up MIG wiring?", a: "Connect MIG gun into positive (+), ground clamp into negative (−). DCEP polarity." },

  // Arrow-shorthand phrasings Claude commonly emits — these were silently
  // missed by the original regex (trailing \b after \) never matched).
  { expect: true, intent: "general", q: "outdoors no gas, what do I do?", a: "Run flux-core. Ground clamp → positive (+), wire feed cable → negative (−)." },
  { expect: true, intent: "general", q: "wire it up", a: "Connect ground clamp to positive (+) and wire feed cable to negative (−)." },

  // Should NOT trigger — bare "positive" / "negative" without a target noun.
  { expect: false, intent: "general", q: "what does positive mean", a: "Positive in welding refers to the polarity assignment of the cable plugged into the positive socket on the welder." },
];

let pass = 0, fail = 0;
for (const c of cases) {
  const got = describesWiring(c.a);
  const ok = got === c.expect;
  if (ok) pass++; else fail++;
  console.log(ok ? "OK  " : "FAIL", `expect=${c.expect} got=${got}  intent=${c.intent}  Q="${c.q}"`);
  if (!ok) console.log("     A:", c.a);
}
console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
