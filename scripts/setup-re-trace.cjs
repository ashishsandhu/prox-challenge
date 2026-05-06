// Standalone diagnostic for the proposed SETUP_RE expansion in
// lib/outputPlanner.ts. Mirrors the new regex exactly so we can verify
// "how do I wire X" / "wiring for X" route to setup without regressions.
const SETUP_RE = /\b(connect|connects|connected|connection|connecting|socket|sockets|polarity|ground|torch|electrode|hook ?up|cable|cables|plug|wire feed|wiring|wire (?:up|it up|them up)|how (?:do i|to|can i|should i) wire|setups?|set ?ups?|setting up|where (do|does|should) .* (go|plug|connect))\b/;

const cases = [
  // Should now match (the gap the user reported)
  ["how do I wire MIG?", true],
  ["how do I wire flux core?", true],
  ["how should I wire TIG", true],
  ["how can I wire stick", true],
  ["wiring for flux core", true],
  ["wiring for stick", true],
  ["wire it up", true],
  ["my wiring is loose", true],

  // Should still match (pre-existing — regression check)
  ["how do I set up wiring in flux core?", true],
  ["cable setup for flux core", true],
  ["where does the ground clamp go", true],
  ["polarity for TIG", true],

  // Should NOT match (must not regress into setup)
  ["what wire should I use for MIG", false],
  ["wire diameter recommendation", false],
  ["recommend a 0.030 wire", false],
  ["what is duty cycle", false],
  ["why does flux-core not need gas", false],
];

let pass = 0, fail = 0;
for (const [t, want] of cases) {
  const got = SETUP_RE.test(t.toLowerCase());
  const ok = got === want;
  if (ok) pass++; else fail++;
  console.log(ok ? "OK  " : "FAIL", `expect=${want} got=${got}  ::  ${t}`);
}
console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
