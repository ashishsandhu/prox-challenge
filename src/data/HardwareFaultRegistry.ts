// Curated fault states for the Vulcan OmniPro 220. The OmniPro 220 doesn't
// expose a numeric error-code system; instead it surfaces faults via front-
// panel indicators (HOT light, LCD warning screens, blank display) and the
// rear Reset Button. Each entry below is grounded in the manual's
// Troubleshooting and Specifications sections.
//
// Used by the HardwareDiagnostics modal (a quick-find UI for "the welder is
// doing something weird") and by FaultProtocol (inline render in the chat
// bubble when a user picks an entry). Pure data — no LLM call required.

import type { ManualRef } from "@/data/ProductGrounding";
import { ownerRef } from "@/data/ProductGrounding";

export type FaultSeverity = "info" | "warning" | "danger";
export type FaultCategory = "power" | "thermal" | "wire" | "full";

export type FaultCode = {
  id: string;
  code: string;
  label: string;
  category: FaultCategory;
  indicator: string;
  severity: FaultSeverity;
  whatYoureSeeing: string;
  isSafe: string;
  causes: string[];
  recovery: string[];
  keywords: string[];
};

export const faultCodes: FaultCode[] = [
  {
    id: "thermal-overload",
    code: "HOT",
    label: "Thermal overload (duty cycle exceeded)",
    category: "thermal",
    indicator: "HOT light on front panel; warning screen on LCD; output cuts mid-weld",
    severity: "warning",
    whatYoureSeeing: "The welder stopped putting out current and the HOT indicator is on. The internal thermal protection has tripped because the duty cycle was exceeded.",
    isSafe: "Safe. The machine protected itself. No damage as long as you let it cool with the fan running.",
    causes: [
      "Welded longer than the rated duty cycle for your amperage / input voltage.",
      "Fan blocked, dirty intake/exhaust vents, or insufficient airflow around the cabinet.",
      "Ambient temperature too high for the duty cycle you're pulling."
    ],
    recovery: [
      "Leave the Power Switch ON so the cooling fan keeps running.",
      "Wait until the HOT light clears (typically a few minutes).",
      "Check the duty-cycle table for your amperage and stay within it on the next run.",
      "Improve airflow: clear vents, move the welder out of cramped corners."
    ],
    keywords: ["hot", "overheat", "thermal", "duty cycle", "shut down", "stopped welding", "no output", "warning screen"]
  },
  {
    id: "low-voltage-protection",
    code: "LV",
    label: "Low-voltage protection tripped",
    category: "power",
    indicator: "Welder won't function when switched on; warning screen or no arc on trigger",
    severity: "warning",
    whatYoureSeeing: "The input voltage dropped below the safe operating threshold and the machine entered low-voltage protection.",
    isSafe: "Safe. Operating below the rated voltage would damage the machine, so it locked itself out.",
    causes: [
      "Long or undersized extension cord causing voltage drop.",
      "Shared circuit pulling other loads (compressor, heater) at the same time.",
      "Wall outlet not delivering rated voltage (wiring issue or weak circuit)."
    ],
    recovery: [
      "Verify the outlet matches the welder's input rating (120V or 240V).",
      "Remove the extension cord, or use a heavier-gauge / shorter one.",
      "Switch off other loads on the same circuit.",
      "Press the Reset Button on the back of the machine after the input is stable."
    ],
    keywords: ["low voltage", "lv", "won't power", "no arc", "extension cord", "reset", "wall outlet", "circuit"]
  },
  {
    id: "over-voltage-protection",
    code: "OV",
    label: "Over-voltage protection tripped",
    category: "power",
    indicator: "Welder won't function when switched on; warning screen on LCD",
    severity: "warning",
    whatYoureSeeing: "The input voltage rose above the safe operating threshold and the machine entered over-voltage protection.",
    isSafe: "Safe. The lockout prevented damage to the inverter electronics.",
    causes: [
      "Plugged into a 240V circuit while set to expect 120V (or vice versa).",
      "Generator running unloaded or with bad voltage regulation.",
      "Surge or unstable supply from the wall."
    ],
    recovery: [
      "Confirm the outlet voltage matches what the welder is set up for.",
      "If running off a generator, load it lightly first and let voltage settle.",
      "Press the Reset Button on the back of the machine.",
      "If it trips again, have a qualified electrician check the supply."
    ],
    keywords: ["over voltage", "ov", "high voltage", "generator", "surge", "won't power", "reset"]
  },
  {
    id: "fan-failure",
    code: "FAN",
    label: "Cooling Fan Malfunction",
    category: "thermal",
    indicator: "Machine power is ON but fan is silent; HOT light may trigger rapidly",
    severity: "danger",
    whatYoureSeeing: "The machine is on, but you don't hear the usual fan noise. The unit heats up almost immediately when welding.",
    isSafe: "Unsafe for operation. Continued use will cause permanent damage to the inverter boards.",
    causes: [
      "Fan motor failure.",
      "Internal debris blocking the blades.",
      "Loose internal wiring harness to the fan."
    ],
    recovery: [
      "Power OFF immediately.",
      "Check intake/exhaust vents for visible obstructions.",
      "If vents are clear and fan doesn't spin on next power-up, service is required.",
      "Do not attempt to weld without an active cooling fan."
    ],
    keywords: ["fan", "noise", "silent", "cooling", "overheat", "stuck"]
  },
  {
    id: "wire-feed-slip",
    code: "SLIP",
    label: "Drive Roll Slippage",
    category: "wire",
    indicator: "Motor is turning but wire feeds erratically or stops when under load",
    severity: "warning",
    whatYoureSeeing: "You hear the motor, but the wire isn't moving steadily. It jerks or stops when it touches the workpiece.",
    isSafe: "Safe. Mechanical feed issue.",
    causes: [
      "Insufficient tension on the drive roll arm.",
      "Wrong roller size for the wire diameter.",
      "Clogged liner or contact tip creating too much drag."
    ],
    recovery: [
      "Tighten the tension adjustment knob by half-turn increments.",
      "Confirm the roller groove matches your wire size.",
      "Replace the contact tip if it shows signs of wear or clogging."
    ],
    keywords: ["slip", "feed", "erratic", "jerky", "tension", "roller"]
  },
  {
    id: "bird-nest",
    code: "NEST",
    label: "Wire Bird-Nesting",
    category: "wire",
    indicator: "Wire tangles into a 'nest' at the drive rolls instead of feeding into the liner",
    severity: "warning",
    whatYoureSeeing: "The wire is bunching up in the drive housing. It's a tangled mess before it even enters the gun cable.",
    isSafe: "Safe. Requires mechanical cleanup.",
    causes: [
      "Excessive drive roll tension.",
      "Clogged liner causing high resistance.",
      "Using soft wire (aluminum) without a spool gun."
    ],
    recovery: [
      "Power OFF and cut the tangled wire.",
      "Remove the wire from the liner and blow it out with compressed air.",
      "Reduce drive roll tension and ensure the wire is guided perfectly into the liner inlet."
    ],
    keywords: ["tangle", "bird nest", "jam", "clog", "wire", "mess"]
  },
  {
    id: "input-phase-loss",
    code: "PHASE",
    label: "Input Phase Disruption",
    category: "power",
    indicator: "Power is ON but machine loses strength or triggers 'LV' repeatedly",
    severity: "danger",
    whatYoureSeeing: "The welder powers up, but as soon as you strike an arc, it dies or the voltage drops significantly.",
    isSafe: "Unsafe. Indicates a major power supply failure.",
    causes: [
      "Partial failure of the input power cord.",
      "One leg of a 240V circuit is dead at the wall breaker.",
      "Internal bridge rectifier failure."
    ],
    recovery: [
      "Test the wall outlet with a multimeter to ensure both 120V legs are active.",
      "Check the power cord for fraying or loose connections at the plug.",
      "If outlet is fine, the internal power stage requires professional service."
    ],
    keywords: ["phase", "power", "dead", "weak", "voltage", "legs"]
  },
  {
    id: "breaker-tripped",
    code: "BRKR",
    label: "Wall Breaker Tripped",
    category: "power",
    indicator: "Machine goes completely dark during high-amperage welding",
    severity: "warning",
    whatYoureSeeing: "Everything was working fine, but during a heavy bead, the machine and shop lights went out.",
    isSafe: "Safe. The shop breaker protected the circuit.",
    causes: [
      "Amperage setting exceeds the circuit breaker's rating.",
      "Shared circuit with other heavy machinery.",
      "Inrush current spike during arc start."
    ],
    recovery: [
      "Reset the breaker at the main electrical panel.",
      "If using 120V, move to a 20A dedicated circuit.",
      "If welding heavy plate, switch to the 240V input for better efficiency."
    ],
    keywords: ["breaker", "tripped", "dark", "circuit", "fuse", "power"]
  },
  {
    id: "ambient-limit",
    code: "AMB",
    label: "Ambient Temp Limit Reached",
    category: "thermal",
    indicator: "HOT light triggers even with low-amperage usage",
    severity: "warning",
    whatYoureSeeing: "You just started welding, but the machine is already reporting an overheat condition.",
    isSafe: "Safe. The machine is protecting itself from extreme external heat.",
    causes: [
      "Direct sunlight hitting the welder cabinet.",
      "Ambient shop temperature exceeding 104°F (40°C).",
      "Welder positioned too close to another heat source (furnace, forge)."
    ],
    recovery: [
      "Move the welder into the shade or a cooler area.",
      "Use a shop fan to direct cool air toward the intake vents.",
      "Allow the machine to rest for 15 minutes before retrying."
    ],
    keywords: ["ambient", "sun", "hot", "weather", "heat", "overheat"]
  },
  {
    id: "heatsink-clog",
    code: "DUST",
    label: "Internal Heatsink Obstruction",
    category: "thermal",
    indicator: "Fan runs at full speed constantly; duty cycle is significantly reduced",
    severity: "warning",
    whatYoureSeeing: "The fan never slows down, and the machine keeps cutting out after only a few inches of weld.",
    isSafe: "Safe, but requires maintenance.",
    causes: [
      "Build-up of grinding dust and metallic particles on internal fins.",
      "Insect nests or shop debris inside the cabinet.",
      "Restricted exhaust airflow."
    ],
    recovery: [
      "Power OFF and unplug the machine.",
      "Use dry compressed air to blow out the vents from the inside out.",
      "Ensure there is at least 12 inches of clearance around all vents."
    ],
    keywords: ["dust", "clog", "dirty", "fan", "heatsink", "blocked"]
  },
  {
    id: "motor-overload",
    code: "MTR",
    label: "Drive Motor Overload",
    category: "wire",
    indicator: "Wire stops feeding; ERR screen may appear; motor smells 'hot'",
    severity: "danger",
    whatYoureSeeing: "The wire is stuck, and the drive housing feels extremely hot. The motor is straining but not turning.",
    isSafe: "Unsafe. Risk of burning out the drive motor.",
    causes: [
      "Total liner blockage (melted liner).",
      "Wire spool brake tension set too tight.",
      "Melted contact tip (burn-back)."
    ],
    recovery: [
      "Power OFF immediately.",
      "Loosen the spool hub tension—it should spin freely but not unravel.",
      "Replace the liner and contact tip before resuming."
    ],
    keywords: ["motor", "stuck", "smell", "hot", "overload", "drive"]
  },
  {
    id: "liner-clog",
    code: "LINE",
    label: "Gun Liner Obstruction",
    category: "wire",
    indicator: "Wire feeds roughly; sounds like it's 'scratching' inside the cable",
    severity: "info",
    whatYoureSeeing: "The wire is moving, but it's jerky. You can hear it rubbing hard inside the gun lead.",
    isSafe: "Safe. Maintenance required.",
    causes: [
      "Accumulated dirt or rust from cheap wire.",
      "Kinked gun cable.",
      "Wrong liner size for the wire diameter."
    ],
    recovery: [
      "Straighten the gun cable as much as possible.",
      "Remove the wire and blow compressed air through the liner.",
      "If the drag continues, replace the liner with a fresh one."
    ],
    keywords: ["liner", "scratch", "jerky", "kink", "drag", "dirty"]
  },
  {
    id: "gas-solenoid",
    code: "GAS",
    label: "Gas Solenoid Malfunction",
    category: "full",
    indicator: "Gas flows constantly or doesn't flow at all when trigger is pulled",
    severity: "warning",
    whatYoureSeeing: "You hear the gas even when not welding, or you get porosity because no gas is coming out of the nozzle.",
    isSafe: "Safe. Affects weld quality, not machine safety.",
    causes: [
      "Debris stuck in the internal gas valve.",
      "Loose wiring to the solenoid.",
      "Frozen regulator."
    ],
    recovery: [
      "Check the regulator for ice (high flow rate issue).",
      "Power cycle the machine to see if the solenoid clicks.",
      "Tap the side of the machine gently to dislodge any internal valve debris."
    ],
    keywords: ["gas", "leak", "solenoid", "valve", "flow", "porosity"]
  }
];

export function findFaultByKeyword(input: string): FaultCode | undefined {
  const text = input.toLowerCase().trim();
  if (!text) return undefined;
  return faultCodes.find((fault) =>
    fault.code.toLowerCase() === text ||
    fault.keywords.some((kw) => text.includes(kw) || kw.includes(text))
  );
}
