// Smart warning system. Deterministic regex rules over the user's message
// (plus optional detected process) that surface 1–2 high-signal cautions in
// the chat answer and the visual workspace.
//
// Rules are intentionally conservative: each one is tied to a specific phrase
// pattern in the question, so the assistant will not spam warnings on every
// turn. Returned in priority order; the chat pill uses the first one and the
// workspace card shows up to two.

import type { WeldProcess } from "@/data/ProductGrounding";

export type SmartWarning = {
  id: string;
  severity: "warning" | "info";
  text: string;
};

const RX = {
  fluxCore: /\bflux[\s-]?core(?:d)?\b|\bfcaw\b/i,
  mig: /\bmig\b|\bgmaw\b|\bsolid[\s-]?core\b/i,
  tig: /\btig\b|\bgtaw\b/i,
  stick: /\bstick\b|\bsmaw\b|\belectrode holder\b/i,
  withGas: /\b(with|using|connect(?:ing|ed)?|hook(?:ing|ed)? up)\b[^.?!]{0,30}\b(shielding )?gas\b|\bgas (on|connected|hooked|line in)\b/i,
  noGas: /\bno gas\b|\bdon'?t have gas\b|\bwithout gas\b|\bgasless\b/i,
  wirePositive: /\bwire (feed )?(?:cable )?(?:to |on |goes |->|→)?\s*(positive|\+)\b/i,
  wireNegative: /\bwire (feed )?(?:cable )?(?:to |on |goes |->|→)?\s*(negative|−|-)\b/i,
  groundPositive: /\bground (?:clamp )?(?:to |on |goes |->|→)?\s*(positive|\+)\b/i,
  groundNegative: /\bground (?:clamp )?(?:to |on |goes |->|→)?\s*(negative|−|-)\b/i,
  torchPositive: /\b(tig )?torch (?:to |on |goes |->|→)?\s*(positive|\+)\b/i,
  wireFeedConnected: /\bwire feed\b[^.?!]{0,40}\b(connected|plugged|hooked)\b/i,
  duty200_240: /\b200\s*a(?:mp)?\b[^.?!]{0,30}\b240\s*v?\b|\b240\s*v?\b[^.?!]{0,30}\b200\s*a(?:mp)?\b/i,
  continuous: /\bcontinuous(?:ly)?\b|\ball day\b|\bnonstop\b/i,
  overheating: /\boverheat(?:ing)?\b|\bthermal shutdown\b|\btoo hot\b|\bshut(?:s|ting)? down\b/i,
  wireTangle: /\btangl(?:e|ing|ed)\b|\bunspool(?:ing|ed)?\b|\bnesting\b|\bbird.?nest\b|\bspool (?:loose|came off|unraveled)\b/i,
  feedIssue: /\bwon'?t feed\b|\bnot feeding\b|\bfeed (?:problem|issue|jam)\b|\bjamming\b|\bskip(?:ping)?\b/i
};

// Returns warnings in priority order. Caller should slice to 1–2.
export function detectSmartWarnings(message: string, process?: WeldProcess): SmartWarning[] {
  const out: SmartWarning[] = [];
  const text = message;
  const isFlux = process === "flux-core" || RX.fluxCore.test(text);
  const isMig = process === "mig" || (RX.mig.test(text) && !isFlux);
  const isTig = process === "tig" || RX.tig.test(text);

  // Flux-core
  if (isFlux && (RX.withGas.test(text))) {
    out.push({
      id: "flux-core+gas",
      severity: "warning",
      text: "Flux-core wire is self-shielded. Do not connect shielding gas unless the wire/manual says otherwise."
    });
  }
  if (isFlux && (RX.wirePositive.test(text) || RX.groundNegative.test(text))) {
    out.push({
      id: "flux-core+wrong-polarity",
      severity: "warning",
      text: "Flux-core requires DCEN: ground clamp → positive (+), wire feed → negative (−)."
    });
  }

  // MIG
  if (isMig && RX.noGas.test(text)) {
    out.push({
      id: "mig+no-gas",
      severity: "warning",
      text: "Solid-core MIG requires shielding gas. Without gas, switch to flux-core wire instead."
    });
  }
  if (isMig && (RX.groundPositive.test(text) || RX.wireNegative.test(text))) {
    out.push({
      id: "mig+wrong-polarity",
      severity: "warning",
      text: "Gas-shielded MIG requires DCEP: ground clamp → negative (−), wire feed → positive (+)."
    });
  }

  // TIG
  if (isTig && RX.wireFeedConnected.test(text)) {
    out.push({
      id: "tig+wire-feed-connected",
      severity: "warning",
      text: "Disconnect the wire feed power cable during TIG setup — leaving it plugged in can stop the torch from working correctly."
    });
  }
  if (isTig && RX.torchPositive.test(text)) {
    out.push({
      id: "tig+torch-positive",
      severity: "warning",
      text: "TIG torch goes to the negative (−) socket; ground clamp goes to positive (+)."
    });
  }

  // Duty cycle
  if (RX.duty200_240.test(text) && RX.continuous.test(text)) {
    out.push({
      id: "duty-200-continuous",
      severity: "warning",
      text: "200A at 240V is 25% duty cycle: 2.5 minutes welding, 7.5 minutes rest per 10-minute window."
    });
  }
  if (RX.overheating.test(text)) {
    out.push({
      id: "overheating",
      severity: "info",
      text: "Let the welder cool with power on so the internal fan can run, per the manual."
    });
  }

  // Wire feed
  if (RX.wireTangle.test(text)) {
    out.push({
      id: "wire-tangle",
      severity: "info",
      text: "Keep tension on the wire while loading and confirm the spool is not loose on the hub."
    });
  }
  if (isFlux && RX.feedIssue.test(text)) {
    out.push({
      id: "flux-feed-tension",
      severity: "info",
      text: "Too much feed tension can crush flux-core wire. Back off until the wire just stops slipping."
    });
  }

  // De-duplicate by id, preserve order, cap at 2 to avoid spam.
  const seen = new Set<string>();
  const unique: SmartWarning[] = [];
  for (const w of out) {
    if (seen.has(w.id)) continue;
    seen.add(w.id);
    unique.push(w);
    if (unique.length >= 2) break;
  }
  return unique;
}
