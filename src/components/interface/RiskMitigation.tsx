import { AlertTriangle, Info } from "lucide-react";
import type { SmartWarning } from "@/engines/RiskAssessmentEngine";
import { stripInlineMarkdown } from "@/core/textFormat";

export function RiskMitigation({ warnings }: { warnings: SmartWarning[] }) {
  if (!warnings.length) return null;
  return (
    <section className="space-y-2">
      {warnings.map((w) => {
        const isWarn = w.severity === "warning";
        return (
          <div
            key={w.id}
            className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-sm leading-5 shadow-none ${isWarn ? "border-ember/30 bg-ember/10 text-text-primary" : "border-sky-300/25 bg-sky-400/10 text-text-primary"}`}
          >
            {isWarn ? (
              <AlertTriangle size={16} className="mt-0.5 shrink-0 text-ember" />
            ) : (
              <Info size={16} className="mt-0.5 shrink-0 text-sky-300" />
            )}
            <span>{stripInlineMarkdown(w.text)}</span>
          </div>
        );
      })}
    </section>
  );
}
