// Garage Setup Tools — deterministic quick-setup recommendation + process-aware
// pre-weld checklists. All facts here come from the OmniPro 220 manual values
// already encoded in lib/manualKnowledge.ts (polaritySetups, dutyCycleRows).
// No Claude call is needed; this runs entirely on the client.

import type { WeldProcess } from "@/data/ProductGrounding";

export type QuickSetupAnswers = {
  location: "indoors" | "outdoors";
  hasGas: "yes" | "no";
  material: "mild steel" | "stainless steel" | "aluminum" | "not sure";
  thickness: "thin sheet" | "1/8 inch" | "1/4 inch+" | "not sure";
  wireDiameter?: "0.025" | "0.030" | "0.035+";
  targetFinish?: "structural" | "aesthetic";
};

export type QuickSetupResult = {
  process: Exclude<WeldProcess, "unknown">;
  why: string;
  wiring: string;
  gas: string;
  next: string;
  followUp?: string;
  dutyNote?: string;
};

// Decision rules. Mirrors the rule list in the spec so the recommendation is
// predictable and reviewable.
export function recommendFromAnswers(a: QuickSetupAnswers): QuickSetupResult {
  const outdoors = a.location === "outdoors";
  const noGas = a.hasGas === "no";
  const aluminum = a.material === "aluminum";
  const stainless = a.material === "stainless steel";
  const unknownMaterial = a.material === "not sure";
  const unknownThickness = a.thickness === "not sure";
  const thick = a.thickness === "1/4 inch+";
  const followUp = unknownMaterial
    ? "Confirm the material before welding. Mild steel, stainless, and aluminum use different process and shielding choices."
    : unknownThickness
      ? "Confirm thickness before final settings; thickness drives amperage and duty-cycle limits."
      : undefined;

  if (aluminum) {
    return {
      process: "mig",
      why: "Aluminum needs a spool gun on this machine. Spool-gun MIG is the practical OmniPro setup; without a spool gun, do not treat this like normal steel MIG.",
      wiring: "ground clamp → negative (−), spool gun → positive (+)",
      gas: "Use 100% argon shielding gas through the spool gun. Do not run aluminum gasless.",
      next: outdoors
        ? "Confirm a spool gun and argon are available, then shield the weld from wind before starting."
        : "Confirm a spool gun is available before starting. Without one, this welder cannot run aluminum reliably.",
      followUp: "Do you have a spool gun attachment?"
    };
  }

  if (outdoors && noGas) {
    return {
      process: "flux-core",
      why: "You are outdoors and do not have shielding gas. Flux-core is self-shielded and the only practical choice here.",
      wiring: "ground clamp → positive (+), wire feed cable → negative (−)",
      gas: "Do not connect shielding gas — flux-core wire is self-shielded.",
      next: "Load flux-core wire, set wire tension, and run a short test bead before the real weld.",
      followUp,
      dutyNote: thick ? "For 1/4\"+ steel, use 240V and watch duty cycle at high amperage." : undefined
    };
  }

  if (stainless && !noGas) {
    return {
      process: "tig",
      why: "Stainless welds best with TIG for precision and clean appearance.",
      wiring: "ground clamp → positive (+), TIG torch → negative (−)",
      gas: "Use 100% argon through the TIG torch regulator.",
      next: "Disconnect the wire feed power cable, plug in the foot pedal, and start with a low amperage test on scrap."
    };
  }

  if (stainless && noGas) {
    return {
      process: "stick",
      why: "Stainless needs the right filler and shielding. Without gas, TIG and solid MIG are out; stick is the safer manual-grounded fallback if you have the correct stainless electrode.",
      wiring: "ground clamp → negative (−), electrode holder → positive (+)",
      gas: "No shielding gas for stick.",
      next: "Confirm the electrode is rated for stainless, disconnect the wire feed cable, and test on scrap first.",
      followUp: "Do you have stainless stick electrodes?"
    };
  }

  if (!outdoors && !noGas) {
    const dutyNote = thick
      ? "Thick steel (1/4\" +) usually pushes you to 200A on 240V — that is 25% duty cycle (2.5 min weld, 7.5 min rest)."
      : undefined;
    return {
      process: "mig",
      why: "Indoor work with shielding gas is the easiest, cleanest setup for mild steel.",
      wiring: "ground clamp → negative (−), wire feed cable → positive (+)",
      gas: "Connect shielding gas to the regulator and welder inlet.",
      next: "Load solid MIG wire, set gas flow, and test wire feed before striking an arc.",
      dutyNote,
      followUp
    };
  }

  // Outdoors + gas, or indoors + no gas — fall back to flux-core for outdoor
  // work, MIG otherwise. Stick is mentioned only when material is thick and
  // the user already lacks gas (rugged outdoor option).
  if (outdoors) {
    if (thick) {
      return {
        process: "stick",
        why: "You are outdoors on thicker material. Stick is less sensitive to wind than gas-shielded MIG and is a good rugged setup when the work is heavy.",
        wiring: "ground clamp → negative (−), electrode holder → positive (+)",
        gas: "No shielding gas for stick.",
        next: "Pick the correct electrode, disconnect the wire feed cable, clamp directly to clean metal, and run a test bead.",
        followUp
      };
    }
    return {
      process: "flux-core",
      why: "Outdoor wind blows shielding gas away; flux-core is the practical choice outdoors even if you have a gas bottle.",
      wiring: "ground clamp → positive (+), wire feed cable → negative (−)",
      gas: "Skip shielding gas outdoors — flux-core is self-shielded.",
      next: "Load flux-core wire and run a quick feed test before welding.",
      followUp
    };
  }

  return {
    process: "flux-core",
    why: "Without shielding gas, flux-core is the only safe choice on this machine.",
    wiring: "ground clamp → positive (+), wire feed cable → negative (−)",
    gas: "Do not connect shielding gas.",
    next: "Load flux-core wire and run a quick feed test before welding.",
    followUp,
    dutyNote: thick ? "For 1/4\"+ steel, use 240V and watch duty cycle at high amperage." : undefined
  };
}

export type ChecklistItem = {
  text: string;
  hint: string;
};

// Process-aware pre-weld checklists. Hints are short manual-grounded
// explanations shown when the user clicks "Not sure?".
export const preWeldChecklists: Record<Exclude<WeldProcess, "unknown">, ChecklistItem[]> = {
  "flux-core": [
    { text: "Correct polarity: ground clamp → positive (+), wire feed → negative (−)", hint: "Flux-core uses DCEN. Reversing this gives weak, sticky welds." },
    { text: "No shielding gas connected", hint: "Flux-core wire is self-shielded. Adding gas wastes it and can disrupt the bead." },
    { text: "Flux-core wire installed (not solid MIG wire)", hint: "Solid wire without gas creates porous, useless welds." },
    { text: "Knurled feed roller selected", hint: "Knurled rollers grip soft flux-core wire without crushing it." },
    { text: "Metal cleaned to bare metal", hint: "Paint, rust, and oil cause porosity even with the right setup." },
    { text: "Contact tip matches wire size", hint: "Wrong tip size causes erratic feed and a wandering arc." },
    { text: "Wire stickout / CTWD checked (~3/8\")", hint: "Too much stickout = cold weld; too little = burnback into the tip." }
  ],
  mig: [
    { text: "Correct polarity: ground clamp → negative (−), wire feed → positive (+)", hint: "Solid MIG with gas uses DCEP. Reverse polarity gives porosity and bad fusion." },
    { text: "Shielding gas connected and valve open", hint: "Without gas, solid wire cannot make a sound weld — you will get porosity." },
    { text: "Gas flow set in recommended range (15–25 CFH)", hint: "Too low = porosity; too high = turbulence that pulls air into the weld." },
    { text: "Solid wire installed (not flux-core)", hint: "Flux-core with gas burns the flux poorly and contaminates the bead." },
    { text: "V-groove feed roller selected", hint: "V-groove rollers feed hard solid wire without slipping." },
    { text: "Metal cleaned to bare metal", hint: "Paint, mill scale, and oil cause porosity and weak fusion." },
    { text: "Contact tip matches wire size", hint: "Wrong tip size causes erratic arc length and burnback." }
  ],
  tig: [
    { text: "TIG torch → negative (−)", hint: "TIG uses DCEN. Wrong polarity overheats and destroys the tungsten." },
    { text: "Ground clamp → positive (+)", hint: "Pairs with the torch on negative for DCEN." },
    { text: "Wire feed power cable disconnected", hint: "If the wire feed cable is still plugged in, the torch may not work correctly." },
    { text: "Gas connected through regulator", hint: "TIG needs argon flowing before the arc starts — a few seconds of pre-flow protects the tungsten." },
    { text: "Foot pedal connected (if used)", hint: "Plugs into the connector inside the welder; lets you ramp amperage during the weld." },
    { text: "Metal cleaned (no oil, paint, oxide)", hint: "TIG amplifies any contamination — the bead will spit and discolor." }
  ],
  stick: [
    { text: "Electrode holder → positive (+)", hint: "Most common stick setup is DCEP. Confirm the rod packaging if it specifies otherwise." },
    { text: "Ground clamp → negative (−)", hint: "Pairs with the electrode on positive for DCEP." },
    { text: "Wire feed power cable disconnected", hint: "Stick does not use the wire feed; leave that cable unplugged." },
    { text: "Correct electrode selected", hint: "Match the rod (6011, 6013, 7018…) to the material and joint." },
    { text: "Workpiece cleaned and clamped", hint: "Loose ground clamps cause arc instability and bad starts." }
  ]
};
