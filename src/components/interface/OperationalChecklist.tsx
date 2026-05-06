"use client";

import { useState } from "react";
import { Check, ChevronDown, ListChecks } from "lucide-react";
import type { ChecklistItem } from "@/engines/quickSetup";
import { preWeldChecklists } from "@/engines/quickSetup";
import type { WeldProcess } from "@/data/ProductGrounding";
import { stripInlineMarkdown } from "@/core/textFormat";

type Props = {
  process: Exclude<WeldProcess, "unknown">;
  items?: ChecklistItem[];
  title?: string;
};

const labelByProcess: Record<Exclude<WeldProcess, "unknown">, string> = {
  mig: "MIG pre-weld checklist",
  "flux-core": "Flux-core pre-weld checklist",
  tig: "TIG pre-weld checklist",
  stick: "Stick pre-weld checklist"
};

export function OperationalChecklist({ process, items, title }: Props) {
  const list = items?.length ? items : preWeldChecklists[process];
  const [checked, setChecked] = useState<boolean[]>(() => list.map(() => false));
  const [openHint, setOpenHint] = useState<number | null>(null);

  const total = list.length;
  const done = checked.filter(Boolean).length;
  const allDone = total > 0 && done === total;

  function toggle(index: number) {
    setChecked((current) => {
      const next = current.length === total ? [...current] : list.map(() => false);
      next[index] = !next[index];
      return next;
    });
  }

  return (
    <section className="rounded-xl border border-black/[0.08] bg-card p-4 shadow-none">
      <header className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brass text-[#171A1F]">
            <ListChecks size={16} />
          </div>
          <h3 className="text-sm font-semibold text-text-primary">{title ?? labelByProcess[process]}</h3>
        </div>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${allDone ? "bg-emerald-400/15 text-emerald-300" : "bg-card-soft text-text-secondary ring-1 ring-black/[0.08]"}`}>
          {done}/{total}
        </span>
      </header>

      <ul className="space-y-2">
        {list.map((item, index) => {
          const isChecked = !!checked[index];
          const isHintOpen = openHint === index;
          return (
            <li
              key={`${item.text}-${index}`}
              className={`rounded-xl border p-2.5 transition ${isChecked ? "border-emerald-300/30 bg-emerald-400/10" : "border-black/[0.08] bg-card"}`}
            >
              <div className="flex items-start gap-2.5">
                <button
                  type="button"
                  onClick={() => toggle(index)}
                  aria-pressed={isChecked}
                  aria-label={isChecked ? "Uncheck item" : "Check item"}
                  className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border ${isChecked ? "border-emerald-400 bg-emerald-400 text-black" : "border-black/20 bg-card-soft text-transparent hover:border-black/30"}`}
                >
                  <Check size={13} />
                </button>
                <div className="min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => toggle(index)}
                    className={`block w-full text-left text-sm leading-5 transition-all ${isChecked ? "text-[#9CA3AF] line-through opacity-70" : "text-text-primary"}`}
                  >
                    {stripInlineMarkdown(item.text)}
                  </button>
                  <button
                    type="button"
                    onClick={() => setOpenHint(isHintOpen ? null : index)}
                    aria-expanded={isHintOpen}
                    className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-text-secondary hover:text-text-primary"
                  >
                    Not sure?
                    <ChevronDown size={11} className={`transition ${isHintOpen ? "rotate-180" : ""}`} />
                  </button>
                  {isHintOpen ? (
                    <p className="mt-1.5 rounded-xl bg-card-soft px-2.5 py-1.5 text-xs leading-5 text-text-secondary ring-1 ring-black/[0.08]">
                      {stripInlineMarkdown(item.hint)}
                    </p>
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {allDone ? (
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-300/30 bg-emerald-400/10 px-3 py-2 text-sm font-semibold text-emerald-300">
          <Check size={15} /> All checks complete — strike a short test arc on scrap first.
        </div>
      ) : null}
    </section>
  );
}
