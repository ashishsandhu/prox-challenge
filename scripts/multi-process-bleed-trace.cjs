// Standalone diagnostic for the "multi-process bleed" bug:
// when Claude's answer for a single-process recommendation question mentions
// multiple processes, attachAnswerDrivenSetupVisuals previously fanned out
// to one setup_diagram per mentioned process, which inflated the inline
// comparison table + per-process checklists.
//
// Mirrors the regexes in lib/outputPlanner.ts and route.ts so we can run this
// without the TS toolchain.

const ALL_PROCESSES = ["mig", "flux-core", "tig", "stick"];
const ALL_PROCESSES_RE = /\b(?:all (?:four|4)?\s*(?:setups?|processes|methods)|every (?:setup|process|method)|the (?:four|4)\s*(?:setups?|processes|methods)|every welding (?:setup|process|method))\b/;

function extractMentionedProcesses(message) {
  const lower = message.toLowerCase();
  if (ALL_PROCESSES_RE.test(lower)) return [...ALL_PROCESSES];
  const patterns = [
    ["flux-core", /\bflux[\s-]?core(?:d)?\b|\bfcaw\b|\bgasless\b/g],
    ["mig", /\bmig\b|\bgmaw\b|\bsolid[\s-]?core\b/g],
    ["tig", /\btig\b|\btiug\b|\bgtaw\b/g],
    ["stick", /\bstick\b|\bsmaw\b/g]
  ];
  const hits = [];
  for (const [process, regex] of patterns) {
    const match = regex.exec(lower);
    if (match) hits.push({ process, index: match.index });
  }
  hits.sort((a, b) => a.index - b.index);
  return hits.map((h) => h.process);
}

const cases = [
  {
    label: "Turn 2 prose mentioning multiple processes (current bug)",
    question: "I'm welding outdoors with no gas on 1/8 steel. What should I do?",
    answer:
      "Use **flux-core** for outdoor welding without gas — MIG needs shielding gas and TIG isn't suited for dirty outdoor steel. Connect ground clamp to negative (−) and wire feed to positive (+) for DCEP."
  },
  {
    label: "Single-process answer (control)",
    question: "I'm welding outdoors with no gas on 1/8 steel. What should I do?",
    answer:
      "Use **flux-core**. Connect ground clamp to negative (−) and wire feed to positive (+) for DCEP."
  },
  {
    label: "Multi-process question (genuine compare — should fan out)",
    question: "Compare flux-core and TIG setups",
    answer: "- **Flux-core**: ...\n- **TIG**: ..."
  }
];

for (const c of cases) {
  const fromQuestion = extractMentionedProcesses(c.question);
  const fromAnswer = extractMentionedProcesses(c.answer);
  console.log("---", c.label);
  console.log("  fromQuestion:", fromQuestion);
  console.log("  fromAnswer:", fromAnswer);
  // OLD merge logic (the bug):
  const oldMerged = [];
  for (const p of [...fromQuestion, ...fromAnswer]) {
    if (!oldMerged.includes(p)) oldMerged.push(p);
  }
  // NEW merge logic (the fix):
  let newMerged;
  if (fromQuestion.length >= 2) {
    newMerged = [];
    for (const p of [...fromQuestion, ...fromAnswer]) {
      if (!newMerged.includes(p)) newMerged.push(p);
    }
  } else {
    newMerged = [fromAnswer[0] ?? "flux-core"];
  }
  console.log("  OLD merged (current bug):", oldMerged);
  console.log("  NEW merged (after fix):  ", newMerged);
}
