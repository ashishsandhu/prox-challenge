"use client";

import { LayoutGrid } from "lucide-react";
import { polaritySetups, type WeldProcess } from "@/data/ProductGrounding";

const PROCESS_LABEL: Record<Exclude<WeldProcess, "unknown">, string> = {
  mig: "MIG (solid wire)",
  "flux-core": "Flux-core (gasless)",
  tig: "TIG",
  stick: "Stick"
};

// Renders a side-by-side comparison of every welding process named in the
// user's question. Mounts inline in the chat bubble (NOT the workspace) so
// the prose answer stays compact while the table carries the structured
// per-process fields. Data comes straight from `polaritySetups` — no LLM
// involvement, so the values are always grounded in the manual.
export function ConfigurationTable({
  processes
}: {
  processes: Array<Exclude<WeldProcess, "unknown">>;
}) {
  if (processes.length < 2) return null;

  const rows: Array<{ label: string; render: (p: Exclude<WeldProcess, "unknown">) => string }> = [
    { label: "Positive (+) socket", render: (p) => polaritySetups[p].positive },
    { label: "Negative (−) socket", render: (p) => polaritySetups[p].negative },
    { label: "Wire feed cable", render: (p) => (polaritySetups[p].wireFeed === "connected" ? "Connected" : "Disconnected") },
    { label: "Shielding gas", render: (p) => polaritySetups[p].gas ?? "Not used" }
  ];

  return (
    <section className="rounded-xl border border-black/[0.08] bg-card p-4 shadow-none">
      <div className="mb-3 flex items-center gap-2">
        <LayoutGrid size={15} className="text-text-secondary" />
        <h3 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">Setup comparison</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-black/[0.08]">
              <th className="py-2 pr-3 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">
                Setting
              </th>
              {processes.map((p) => (
                <th
                  key={p}
                  className="py-2 px-3 text-left text-xs font-semibold uppercase tracking-wide text-text-primary"
                >
                  {PROCESS_LABEL[p]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr
                key={row.label}
                className={idx % 2 === 0 ? "bg-card-soft/40" : ""}
              >
                <td className="py-2 pr-3 align-top text-xs font-medium text-text-secondary">
                  {row.label}
                </td>
                {processes.map((p) => (
                  <td key={`${row.label}-${p}`} className="py-2 px-3 align-top text-text-primary">
                    {row.render(p)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
