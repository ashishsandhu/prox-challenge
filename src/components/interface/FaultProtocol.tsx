"use client";

import { AlertTriangle, CheckCircle2, Info, ShieldAlert, Zap } from "lucide-react";
import type { FaultCode, FaultSeverity } from "@/data/HardwareFaultRegistry";
import { GroundingNodes } from "@/components/interface/GroundingNodes";
import { stripInlineMarkdown } from "@/core/textFormat";

const severityStyle: Record<FaultSeverity, { icon: React.ReactNode; text: string }> = {
  info: { icon: <Info size={16} className="text-textSecondary" />, text: "text-textSecondary" },
  warning: { icon: <Zap size={16} className="text-amber" />, text: "text-amber" },
  danger: { icon: <ShieldAlert size={16} className="text-red" />, text: "text-red" }
};

export function FaultProtocol({ fault }: { fault: FaultCode }) {
  const style = severityStyle[fault.severity];
  
  return (
    <section className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
      <header className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {style.icon}
          <div>
            <h3 className="text-base font-semibold text-textPrimary">{fault.label}</h3>
            <p className="text-xs text-textSecondary uppercase tracking-wide mt-0.5">Diagnostic View</p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-border bg-surfaceUp px-3 py-1.5">
          <span className="text-[10px] font-bold text-textSecondary uppercase tracking-wider">Fault Code</span>
          <span className={`text-sm font-bold ${style.text}`}>{fault.code}</span>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 text-sm mb-6">
        <div className="rounded-xl bg-surfaceUp p-4">
          <span className="block font-semibold text-textPrimary mb-1">Observation</span>
          <p className="text-textSecondary leading-relaxed">{stripInlineMarkdown(fault.indicator)}</p>
        </div>
        <div className="rounded-xl bg-surfaceUp p-4">
          <span className="block font-semibold text-textPrimary mb-1">Status</span>
          <p className="text-textSecondary leading-relaxed">{stripInlineMarkdown(fault.whatYoureSeeing)}</p>
        </div>
      </div>

      <div className="flex items-start gap-3 rounded-xl border border-brand/20 bg-brand/5 p-4 mb-6">
        <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-brand" />
        <div>
          <span className="block font-semibold text-brand mb-1">Safety Assessment</span>
          <p className="text-sm text-textSecondary leading-relaxed">{stripInlineMarkdown(fault.isSafe)}</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-xl border border-border p-4">
          <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-textPrimary">
            <AlertTriangle size={14} className="text-textSecondary" />
            Root Causes
          </p>
          <ul className="space-y-2.5 text-sm text-textSecondary">
            {fault.causes.map((cause) => (
              <li key={cause} className="flex items-start gap-2.5">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-textDim" />
                <span className="leading-relaxed">{stripInlineMarkdown(cause)}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-border p-4">
          <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-textPrimary">
            <CheckCircle2 size={14} className="text-textSecondary" />
            Recovery Steps
          </p>
          <ol className="space-y-2.5 text-sm text-textSecondary">
            {fault.recovery.map((step, i) => (
              <li key={step} className="flex items-start gap-2.5">
                <span className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-surfaceUp border border-border text-[10px] font-bold text-textPrimary">
                  {i + 1}
                </span>
                <span className="leading-relaxed">{stripInlineMarkdown(step)}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>

    </section>
  );
}
