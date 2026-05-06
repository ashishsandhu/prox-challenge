"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, ChevronRight, Search, ShieldAlert, X, Zap, Cpu, Activity, Gauge } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { faultCodes, type FaultCode, type FaultSeverity } from "@/data/HardwareFaultRegistry";

const severityConfig: Record<FaultSeverity, { color: string; bg: string; icon: any }> = {
  info: { color: "#10B981", bg: "rgba(16,185,129,0.1)", icon: Activity },
  warning: { color: "#F59E0B", bg: "rgba(245,158,11,0.1)", icon: Zap },
  danger: { color: "#EF4444", bg: "rgba(239,68,68,0.1)", icon: ShieldAlert }
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSelect: (fault: FaultCode) => void;
};

export function HardwareDiagnostics({ open, onClose, onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return faultCodes.filter((fault) => {
      const matchesQuery = !q || 
        fault.code.toLowerCase().includes(q) || 
        fault.label.toLowerCase().includes(q) || 
        fault.indicator.toLowerCase().includes(q) ||
        fault.keywords.some((kw) => kw.includes(q));
      
      const matchesCategory = !selectedCategory || fault.category === selectedCategory;
      
      return matchesQuery && matchesCategory;
    });
  }, [query, selectedCategory]);

  const counts = useMemo(() => {
    return {
      all: faultCodes.length,
      power: faultCodes.filter(f => f.category === 'power').length,
      thermal: faultCodes.filter(f => f.category === 'thermal').length,
      wire: faultCodes.filter(f => f.category === 'wire').length
    };
  }, []);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 dark:bg-[#0A0A0A]/95 p-4 backdrop-blur-2xl">
      <motion.div 
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="flex h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-[3rem] border border-border dark:border-white/5 bg-white dark:bg-[#141414] shadow-2xl"
      >
        {/* HUD Header */}
        <header className="flex items-center justify-between px-12 py-10 border-b border-border dark:border-white/5 bg-gradient-to-b from-black/[0.02] dark:from-white/[0.02] to-transparent">
          <div className="flex items-center gap-8">
            <div className="relative flex h-16 w-16 items-center justify-center rounded-[1.5rem] bg-red-500/10 border border-red-500/20 text-red-500 shadow-[0_0_30px_rgba(239,68,68,0.2)]">
              <ShieldAlert size={32} />
              <motion.div 
                animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="absolute inset-0 rounded-[1.5rem] bg-red-500/20"
              />
            </div>
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-[10px] font-black uppercase tracking-[0.4em] text-red-500/60 font-mono">Hardware_Status: CRITICAL</span>
                <div className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
              </div>
              <h2 className="text-3xl font-black text-textPrimary uppercase tracking-tight">Active Hardware Monitoring</h2>
            </div>
          </div>
          <button onClick={onClose} className="h-12 w-12 flex items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/5 text-textSecondary transition-colors border border-border dark:border-white/10">
            <X size={24} />
          </button>
        </header>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar: Topology Selection */}
          <aside className="w-80 border-r border-border dark:border-white/5 bg-black/[0.01] dark:bg-white/[0.01] p-8 space-y-10 overflow-y-auto">
            <div>
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-textDim mb-6">System_Topology</h3>
              <div className="space-y-3">
                {[
                  { id: null, label: "Full System", icon: Cpu, count: counts.all },
                  { id: "power", label: "Power Grid", icon: Zap, count: counts.power },
                  { id: "thermal", label: "Thermal Core", icon: Activity, count: counts.thermal },
                  { id: "wire", label: "Feed System", icon: Gauge, count: counts.wire },
                ].map((cat) => {
                  const active = selectedCategory === cat.id;
                  const Icon = cat.icon;
                  return (
                    <button
                      key={cat.id ?? 'all'}
                      onClick={() => setSelectedCategory(cat.id as any)}
                      className={`flex w-full items-center justify-between p-4 rounded-2xl border transition-all ${
                        active ? "bg-brand/10 border-brand/40 text-brand" : "bg-transparent border-transparent text-textSecondary hover:bg-black/5 dark:hover:bg-white/5"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon size={16} />
                        <span className="text-[11px] font-black uppercase tracking-widest">{cat.label}</span>
                      </div>
                      <span className="text-[10px] font-mono opacity-40">{cat.count}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="bg-brand/5 border border-brand/20 p-6 rounded-[2rem]">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-brand mb-2">Live_Telemetry</h4>
              <p className="text-[11px] leading-relaxed text-brand/80">Monitoring 24 unique sensor nodes for OmniPro 220 stability.</p>
            </div>
          </aside>

          {/* Main Content: Telemetry Grid */}
          <main className="flex-1 flex flex-col overflow-hidden bg-gradient-to-br from-transparent to-white/[0.01]">
            <div className="p-8 border-b border-white/5">
              <div className="flex items-center gap-4 bg-[#0A0A0A] border border-white/5 rounded-2xl px-6 py-4 shadow-inner">
                <Search size={18} className="text-textDim" />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="SCAN BY ERROR_CODE OR SYMPTOM..."
                  className="flex-1 bg-transparent text-[11px] font-mono text-white outline-none uppercase tracking-widest placeholder:text-textDim"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-8 chat-scroll">
              {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full opacity-40">
                  <Activity size={48} className="mb-4" />
                  <span className="text-[10px] font-black uppercase tracking-[0.2em]">Zero Match Detected</span>
                </div>
              ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  {filtered.map((fault) => {
                    const cfg = severityConfig[fault.severity];
                    const Icon = cfg.icon;
                    return (
                      <motion.button
                        layout
                        key={fault.id}
                        onClick={() => onSelect(fault)}
                        className="group relative flex flex-col items-start p-8 rounded-[2.5rem] border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/10 transition-all text-left"
                      >
                        <div className="flex w-full items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: cfg.bg, color: cfg.color }}>
                              <Icon size={20} />
                            </div>
                            <span className="text-[12px] font-black font-mono tracking-[0.2em]" style={{ color: cfg.color }}>{fault.code}</span>
                          </div>
                          <ChevronRight size={16} className="text-textDim group-hover:text-white transition-colors" />
                        </div>
                        
                        <h4 className="text-lg font-black text-white mb-2 uppercase tracking-tight">{fault.label}</h4>
                        <p className="text-[11px] leading-relaxed text-textSecondary group-hover:text-textPrimary transition-colors line-clamp-2">
                          {fault.indicator}
                        </p>

                        <div className="mt-6 flex flex-wrap gap-2">
                          {fault.keywords.slice(0, 3).map(kw => (
                            <span key={kw} className="text-[8px] font-black uppercase tracking-widest px-2 py-1 bg-white/5 rounded-md border border-white/5 text-textDim">
                              {kw}
                            </span>
                          ))}
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              )}
            </div>
          </main>
        </div>
      </motion.div>
    </div>
  );
}

