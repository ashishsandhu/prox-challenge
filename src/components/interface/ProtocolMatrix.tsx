import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Cpu, Wind, Sun, ShieldCheck, Zap, Layers } from "lucide-react";
import { WiringDiagram } from "@/components/interface/WiringDiagram";
import type { WeldProcess } from "@/data/ProductGrounding";

type ProcessRow = {
  id: "mig" | "flux-core" | "tig" | "stick";
  label: string;
  gasRequired: string;
  bestFor: string;
  worksOutdoors: string;
  cleanliness: string;
  beginnerFriendly: string;
  weldQuality: string;
  setupNotes: string;
  icon: any;
};

const rows: ProcessRow[] = [
  {
    id: "mig",
    label: "MIG",
    gasRequired: "Yes",
    bestFor: "Indoor precision",
    worksOutdoors: "Limited",
    cleanliness: "Very clean",
    beginnerFriendly: "Elite",
    weldQuality: "Professional",
    setupNotes: "Ground → −, Wire feed → +",
    icon: Zap
  },
  {
    id: "flux-core",
    label: "Flux-core",
    gasRequired: "No",
    bestFor: "Field/Dirty metal",
    worksOutdoors: "Yes",
    cleanliness: "Spatter cleanup",
    beginnerFriendly: "High",
    weldQuality: "Strong Utility",
    setupNotes: "Ground → +, Wire feed → −",
    icon: Wind
  },
  {
    id: "tig",
    label: "TIG",
    gasRequired: "Yes",
    bestFor: "Artistic/Clean",
    worksOutdoors: "No",
    cleanliness: "Zero spatter",
    beginnerFriendly: "Low",
    weldQuality: "Aesthetic High",
    setupNotes: "Ground → +, Torch → −",
    icon: Layers
  },
  {
    id: "stick",
    label: "Stick",
    gasRequired: "No",
    bestFor: "Heavy outdoor",
    worksOutdoors: "Yes",
    cleanliness: "Slag cleanup",
    beginnerFriendly: "Medium",
    weldQuality: "Structural",
    setupNotes: "Ground → −, Electrode → +",
    icon: ShieldCheck
  }
];

export function ProtocolMatrix({ highlightProcess }: { highlightProcess?: string }) {
  const [selectedId, setSelectedId] = useState<WeldProcess>((highlightProcess as WeldProcess) || "mig");

  const selected = rows.find(r => r.id === selectedId) || rows[0];

  return (
    <div className="flex flex-col gap-6 module-in">
      {/* Interactive Process Switcher */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {rows.map((row) => {
          const isActive = selectedId === row.id;
          const Icon = row.icon;
          
          return (
            <button
              key={row.id}
              onClick={() => setSelectedId(row.id)}
              className={`relative flex flex-col items-center gap-3 rounded-2xl border p-4 transition-all duration-300 active:scale-95 ${
                isActive 
                ? "border-brand bg-brand/5 shadow-glow-sm" 
                : "border-border bg-surface hover:border-brand/30"
              }`}
            >
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${
                isActive ? "bg-brand text-white shadow-glow-sm" : "bg-surfaceUp text-textDim"
              }`}>
                <Icon size={20} />
              </div>
              <div className="text-center">
                <span className={`block text-[11px] font-black uppercase tracking-widest ${isActive ? "text-brand" : "text-textSecondary"}`}>
                  {row.label}
                </span>
              </div>
              {isActive && (
                <motion.div layoutId="active-indicator" className="absolute -bottom-1 left-1/2 h-1 w-6 -translate-x-1/2 rounded-full bg-brand" />
              )}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
        {/* Specs Table - 2 Columns */}
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
            <h4 className="mb-4 text-[10px] font-black uppercase tracking-widest text-textDim">Technical Profile</h4>
            <div className="space-y-3">
              <SpecItem label="Gas Requirement" value={selected.gasRequired} icon={Wind} />
              <SpecItem label="Environment" value={selected.bestFor} icon={Sun} />
              <SpecItem label="Beginner Ease" value={selected.beginnerFriendly} icon={Cpu} />
              <SpecItem label="Weld Finish" value={selected.cleanliness} icon={ShieldCheck} />
            </div>
          </div>
          
          <div className="rounded-2xl border border-border bg-brand/5 p-5">
            <h4 className="mb-2 text-[10px] font-black uppercase tracking-widest text-brand">Quick Setup Rule</h4>
            <p className="text-sm font-bold text-textPrimary">{selected.setupNotes}</p>
          </div>
        </div>

        {/* Live Diagram - 3 Columns */}
        <div className="lg:col-span-3">
          <AnimatePresence mode="wait">
            <motion.div
              key={selectedId}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <WiringDiagram process={selectedId as WeldProcess} />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function SpecItem({ label, value, icon: Icon }: { label: string, value: string, icon: any }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
      <div className="flex items-center gap-2">
        <Icon size={14} className="text-brand" />
        <span className="text-[10px] font-bold text-textSecondary uppercase tracking-tight">{label}</span>
      </div>
      <span className="text-xs font-black text-textPrimary">{value}</span>
    </div>
  );
}

