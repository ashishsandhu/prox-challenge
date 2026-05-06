import { Gauge, Info } from "lucide-react";
import type { SettingRecommendation } from "@/data/ProductGrounding";
import { stripInlineMarkdown } from "@/core/textFormat";

export function SettingsRecommendationCard({ recommendation }: { recommendation: SettingRecommendation }) {
  return (
    <section className="rounded-xl border border-black/[0.08] bg-card p-4 shadow-none">
      <div className="mb-3 flex items-center gap-2">
        <Gauge size={18} className="text-acid" />
        <h3 className="text-sm font-semibold text-text-primary">Setup recommendation</h3>
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm xl:grid-cols-4">
        <div className="rounded-xl border border-black/[0.08] bg-card-soft p-2">
          <div className="text-xs font-semibold uppercase text-text-secondary">Process</div>
          <div className="font-semibold text-text-primary">{recommendation.process}</div>
        </div>
        <div className="rounded-xl border border-black/[0.08] bg-card-soft p-2">
          <div className="text-xs font-semibold uppercase text-text-secondary">Material</div>
          <div className="font-semibold text-text-primary">{recommendation.material}</div>
        </div>
        <div className="rounded-xl border border-black/[0.08] bg-card-soft p-2">
          <div className="text-xs font-semibold uppercase text-text-secondary">Thickness</div>
          <div className="font-semibold text-text-primary">{recommendation.thickness}</div>
        </div>
        <div className="rounded-xl border border-black/[0.08] bg-card-soft p-2">
          <div className="text-xs font-semibold uppercase text-text-secondary">Input</div>
          <div className="font-semibold text-text-primary">{recommendation.inputVoltage}</div>
        </div>
      </div>
      <p className="mt-3 text-sm leading-6 text-text-secondary">{stripInlineMarkdown(recommendation.summary)}</p>
      {recommendation.exactMatch === false ? (
        <div className="mt-3 rounded-xl border border-acid/25 bg-acid/10 p-3 text-sm text-text-primary">
          The manual does not give an exact setting for this full combination. Use this as the closest grounded starting point.
          {recommendation.missingInfo?.length ? ` Missing details: ${recommendation.missingInfo.join(", ")}.` : ""}
        </div>
      ) : null}
      <ol className="mt-3 space-y-2">
        {recommendation.steps.map((step, index) => (
          <li key={step} className="flex gap-2 text-sm leading-6 text-text-secondary">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-acid text-xs font-bold text-black">
              {index + 1}
            </span>
            <span>{stripInlineMarkdown(step)}</span>
          </li>
        ))}
      </ol>
      {recommendation.caution ? (
        <div className="mt-3 flex gap-2 rounded-xl border border-acid/25 bg-acid/10 p-3 text-sm text-text-primary">
          <Info size={16} className="mt-0.5 shrink-0" />
          <span>{stripInlineMarkdown(recommendation.caution)}</span>
        </div>
      ) : null}
    </section>
  );
}
