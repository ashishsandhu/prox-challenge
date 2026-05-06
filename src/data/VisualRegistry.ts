import type { ManualRef, WeldProcess } from "@/data/ProductGrounding";
import { ownerRef, quickRef, selectionRef } from "@/data/ProductGrounding";

export type ManualImageIntent =
  | "setup"
  | "polarity"
  | "duty_cycle"
  | "troubleshooting"
  | "wire_loading"
  | "process_selection"
  | "settings_recommendation"
  | "front_panel_controls"
  | "manual_image_question";

export type ManualImageIndexEntry = {
  id: string;
  title: string;
  source: ManualRef["source"];
  page: string;
  imagePath: string;
  visualDescription: string;
  keyLabels: string[];
  relatedIntents: ManualImageIntent[];
  relatedProcesses: Array<Exclude<WeldProcess, "unknown">>;
  extractedFacts: string[];
  whenToShowIt: string;
};

export const manualImageIndex: ManualImageIndexEntry[] = [
  {
    id: "front-panel-controls",
    title: "Front panel controls",
    source: "Owner's Manual",
    page: "8",
    imagePath: "/manual-images/owner-p8.png",
    visualDescription: "Front panel with positive/negative sockets and wire feed connection point.",
    keyLabels: ["Positive socket", "Negative socket", "Wire feed cable", "Control panel"],
    relatedIntents: ["front_panel_controls", "polarity", "manual_image_question"],
    relatedProcesses: ["mig", "flux-core", "tig", "stick"],
    extractedFacts: [
      "Positive and negative output sockets are on the lower front panel.",
      "Wire feed cable uses front output connection and polarity must match process.",
      "Front panel is used to verify cable placement before welding."
    ],
    whenToShowIt: "When user asks where sockets are, how to identify controls, or confirms cable placement."
  },
  {
    id: "wire-feed-interior",
    title: "Interior wire feed mechanism",
    source: "Owner's Manual",
    page: "17",
    imagePath: "/manual-images/owner-p17.png",
    visualDescription: "Wire feed compartment with drive roller and tension assembly.",
    keyLabels: ["Drive roller", "Tensioner", "Inlet guide", "Spool hub"],
    relatedIntents: ["wire_loading", "manual_image_question", "troubleshooting"],
    relatedProcesses: ["mig", "flux-core"],
    extractedFacts: [
      "Drive roller groove must match wire diameter.",
      "Tension should feed wire without crushing it.",
      "Wire path should remain straight through the guides."
    ],
    whenToShowIt: "When user has feed jams, bird-nesting, or asks where to route wire."
  },
  {
    id: "quick-start-wire-loading",
    title: "Quick start wire loading",
    source: "Quick Start Guide",
    page: "1",
    imagePath: "/manual-images/quick-p1.png",
    visualDescription: "Step visual for spool orientation, guide path, and tension adjustment.",
    keyLabels: ["Spool direction", "Feed guides", "Tension adjustment"],
    relatedIntents: ["wire_loading", "manual_image_question", "troubleshooting"],
    relatedProcesses: ["mig", "flux-core"],
    extractedFacts: [
      "Wire should unwind toward inlet guide.",
      "Feed through guides before tightening tension.",
      "Cold-feed check should be done before welding."
    ],
    whenToShowIt: "When user asks how to load wire or troubleshoot inconsistent feed."
  },
  {
    id: "flux-core-setup-diagram",
    title: "Flux-core setup diagram",
    source: "Owner's Manual",
    page: "13",
    imagePath: "/manual-images/owner-p13.png",
    visualDescription: "Flux-core gasless polarity setup diagram.",
    keyLabels: ["Ground clamp", "Wire feed cable", "Positive socket", "Negative socket"],
    relatedIntents: ["setup", "polarity"],
    relatedProcesses: ["flux-core"],
    extractedFacts: [
      "Ground clamp goes to positive socket for flux-core.",
      "Wire feed cable goes to negative socket for flux-core.",
      "Gasless flux-core does not use shielding gas."
    ],
    whenToShowIt: "When user asks flux-core wiring/polarity or gas usage."
  },
  {
    id: "mig-setup-diagram",
    title: "MIG setup diagram",
    source: "Owner's Manual",
    page: "14",
    imagePath: "/manual-images/owner-p14.png",
    visualDescription: "Gas-shielded MIG polarity with gas connection.",
    keyLabels: ["Ground clamp", "Wire feed cable", "Gas line", "Regulator"],
    relatedIntents: ["setup", "polarity"],
    relatedProcesses: ["mig"],
    extractedFacts: [
      "Ground clamp goes to negative socket for MIG.",
      "Wire feed cable goes to positive socket for MIG.",
      "Shielding gas line is required for solid MIG wire."
    ],
    whenToShowIt: "When user asks MIG wiring or gas-shielded setup checks."
  },
  {
    id: "tig-setup-diagram",
    title: "TIG setup diagram",
    source: "Owner's Manual",
    page: "24",
    imagePath: "/manual-images/owner-p24.png",
    visualDescription: "Shows TIG torch in negative, ground in positive, gas and foot pedal connections.",
    keyLabels: ["TIG torch", "Ground clamp", "Foot pedal", "Gas hose"],
    relatedIntents: ["setup", "polarity"],
    relatedProcesses: ["tig"],
    extractedFacts: [
      "Ground clamp cable goes in positive socket.",
      "TIG torch cable goes in negative socket.",
      "Foot pedal connects inside welder.",
      "Shielding gas hose connects to regulator.",
      "Wire feed cable stays disconnected during TIG."
    ],
    whenToShowIt: "When user asks TIG cable routing, pedal connection, or gas hookup."
  },
  {
    id: "stick-setup-diagram",
    title: "Stick setup diagram",
    source: "Owner's Manual",
    page: "27",
    imagePath: "/manual-images/owner-p27.png",
    visualDescription: "Stick welding cable configuration diagram.",
    keyLabels: ["Electrode holder", "Ground clamp", "Positive socket", "Negative socket"],
    relatedIntents: ["setup", "polarity"],
    relatedProcesses: ["stick"],
    extractedFacts: [
      "Electrode holder goes to positive socket.",
      "Ground clamp goes to negative socket.",
      "Wire feed cable remains disconnected for stick."
    ],
    whenToShowIt: "When user asks stick setup or confirms holder polarity."
  },
  {
    id: "duty-cycle-chart",
    title: "Duty cycle chart",
    source: "Owner's Manual",
    page: "7",
    imagePath: "/manual-images/owner-p20.png",
    visualDescription: "Duty cycle table with amperage and percentage ratings.",
    keyLabels: ["120V ratings", "240V ratings", "Duty cycle", "Weld/rest window"],
    relatedIntents: ["duty_cycle"],
    relatedProcesses: ["mig"],
    extractedFacts: [
      "At 240V 200A, duty cycle is 25% (2.5 min weld / 7.5 min rest).",
      "At 120V 100A, duty cycle is 40% (4 min weld / 6 min rest).",
      "Duty cycle is measured over a 10-minute window."
    ],
    whenToShowIt: "When user asks weld time limits, overheating, or rest intervals."
  },
  {
    id: "weld-diagnosis",
    title: "Weld diagnosis chart",
    source: "Owner's Manual",
    page: "37",
    imagePath: "/manual-images/owner-p37.png",
    visualDescription: "Examples of porosity, spatter, and other weld defects with checks.",
    keyLabels: ["Porosity", "Spatter", "Burn-through", "Corrective actions"],
    relatedIntents: ["troubleshooting", "manual_image_question"],
    relatedProcesses: ["mig", "flux-core", "tig", "stick"],
    extractedFacts: [
      "Porosity often maps to shielding issues, contamination, or polarity mismatch.",
      "Spatter and unstable arc can be caused by setup mismatch or settings drift.",
      "Diagnosis should start with setup checks before technique tuning."
    ],
    whenToShowIt: "When user reports defect symptoms or uploads questionable weld beads."
  },
  {
    id: "process-selection-chart",
    title: "Process selection chart",
    source: "Selection Chart",
    page: "1",
    imagePath: "/manual-images/selection-p1.png",
    visualDescription: "Matrix comparing MIG, flux-core, TIG, and stick by use case.",
    keyLabels: ["MIG", "Flux-core", "TIG", "Stick", "Material/thickness guidance"],
    relatedIntents: ["process_selection", "settings_recommendation"],
    relatedProcesses: ["mig", "flux-core", "tig", "stick"],
    extractedFacts: [
      "MIG is clean and indoor-friendly when gas is available.",
      "Flux-core is useful outdoors and without shielding gas.",
      "TIG prioritizes precision and control.",
      "Stick is robust for rough/outdoor and thicker sections."
    ],
    whenToShowIt: "When user asks which process to choose or compares two processes."
  }
];

export function getManualImageRef(entry: ManualImageIndexEntry): ManualRef {
  if (entry.source === "Owner's Manual") return ownerRef(entry.title, entry.page);
  if (entry.source === "Quick Start Guide") return quickRef(entry.title, entry.page);
  return selectionRef(entry.title);
}

export function findManualImagesByIntent(intent: ManualImageIntent) {
  return manualImageIndex.filter((entry) => entry.relatedIntents.includes(intent));
}

export function findManualImageById(id?: string) {
  if (!id) return undefined;
  return manualImageIndex.find((entry) => entry.id === id);
}
