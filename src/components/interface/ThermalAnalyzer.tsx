"use client";

import { Clock3 } from "lucide-react";
import { motion } from "framer-motion";
import type { DutyCycleRow } from "@/data/ProductGrounding";

type ThermalAnalyzerProps = {
  rows: DutyCycleRow[];
  highlightKey?: string;
  highlightLabel?: string;
};

export function ThermalAnalyzer({ rows, highlightKey, highlightLabel }: ThermalAnalyzerProps) {
  const activeKey = highlightKey ?? `${rows[0]?.input ?? "240V"}-${rows[0]?.amperage ?? "200A"}`;
  
  const activeRow = rows.find(r => `${r.input}-${r.amperage}` === activeKey) ?? rows[0];
  const dutyPercent = activeRow ? Number(activeRow.dutyCycle.replace("%", "")) : 100;
  
  // Calculate gauge fill (semi-circle)
  // Circumference of semi-circle = Math.PI * radius
  const radius = 46;
  const circumference = Math.PI * radius;
  const strokeDashoffset = circumference - (dutyPercent / 100) * circumference;

  return (
    <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock3 size={18} className="text-brand" />
          <h3 className="text-sm font-bold text-textPrimary uppercase tracking-widest">Duty Cycle</h3>
        </div>
      </div>
      
      {highlightLabel && (
        <div className="mb-5 rounded-xl border border-brand/20 bg-brand/5 px-3 py-2 text-xs font-bold text-brand uppercase tracking-wider text-center">
          {highlightLabel}
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-center gap-8 mb-6">
        <div className="relative w-32 h-20 flex shrink-0 justify-center">
          <svg className="w-full h-full overflow-visible" viewBox="0 0 100 50">
            {/* Background Track */}
            <path
              d="M 4 50 A 46 46 0 0 1 96 50"
              fill="none"
              stroke="currentColor"
              strokeWidth="8"
              strokeLinecap="round"
              className="text-surfaceUp"
            />
            {/* Animated Value Track */}
            <motion.path
              d="M 4 50 A 46 46 0 0 1 96 50"
              fill="none"
              stroke="currentColor"
              strokeWidth="8"
              strokeLinecap="round"
              className="text-brand"
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset }}
              transition={{ duration: 1, ease: "easeOut" }}
            />
          </svg>
          <div className="absolute bottom-0 left-0 right-0 flex flex-col items-center">
            <span className="text-3xl font-black text-textPrimary leading-none">{dutyPercent}%</span>
          </div>
        </div>

        <div className="flex-1 grid grid-cols-2 gap-4 w-full">
          <div className="bg-surfaceUp rounded-xl p-3 border border-border text-center">
            <span className="block text-[10px] font-bold text-textSecondary uppercase tracking-widest mb-1">Weld Time</span>
            <span className="text-lg font-bold text-textPrimary">{activeRow?.weldMinutes} <span className="text-xs text-textSecondary">min</span></span>
          </div>
          <div className="bg-surfaceUp rounded-xl p-3 border border-border text-center">
            <span className="block text-[10px] font-bold text-textSecondary uppercase tracking-widest mb-1">Rest Time</span>
            <span className="text-lg font-bold text-textPrimary">{activeRow?.restMinutes} <span className="text-xs text-textSecondary">min</span></span>
          </div>
        </div>
      </div>

      <div className="grid gap-2 border-t border-border pt-4">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-textSecondary">Available Ratings</p>
        {rows.map((row) => {
          const rowKey = `${row.input}-${row.amperage}`;
          const highlighted = rowKey === activeKey;
          return (
            <div
              key={rowKey}
              className={`flex items-center justify-between rounded-lg p-2.5 text-xs transition-colors ${highlighted
                ? "border border-brand/30 bg-brand/10 text-brand font-bold"
                : "bg-surface hover:bg-surfaceUp text-textSecondary border border-transparent hover:border-border"
                }`}
            >
            <span className="w-12 text-left">{row.input}</span>
            <span className="w-16 text-center">{row.amperage}</span>
            <span className="w-12 text-right">{row.dutyCycle}</span>
          </div>
          );
        })}
      </div>
    </section>
  );
}
