import Image from "next/image";
import type { ManualImage } from "@/data/ProductGrounding";
import type { ImageInterpretation } from "@/core/agentResponse";
import { stripInlineMarkdown } from "@/core/textFormat";

export function RegistryCard({ image, interpretation }: { image: ManualImage; interpretation?: ImageInterpretation }) {
  const isPdf = image.src.endsWith(".pdf");

  return (
    <section className="space-y-4 rounded-xl border border-black/[0.08] bg-card p-4 shadow-none">
      <div className="rounded-xl border border-black/[0.08] bg-card p-3">
        <h4 className="text-xs font-bold uppercase tracking-wide text-text-secondary">Supporting reference</h4>
        <p className="mt-1 text-xs text-text-secondary">{image.title}</p>
      </div>

      {interpretation ? (
        <div className="space-y-2 rounded-xl border border-brass/25 bg-brass/10 p-3 text-xs leading-5 text-text-primary">
          <div>
            <span className="font-bold uppercase tracking-wide text-brass">What it shows</span>
            <p className="mt-0.5">{stripInlineMarkdown(interpretation.whatItShows)}</p>
          </div>
          <div>
            <span className="font-bold uppercase tracking-wide text-brass">Why it matters</span>
            <p className="mt-0.5">{stripInlineMarkdown(interpretation.whyItMatters)}</p>
          </div>
          <div>
            <span className="font-bold uppercase tracking-wide text-brass">What to check</span>
            <p className="mt-0.5">{stripInlineMarkdown(interpretation.whatToCheck)}</p>
          </div>
        </div>
      ) : null}

      <div className="relative overflow-hidden rounded-xl border border-black/[0.08] bg-card-soft">
        {isPdf ? (
          <div className="h-72 bg-card-soft">
            <iframe src={image.src} title={image.title} className="h-full w-full border-0" />
          </div>
        ) : (
          <Image src={image.src} alt={image.title} width={1100} height={1500} className="h-auto w-full object-cover" />
        )}
      </div>

      {image.guide.secondaryNotes && image.guide.secondaryNotes.length > 0 && (
        <div className="rounded-xl border border-black/[0.08] bg-card p-3">
          <h4 className="text-xs font-bold uppercase tracking-wide text-text-secondary">Reference notes</h4>
          <ul className="mt-2 space-y-1">
            {image.guide.secondaryNotes.map((note, idx) => (
              <li key={idx} className="text-xs leading-5 text-text-secondary">
                • {stripInlineMarkdown(note)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
