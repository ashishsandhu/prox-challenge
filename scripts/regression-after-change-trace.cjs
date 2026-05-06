// Standalone diagnostic for the "regression after change" routing pattern.
// User reports: "I switched from MIG to flux-core and now it's bad — why"
// This is a TROUBLESHOOTING question (asking why the result got worse after
// a change), not a setup question, even though "from MIG to flux-core" names
// two processes.
//
// Mirrors the regex we'll add to lib/outputPlanner.ts so we can validate
// without the TS toolchain. The regex MUST require BOTH a change cue AND a
// problem-result signal so neutral "I switched to X for outdoor work" stays
// out of the troubleshooting branch.

const CHANGE_CUE_RE =
  /\b(?:switch(?:ed|ing)?|chang(?:ed|ing)?|swap(?:ped|ping)?|mov(?:ed|ing)?|went|going)(?:\s+[a-z]+){0,2}\s+(?:from|to|over)\b/;
// Accept either:
//   (a) a temporal "now / since / after / then" cue near a problem word, OR
//   (b) a problem word tied to a weld noun (weld, bead, result, output, arc).
const REGRESSION_PROBLEM_RE =
  /\b(?:now|since|after|then)\b[^.!?]{0,60}\b(?:bad|worse|broken|won'?t|not working|messed up|terrible|ugly|wrong|off|porous|sooty|sputter(?:ing)?|unstable|no arc)\b|\b(?:weld|bead|result|output|arc|puddle)s?\b[^.!?]{0,30}\b(?:bad|worse|broken|won'?t|not working|messed up|terrible|ugly|wrong|off|porous|sooty|sputter(?:ing)?|unstable)\b/;

function isRegressionAfterChange(text) {
  const lower = text.toLowerCase();
  return CHANGE_CUE_RE.test(lower) && REGRESSION_PROBLEM_RE.test(lower);
}

const cases = [
  // SHOULD route to troubleshooting via this new pattern
  ["I switched from MIG to flux-core and now it's bad — why", true],
  ["I changed from TIG to MIG and arc won't start", true],
  ["swapped from stick to MIG and now the result is worse", true],
  ["moved from MIG to TIG and now it's not working", true],
  ["since switching to flux-core my welds look bad", true],
  ["I changed wire from solid to flux-core and the bead is sooty", true],
  ["after switching to TIG the arc is unstable", true],

  // SHOULD NOT match — neutral statements about switching, no regression
  ["I switched to flux-core for outdoor work", false],
  ["I changed my wire from .030 to .035", false],
  ["how do I switch from MIG to flux-core", false],
  ["I'm planning to switch to TIG for stainless", false],
  ["I switched to MIG because of bad weather", false],

  // Already covered by VAGUE_TROUBLE_RE / TROUBLE_RE — should not interfere
  ["my flux-core welds have porosity", false],
  ["the weld looks ugly", false],
  ["compare MIG and flux-core", false],
  ["explain all setups", false],
  ["how do I wire MIG", false],
  ["outdoors no gas 1/8 steel what should I do", false]
];

let pass = 0;
let fail = 0;
for (const [text, want] of cases) {
  const got = isRegressionAfterChange(text);
  const tag = got === want ? "OK   " : "FAIL ";
  if (got === want) pass++; else fail++;
  console.log(tag, "expect=" + String(want).padEnd(5), "got=" + String(got).padEnd(5), "::", text);
}
console.log(`\n${pass}/${pass + fail} passed`);

// Mirror the attach + augment gating for the canonical regression question,
// to prove the workspace ends up with: troubleshooting_flow + manual_image
// + (single) setup_diagram + NO pre_weld_checklist.
const ALL_PROCESSES = ["mig", "flux-core", "tig", "stick"];
function extractProc(s) {
  const lower = s.toLowerCase();
  const out = [];
  const pats = [
    ["flux-core", /\bflux[\s-]?core(?:d)?\b|\bfcaw\b|\bgasless\b/g],
    ["mig", /\bmig\b|\bgmaw\b/g],
    ["tig", /\btig\b|\bgtaw\b/g],
    ["stick", /\bstick\b|\bsmaw\b/g]
  ];
  for (const [p, r] of pats) if (r.test(lower) && !out.includes(p)) out.push(p);
  return out;
}
function simulate({ question, answer, intent, responseProcess }) {
  // planVisuals output for regression-after-change (TROUBLE_RE || isRegression)
  let visuals = ["troubleshooting_flow", "manual_image_card"];
  // attachAnswerDrivenSetupVisuals — single process for troubleshooting
  const fromQ = extractProc(question);
  const fromA = extractProc(answer);
  let merged;
  if (fromQ.length >= 2 && intent !== "troubleshooting") merged = [...new Set([...fromQ, ...fromA])];
  else if (responseProcess !== "unknown") merged = [responseProcess];
  else if (fromA.length) merged = [fromA[0]];
  else merged = ["flux-core"];
  for (const p of merged) visuals.push(`setup_diagram:${p}`);
  // augmentVisualsWithGarageTools — checklist gated on non-troubleshooting
  const setupCount = merged.length;
  const setupLike = ["setup", "polarity", "settings_recommendation"];
  const checklistAllowed = setupLike.includes(intent) || (setupCount >= 2 && intent !== "troubleshooting");
  if (checklistAllowed) visuals.push(`pre_weld_checklist (${setupCount}x)`);
  return visuals;
}
console.log("\nSimulated visual stack for regression case:");
console.log(simulate({
  question: "I switched from MIG to flux-core and now it's bad — why",
  answer: "You flipped to flux-core but kept DCEP. Flux-core needs DCEN — swap polarity.",
  intent: "troubleshooting",
  responseProcess: "flux-core"
}));

process.exit(fail === 0 ? 0 : 1);
