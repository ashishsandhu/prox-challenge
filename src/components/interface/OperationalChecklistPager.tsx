"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { OperationalChecklist } from "@/components/interface/OperationalChecklist";
import type { ChecklistItem } from "@/engines/quickSetup";
import type { WeldProcess } from "@/data/ProductGrounding";

export type OperationalChecklistEntry = {
  process: Exclude<WeldProcess, "unknown">;
  items?: ChecklistItem[];
  title?: string;
};

const SHORT_LABEL: Record<Exclude<WeldProcess, "unknown">, string> = {
  mig: "MIG",
  "flux-core": "Flux-core",
  tig: "TIG",
  stick: "Stick"
};

// Wraps multiple OperationalChecklists in a pager so a multi-process compare
// answer doesn't balloon the chat bubble. Renders one checklist at a time
// with prev/next arrows and small process pills for direct jump. Falls
// back to a plain single OperationalChecklist when only one entry is given.
export function OperationalChecklistPager({ entries }: { entries: OperationalChecklistEntry[] }) {
  const [index, setIndex] = useState(0);
  if (!entries.length) return null;
  if (entries.length === 1) {
    const only = entries[0];
    return <OperationalChecklist process={only.process} items={only.items} title={only.title} />;
  }
  const safeIndex = Math.min(index, entries.length - 1);
  const current = entries[safeIndex];
  const prev = () => setIndex((i) => (i - 1 + entries.length) % entries.length);
  const next = () => setIndex((i) => (i + 1) % entries.length);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 rounded-xl border border-black/[0.08] bg-card-soft/40 px-2 py-1.5">
        <button
          type="button"
          onClick={prev}
          aria-label="Previous checklist"
          className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-text-secondary transition hover:bg-card hover:text-text-primary"
        >
          <ChevronLeft size={16} />
        </button>
        <div className="flex flex-1 items-center justify-center gap-1.5 overflow-x-auto">
          {entries.map((entry, i) => {
            const active = i === safeIndex;
            return (
              <button
                key={entry.process}
                type="button"
                onClick={() => setIndex(i)}
                aria-current={active ? "true" : undefined}
                className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition ${
                  active
                    ? "bg-brass text-[#171A1F]"
                    : "bg-card text-text-secondary ring-1 ring-black/[0.08] hover:text-text-primary"
                }`}
              >
                {SHORT_LABEL[entry.process]}
              </button>
            );
          })}
        </div>
        <span className="px-1 text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
          {safeIndex + 1}/{entries.length}
        </span>
        <button
          type="button"
          onClick={next}
          aria-label="Next checklist"
          className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-text-secondary transition hover:bg-card hover:text-text-primary"
        >
          <ChevronRight size={16} />
        </button>
      </div>
      <OperationalChecklist
        key={current.process}
        process={current.process}
        items={current.items}
        title={current.title}
      />
    </div>
  );
}
