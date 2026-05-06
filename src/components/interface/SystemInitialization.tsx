"use client";

import { useState } from "react";
import { X, Activity, Cpu, Zap, ChevronRight, ChevronLeft, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { QuickSetupAnswers } from "@/engines/quickSetup";

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmit: (answers: QuickSetupAnswers) => void;
};

type QuickSetupKey = keyof QuickSetupAnswers;

const steps = [
  {
    key: "location" as QuickSetupKey,
    label: "ENVIRONMENTAL_SCAN",
    question: "Select operational deployment zone:",
    options: [
      { value: "indoors", label: "INTERNAL_FACILITY", desc: "Stable atmosphere, 0% wind interference." },
      { value: "outdoors", label: "EXTERNAL_FIELD", desc: "Atmospheric turbulence, shielding required." }
    ]
  },
  {
    key: "hasGas" as QuickSetupKey,
    label: "PNEUMATIC_VERIFICATION",
    question: "Shielding gas availability detected?",
    options: [
      { value: "yes", label: "GAS_ACTIVE", desc: "Regulated argon/CO2 supply connected." },
      { value: "no", label: "GASLESS_MODE", desc: "Flux-core / Self-shielded operation." }
    ]
  },
  {
    key: "material" as QuickSetupKey,
    label: "SUBSTRATE_ANALYSIS",
    question: "Identify primary target material:",
    options: [
      { value: "mild steel", label: "CARBON_STEEL", desc: "Standard industrial ferrous alloy." },
      { value: "stainless steel", label: "STAINLESS", desc: "Corrosion-resistant chromium alloy." },
      { value: "aluminum", label: "ALUMINUM", desc: "Thermal-intensive non-ferrous substrate." },
      { value: "not sure", label: "UNDEFINED", desc: "Unknown substrate composition." }
    ]
  },
  {
    key: "thickness" as QuickSetupKey,
    label: "GEOMETRIC_SCAN",
    question: "Specify material gauge/thickness:",
    options: [
      { value: "thin sheet", label: "GAUGE_THIN", desc: "< 14 Gauge (Low amperage)." },
      { value: "1/8 inch", label: "GAUGE_MID", desc: "1/8\" Nominal thickness." },
      { value: "1/4 inch+", label: "GAUGE_HEAVY", desc: "> 1/4\" Structural plate." },
      { value: "not sure", label: "UNCERTAIN", desc: "Default to median parameters." }
    ]
  },
  {
    key: "wireDiameter" as QuickSetupKey,
    label: "CONSUMABLE_CALIBRATION",
    question: "Select wire/electrode diameter:",
    options: [
      { value: "0.025", label: "0.025 IN", desc: "Precision thin-metal wire." },
      { value: "0.030", label: "0.030 IN", desc: "Standard all-purpose wire." },
      { value: "0.035+", label: "0.035 IN+", desc: "Heavy deposition / Structural." }
    ]
  },
  {
    key: "targetFinish" as QuickSetupKey,
    label: "OUTPUT_HEURISTICS",
    question: "Determine primary weld objective:",
    options: [
      { value: "structural", label: "STRENGTH_FIRST", desc: "Maximum penetration and integrity." },
      { value: "aesthetic", label: "VISUAL_FIRST", desc: "Clean, stack-of-dime appearance." }
    ]
  }
];

export function SystemInitialization({ open, onClose, onSubmit }: Props) {
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Partial<QuickSetupAnswers>>({});
  const [isInitializing, setIsInitializing] = useState(false);

  if (!open) return null;

  const step = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;

  function pick(value: QuickSetupAnswers[QuickSetupKey]) {
    setAnswers((prev) => ({ ...prev, [step.key]: value }));
    if (!isLastStep) {
      setCurrentStep((s) => s + 1);
    }
  }

  async function handleFinalize() {
    setIsInitializing(true);
    // Simulate system scan
    await new Promise((r) => setTimeout(r, 1500));
    onSubmit(answers as QuickSetupAnswers);
    setIsInitializing(false);
    handleClose();
  }

  function handleClose() {
    setAnswers({});
    setCurrentStep(0);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 dark:bg-[#0A0A0A]/90 p-4 backdrop-blur-xl">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-2xl overflow-hidden rounded-[2.5rem] bg-white dark:bg-[#141414] border border-border dark:border-white/5 shadow-2xl"
      >
        {/* HUD Header */}
        <header className="flex items-center justify-between px-10 py-8 border-b border-white/5">
          <div className="flex items-center gap-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/10 border border-brand/20 text-brand shadow-[0_0_20px_rgba(245,158,11,0.2)]">
              <Cpu size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-brand/60">System_Init</span>
                <div className="h-1 w-1 rounded-full bg-brand animate-pulse" />
              </div>
              <h2 className="text-xl font-black text-white uppercase tracking-tight">Sequence {currentStep + 1} of {steps.length}</h2>
            </div>
          </div>
          <button onClick={handleClose} className="h-10 w-10 flex items-center justify-center rounded-full hover:bg-white/5 text-textSecondary transition-colors">
            <X size={20} />
          </button>
        </header>

        {/* HUD Progress Bar */}
        <div className="flex h-1.5 w-full bg-white/5">
          <motion.div 
            className="h-full bg-brand shadow-[0_0_15px_rgba(245,158,11,0.5)]"
            initial={{ width: 0 }}
            animate={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
          />
        </div>

        <div className="p-10">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              <div className="flex items-center gap-3">
                <Activity size={16} className="text-brand" />
                <span className="text-[10px] font-mono text-brand tracking-widest">{step.label}</span>
              </div>
              
              <h3 className="text-2xl font-bold text-white leading-tight">{step.question}</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {step.options.map((opt) => {
                  const active = (answers as any)[step.key] === opt.value;
                  return (
                    <button
                      key={String(opt.value)}
                      onClick={() => pick(opt.value as QuickSetupAnswers[QuickSetupKey])}
                      className={`group relative flex flex-col items-start p-6 rounded-3xl border transition-all duration-300 text-left ${
                        active 
                          ? "bg-brand/10 border-brand shadow-[0_0_30px_rgba(245,158,11,0.1)]" 
                          : "bg-white/5 border-white/5 hover:border-white/20 hover:bg-white/[0.08]"
                      }`}
                    >
                      <span className={`text-[10px] font-black tracking-widest mb-2 transition-colors ${active ? "text-brand" : "text-textDim"}`}>
                        {opt.label}
                      </span>
                      <span className="text-sm font-bold text-textPrimary mb-1">{opt.value === 'yes' || opt.value === 'no' ? opt.value.toUpperCase() : opt.value}</span>
                      <p className="text-[11px] leading-relaxed text-textSecondary group-hover:text-textPrimary transition-colors">{opt.desc}</p>
                      {active && (
                        <div className="absolute top-4 right-4">
                          <Zap size={14} className="text-brand fill-brand" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        <footer className="flex items-center justify-between px-10 py-8 bg-white/[0.02] border-t border-white/5">
          <button
            onClick={() => setCurrentStep((s) => Math.max(0, s - 1))}
            disabled={currentStep === 0 || isInitializing}
            className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-textSecondary hover:text-white disabled:opacity-30"
          >
            <ChevronLeft size={16} /> Back
          </button>

          <div className="flex gap-4">
            {isLastStep && answers[step.key] ? (
              <button
                onClick={handleFinalize}
                disabled={isInitializing}
                className="flex items-center gap-3 bg-brand px-8 py-4 rounded-2xl text-[12px] font-black uppercase tracking-widest text-[#0A0A0A] hover:bg-brandDim transition-all active:scale-95 shadow-[0_0_30px_rgba(245,158,11,0.3)]"
              >
                {isInitializing ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> 
                    COMPILING_SETUP...
                  </>
                ) : (
                  <>
                    RUN_INITIALIZATION <ChevronRight size={16} />
                  </>
                )}
              </button>
            ) : null}
          </div>
        </footer>
      </motion.div>
    </div>
  );
}

