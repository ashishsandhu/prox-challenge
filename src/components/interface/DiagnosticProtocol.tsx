"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Check, CheckCircle2, ChevronDown, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { stripInlineMarkdown } from "@/core/textFormat";

export type TroubleshootingItem = { cause: string; check: string; fix: string };
type StepState = "pending" | "fixed" | "skipped";

type DiagnosticProtocolProps = {
  steps?: string[];
  items?: TroubleshootingItem[];
  symptom?: string;
};

export function DiagnosticProtocol({ steps, items, symptom }: DiagnosticProtocolProps) {
  const nodes = useMemo<TroubleshootingItem[]>(() => {
    const raw = items?.length
      ? items
      : steps?.length
        ? steps.map((step) => ({ cause: step, check: step, fix: step }))
        : [];
    return raw.map((it) => ({
      cause: stripInlineMarkdown(it.cause),
      check: stripInlineMarkdown(it.check),
      fix: stripInlineMarkdown(it.fix)
    }));
  }, [items, steps]);

  const cleanSymptom = symptom ? stripInlineMarkdown(symptom) : undefined;

  const [states, setStates] = useState<StepState[]>(() => nodes.map(() => "pending"));
  const [openIdx, setOpenIdx] = useState<number>(0);

  if (!nodes.length) return null;

  const activeStates = states.length === nodes.length ? states : nodes.map(() => "pending" as StepState);
  const allFixed = activeStates.every((s) => s === "fixed");
  const allChecked = activeStates.every((s) => s !== "pending");
  const issuePersists = allChecked && activeStates.some((s) => s === "skipped");

  function setState(index: number, state: StepState) {
    setStates((current) => {
      const next = current.length === nodes.length ? [...current] : nodes.map(() => "pending" as StepState);
      next[index] = state;
      return next;
    });
    if (state === "skipped" && index + 1 < nodes.length) setOpenIdx(index + 1);
  }

  return (
    <section className="rounded-xl border border-border bg-surface p-4 shadow-sm">
      <header className="mb-4 flex items-center gap-3 rounded-xl border border-brand/20 bg-brand/5 px-4 py-3">
        <AlertTriangle size={18} className="shrink-0 text-brand" />
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-widest text-brand">Symptom Diagnostic</div>
          <div className="truncate text-sm font-semibold text-textPrimary">{cleanSymptom ?? "Weld defect reported"}</div>
        </div>
      </header>

      <ol className="relative ml-4 border-l-2 border-dashed border-border/60 pb-2">
        {nodes.map((item, index) => {
          const state = activeStates[index];
          const isOpen = openIdx === index;
          const isLast = index === nodes.length - 1;
          const tone =
            state === "fixed" ? "border-emerald-500/30 bg-emerald-500/10"
              : state === "skipped" ? "border-border bg-surface opacity-70"
                : isOpen ? "border-brand/40 bg-brand/5 shadow-glow-sm"
                  : "border-border bg-surface hover:border-border/80";
          const dotTone =
            state === "fixed" ? "bg-emerald-500 text-white shadow-sm"
              : state === "skipped" ? "bg-surfaceUp text-textSecondary border border-border"
                : isOpen ? "bg-brand text-white shadow-glow-sm" 
                  : "bg-surface text-textSecondary border border-border";

          return (
            <motion.li 
              key={`${item.cause}-${index}`} 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`relative pb-4 pl-6 ${isLast ? "pb-0 border-transparent" : ""}`}
            >
              <motion.span 
                layout
                className={`absolute -left-[13px] top-1 flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold transition-colors duration-300 ${dotTone}`}
              >
                {state === "fixed" ? <Check size={13} /> : state === "skipped" ? <X size={12} /> : index + 1}
              </motion.span>

              <motion.div layout className={`rounded-xl border p-3.5 transition-all duration-300 ${tone}`}>
                <button
                  type="button"
                  onClick={() => setOpenIdx(isOpen ? -1 : index)}
                  className="flex w-full items-start justify-between gap-3 text-left"
                >
                  <div className="min-w-0">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-textSecondary mb-0.5">Check #{index + 1}</div>
                    <div className="text-sm font-semibold text-textPrimary leading-tight">{item.cause}</div>
                  </div>
                  <ChevronDown size={16} className={`mt-1 shrink-0 text-textSecondary transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`} />
                </button>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2, ease: "easeInOut" }}
                      className="overflow-hidden"
                    >
                      <div className="mt-3 space-y-3 border-t border-border pt-3">
                        <div className="text-sm text-textSecondary leading-relaxed">
                          <span className="text-[10px] font-bold uppercase tracking-widest text-textSecondary mr-1.5">How:</span>
                          {item.check}
                        </div>
                        <div className="flex items-start gap-2 text-sm text-textPrimary leading-relaxed bg-surfaceUp p-3 rounded-lg border border-border/50">
                          <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-brand" />
                          <span><span className="font-bold uppercase tracking-widest text-[10px] text-brand block mb-0.5">Resolution</span>{item.fix}</span>
                        </div>
                        {state === "pending" ? (
                          <div className="flex gap-2 pt-2">
                            <button
                              type="button"
                              onClick={() => setState(index, "fixed")}
                              className="inline-flex flex-1 justify-center items-center gap-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 text-xs font-bold text-emerald-600 transition hover:bg-emerald-500 hover:text-white"
                            >
                              <Check size={14} /> Fixed it
                            </button>
                            <button
                              type="button"
                              onClick={() => setState(index, "skipped")}
                              className="inline-flex flex-1 justify-center items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-bold text-textSecondary transition hover:bg-surfaceUp hover:text-textPrimary"
                            >
                              <X size={14} /> Still happening
                            </button>
                          </div>
                        ) : (
                          <div className="pt-1">
                            <button
                              type="button"
                              onClick={() => setState(index, "pending")}
                              className="text-[11px] font-bold tracking-wide text-textSecondary underline-offset-4 hover:underline transition hover:text-brand"
                            >
                              Reset diagnostic step
                            </button>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            </motion.li>
          );
        })}
      </ol>

      <AnimatePresence>
        {allFixed && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="mt-4 flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-600"
          >
            <CheckCircle2 size={18} className="shrink-0" /> 
            <span>All diagnostics cleared. Run a test bead to verify.</span>
          </motion.div>
        )}
        {issuePersists && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="mt-4 rounded-xl border border-amber/30 bg-amber/10 px-4 py-3 text-sm font-medium text-amber"
          >
            Issue persists despite checks. Consider providing a photo or detailed description of the current bead state.
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
