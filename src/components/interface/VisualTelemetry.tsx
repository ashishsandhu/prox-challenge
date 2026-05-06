import { AlertTriangle, CheckCircle2, Camera } from "lucide-react";
import { stripInlineMarkdown } from "@/core/textFormat";

export type ImageDiagnosis = {
  category: "weld_bead_defect" | "wiring_setup" | "front_panel" | "wire_feed" | "unknown";
  likelyIssue: string;
  visualClues: string[];
  checks: string[];
  fixes: string[];
  confidence: "low" | "medium" | "high";
  caution?: string;
};

export function VisualTelemetry({
  diagnosis,
  reference
}: {
  diagnosis: ImageDiagnosis;
  reference?: { title: string; page?: string };
}) {
  return (
    <section className="rounded-xl border border-black/[0.08] bg-card p-4 shadow-none">
      <div className="mb-3 flex items-center gap-2">
        <Camera size={18} className="text-acid" />
        <h3 className="text-sm font-semibold text-text-primary">Image diagnosis</h3>
      </div>

      <div className="rounded-xl border border-black/[0.08] bg-card-soft p-3 text-sm">
        <p className="font-semibold text-text-primary">Likely issue: {stripInlineMarkdown(diagnosis.likelyIssue)}</p>
        <p className="mt-1 text-xs text-text-secondary">Confidence: {diagnosis.confidence}</p>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase text-text-secondary">Visual clues</p>
          <ul className="space-y-1 text-sm text-text-secondary">
            {diagnosis.visualClues.map((item) => (
              <li key={item} className="flex items-start gap-2">
                <CheckCircle2 size={14} className="mt-1 shrink-0 text-emerald-600" />
                <span>{stripInlineMarkdown(item)}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="mb-1 text-xs font-semibold uppercase text-text-secondary">Checks to run first</p>
          <ul className="space-y-1 text-sm text-text-secondary">
            {diagnosis.checks.map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-acid" />
                <span>{stripInlineMarkdown(item)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-3">
        <p className="mb-1 text-xs font-semibold uppercase text-text-secondary">Fixes</p>
        <ul className="space-y-1 text-sm text-text-secondary">
          {diagnosis.fixes.map((item) => (
            <li key={item}>- {stripInlineMarkdown(item)}</li>
          ))}
        </ul>
      </div>

      {diagnosis.caution ? (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-acid/25 bg-acid/10 p-3 text-sm text-text-primary">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          <span>{stripInlineMarkdown(diagnosis.caution)}</span>
        </div>
      ) : null}

    </section>
  );
}
