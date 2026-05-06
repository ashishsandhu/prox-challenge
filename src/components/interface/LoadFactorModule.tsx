"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Timer, Zap, RefreshCw, Play, Square, AlertTriangle } from "lucide-react";
import type { DutyCycleRow } from "@/data/ProductGrounding";

type Props = {
  rows: DutyCycleRow[];
  highlightKey?: string;
  highlightLabel?: string;
};

const GAUGE_R = 68;
const GAUGE_CX = 90;
const GAUGE_CY = 90;
const FULL_ARC = 2 * Math.PI * GAUGE_R;

function polarToXY(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
  const s = polarToXY(cx, cy, r, startDeg);
  const e = polarToXY(cx, cy, r, endDeg);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`;
}

// ─── Animated countdown ring ─────────────────────────────────────────────────
function CountdownRing({ totalSec, elapsed, weldMinutes, restMinutes, dutyCycle }: {
  totalSec: number; elapsed: number; weldMinutes: number; restMinutes: number; dutyCycle: number;
}) {
  const weldSec = weldMinutes * 60;
  const inWeldPhase = elapsed % totalSec < weldSec;
  const cycleElapsed = elapsed % totalSec;
  const phaseRemaining = inWeldPhase ? weldSec - cycleElapsed : totalSec - cycleElapsed;
  const phaseFraction = inWeldPhase ? cycleElapsed / weldSec : (cycleElapsed - weldSec) / (restMinutes * 60);

  // Weld arc: green, from -90° to (dutyCycle/100)*360 - 90°
  const weldDeg = (dutyCycle / 100) * 360;
  const weldArc = arcPath(GAUGE_CX, GAUGE_CY, GAUGE_R, -90, -90 + weldDeg);
  const restArc = arcPath(GAUGE_CX, GAUGE_CY, GAUGE_R, -90 + weldDeg, -90 + 360);

  const progressArc = inWeldPhase
    ? arcPath(GAUGE_CX, GAUGE_CY, GAUGE_R, -90, -90 + phaseFraction * weldDeg)
    : arcPath(GAUGE_CX, GAUGE_CY, GAUGE_R, -90 + weldDeg, -90 + weldDeg + phaseFraction * (360 - weldDeg));

  const mins = Math.floor(phaseRemaining / 60);
  const secs = Math.floor(phaseRemaining % 60);

  return (
    <div className="relative flex flex-col items-center">
      <svg width="180" height="180" viewBox="0 0 180 180" className="overflow-visible">
        {/* Outer glow ring */}
        <circle cx={GAUGE_CX} cy={GAUGE_CY} r={GAUGE_R + 6} fill="none" stroke="var(--color-border)" strokeWidth="1" opacity="0.3" />

        {/* Background track */}
        <circle cx={GAUGE_CX} cy={GAUGE_CY} r={GAUGE_R} fill="none" stroke="var(--color-surfaceUp)" strokeWidth="12" />

        {/* Weld zone (static green arc) */}
        <path d={weldArc} fill="none" stroke="#22c55e" strokeWidth="12" strokeLinecap="butt" opacity="0.25" />
        {/* Rest zone (static amber arc) */}
        {dutyCycle < 100 && (
          <path d={restArc} fill="none" stroke="#f59e0b" strokeWidth="12" strokeLinecap="butt" opacity="0.15" />
        )}

        {/* Live progress arc */}
        <motion.path
          d={progressArc}
          fill="none"
          stroke={inWeldPhase ? "#22c55e" : "#f59e0b"}
          strokeWidth="12"
          strokeLinecap="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          style={{ filter: `drop-shadow(0 0 6px ${inWeldPhase ? "#22c55e88" : "#f59e0b88"})` }}
        />

        {/* Phase divider tick */}
        {dutyCycle < 100 && (() => {
          const tick = polarToXY(GAUGE_CX, GAUGE_CY, GAUGE_R, -90 + weldDeg);
          const inner = polarToXY(GAUGE_CX, GAUGE_CY, GAUGE_R - 10, -90 + weldDeg);
          return <line x1={inner.x} y1={inner.y} x2={tick.x} y2={tick.y} stroke="var(--color-bg)" strokeWidth="2" />;
        })()}

        {/* Center labels */}
        <text x={GAUGE_CX} y={GAUGE_CY - 10} textAnchor="middle" className="fill-[var(--color-textPrimary)]" fontSize="22" fontWeight="900" fontFamily="monospace">
          {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
        </text>
        <text x={GAUGE_CX} y={GAUGE_CY + 12} textAnchor="middle" fontSize="9" fontWeight="700" letterSpacing="2" fontFamily="sans-serif"
          fill={inWeldPhase ? "#22c55e" : "#f59e0b"}>
          {inWeldPhase ? "● WELDING" : "◌ COOLING"}
        </text>
        <text x={GAUGE_CX} y={GAUGE_CY + 27} textAnchor="middle" fontSize="8" fill="var(--color-textSecondary)" fontFamily="sans-serif">
          remaining
        </text>
      </svg>

      {/* Phase pills */}
      <div className="flex gap-3 mt-1">
        <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full transition-colors ${inWeldPhase ? "bg-green-500/20 text-green-500" : "bg-surfaceUp text-textDim"}`}>
          Weld {weldMinutes}m
        </span>
        {dutyCycle < 100 && (
          <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full transition-colors ${!inWeldPhase ? "bg-amber/20 text-amber" : "bg-surfaceUp text-textDim"}`}>
            Rest {restMinutes}m
          </span>
        )}
      </div>
    </div>
  );
}

// ─── "How long can I weld in X minutes?" calculator ─────────────────────────
function WeldPlanner({ weldMinutes, restMinutes, dutyCycle }: {
  weldMinutes: number; restMinutes: number; dutyCycle: number;
}) {
  const [totalMins, setTotalMins] = useState(30);

  const cycleMins = weldMinutes + restMinutes;
  const fullCycles = Math.floor(totalMins / cycleMins);
  const leftover = totalMins - fullCycles * cycleMins;
  const extraWeld = Math.min(leftover, weldMinutes);
  const totalWeld = fullCycles * weldMinutes + extraWeld;
  const totalRest = totalMins - totalWeld;
  const efficiency = Math.round((totalWeld / totalMins) * 100);

  // Build timeline segments
  const segments: { kind: "weld" | "rest"; mins: number }[] = [];
  for (let i = 0; i < fullCycles; i++) {
    segments.push({ kind: "weld", mins: weldMinutes });
    if (restMinutes > 0) segments.push({ kind: "rest", mins: restMinutes });
  }
  if (extraWeld > 0) segments.push({ kind: "weld", mins: parseFloat(extraWeld.toFixed(1)) });
  if (leftover > weldMinutes && dutyCycle < 100) {
    segments.push({ kind: "rest", mins: parseFloat((leftover - weldMinutes).toFixed(1)) });
  }

  const presets = [15, 30, 60, 120];

  return (
    <div className="space-y-4">
      {/* Title */}
      <div className="flex items-center gap-2">
        <RefreshCw size={13} className="text-brand" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-textSecondary">Session Planner</span>
      </div>

      {/* Slider */}
      <div>
        <div className="flex justify-between text-[9px] font-bold uppercase tracking-widest text-textSecondary mb-2">
          <span>Session length</span>
          <span className="text-textPrimary">{totalMins} min</span>
        </div>
        <input
          type="range"
          min={5} max={180} step={5}
          value={totalMins}
          onChange={(e) => setTotalMins(Number(e.target.value))}
          className="w-full accent-brand h-1 rounded-full appearance-none cursor-pointer"
        />
        <div className="flex justify-between mt-1.5 gap-1">
          {presets.map(p => (
            <button key={p} onClick={() => setTotalMins(p)}
              className={`flex-1 text-[8px] font-bold py-0.5 rounded transition-colors ${totalMins === p ? "bg-brand text-white" : "bg-surfaceUp text-textSecondary hover:bg-border"}`}>
              {p}m
            </button>
          ))}
        </div>
      </div>

      {/* Result tiles */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Weld Time", value: `${totalWeld.toFixed(1)}m`, color: "text-green-500", bg: "bg-green-500/10 border-green-500/20" },
          { label: "Rest Time", value: dutyCycle === 100 ? "none" : `${totalRest.toFixed(1)}m`, color: "text-amber", bg: "bg-amber/10 border-amber/20" },
          { label: "Efficiency", value: `${efficiency}%`, color: "text-brand", bg: "bg-brand/10 border-brand/20" },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className={`rounded-xl border p-2.5 text-center ${bg}`}>
            <span className={`block text-base font-black ${color}`}>{value}</span>
            <span className="block text-[8px] font-bold uppercase tracking-widest text-textSecondary mt-0.5">{label}</span>
          </div>
        ))}
      </div>

      {/* Visual timeline */}
      <div>
        <p className="text-[9px] font-bold uppercase tracking-widest text-textSecondary mb-2">Weld / Rest Timeline</p>
        <div className="flex h-5 w-full rounded-full overflow-hidden border border-border/60 gap-px">
          {segments.map((seg, i) => (
            <motion.div
              key={i}
              initial={{ scaleX: 0, opacity: 0 }}
              animate={{ scaleX: 1, opacity: 1 }}
              transition={{ delay: i * 0.05, duration: 0.3 }}
              style={{ flex: seg.mins }}
              className={`origin-left ${seg.kind === "weld" ? "bg-green-500" : "bg-amber/60"}`}
              title={`${seg.kind}: ${seg.mins}m`}
            />
          ))}
        </div>
        <div className="flex justify-between text-[8px] text-textDim mt-1">
          <span>0</span>
          <span>{totalMins} min</span>
        </div>
      </div>

      {dutyCycle < 100 && (
        <div className="flex items-start gap-2 bg-amber/5 border border-amber/20 rounded-xl p-2.5">
          <AlertTriangle size={11} className="text-amber mt-0.5 flex-shrink-0" />
          <p className="text-[9px] text-textSecondary leading-relaxed">
            Never skip rest periods — the thermal cutout will engage and force a longer cooldown.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────
export function LoadFactorModule({ rows, highlightKey, highlightLabel }: Props) {
  const activeKey = highlightKey ?? `240V-200A`;
  const activeRow = rows.find(r => `${r.input}-${r.amperage}` === activeKey) ?? rows[0];
  const dutyPercent = activeRow ? Number(activeRow.dutyCycle.replace("%", "")) : 40;
  const weldMinutes = activeRow?.weldMinutes ?? 4;
  const restMinutes = activeRow?.restMinutes ?? 6;
  const totalSec = (weldMinutes + restMinutes) * 60;

  // Timer state
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [selectedKey, setSelectedKey] = useState(activeKey);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const selectedRow = rows.find(r => `${r.input}-${r.amperage}` === selectedKey) ?? activeRow;
  const selDuty = selectedRow ? Number(selectedRow.dutyCycle.replace("%", "")) : dutyPercent;
  const selWeld = selectedRow?.weldMinutes ?? weldMinutes;
  const selRest = selectedRow?.restMinutes ?? restMinutes;
  const selTotal = (selWeld + selRest) * 60;

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running]);

  // Reset when row changes
  useEffect(() => {
    setElapsed(0);
    setRunning(false);
  }, [selectedKey]);

  const [activeTab, setActiveTab] = useState<"timer" | "plan">("timer");

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Timer size={15} className="text-brand" />
          <h3 className="text-xs font-bold uppercase tracking-widest text-textPrimary">Duty Cycle Calculator</h3>
        </div>
        {highlightLabel && (
          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-brand/10 border border-brand/20 text-brand uppercase tracking-widest">
            {highlightLabel}
          </span>
        )}
      </div>

      {/* Rating selector */}
      <div className="grid grid-cols-2 gap-1.5">
        {rows.map(row => {
          const key = `${row.input}-${row.amperage}`;
          const pct = Number(row.dutyCycle.replace("%", ""));
          const active = key === selectedKey;
          return (
            <button
              key={key}
              onClick={() => setSelectedKey(key)}
              className={`relative overflow-hidden rounded-xl border px-3 py-2 text-left transition-all duration-200 ${active ? "border-brand/40 bg-brand/10" : "border-border bg-surface hover:border-brand/20 hover:bg-brand/5"}`}
            >
              {active && (
                <motion.div layoutId="pill" className="absolute inset-0 bg-brand/5 rounded-xl" />
              )}
              <div className="relative flex justify-between items-center">
                <div>
                  <span className={`text-sm font-black ${active ? "text-brand" : "text-textPrimary"}`}>{row.dutyCycle}</span>
                  <span className="block text-[8px] font-bold uppercase tracking-widest text-textSecondary">{row.input} · {row.amperage}</span>
                </div>
                <div className="flex flex-col items-end gap-0.5">
                  <span className="text-[8px] text-green-500 font-bold">{row.weldMinutes}m weld</span>
                  {row.restMinutes > 0 && <span className="text-[8px] text-amber font-bold">{row.restMinutes}m rest</span>}
                </div>
              </div>
              {/* Mini bar */}
              <div className="mt-1.5 h-1 w-full rounded-full bg-surfaceUp overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-brand"
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                />
              </div>
            </button>
          );
        })}
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 bg-surfaceUp rounded-xl p-1 border border-border/60">
        {(["timer", "plan"] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-widest transition-all ${activeTab === tab ? "bg-surface text-textPrimary shadow-sm border border-border/60" : "text-textSecondary hover:text-textPrimary"}`}
          >
            {tab === "timer" ? "⏱ Live Timer" : "📐 Planner"}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        {activeTab === "timer" ? (
          <motion.div key="timer" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
            {/* SVG Ring countdown */}
            <div className="flex justify-center mb-4">
              <CountdownRing
                totalSec={selTotal}
                elapsed={elapsed}
                weldMinutes={selWeld}
                restMinutes={selRest}
                dutyCycle={selDuty}
              />
            </div>

            {/* Controls */}
            <div className="flex gap-2">
              <button
                onClick={() => setRunning(r => !r)}
                className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold transition-all ${running
                  ? "bg-red-500/10 border border-red-500/30 text-red-500 hover:bg-red-500/20"
                  : "bg-green-500/10 border border-green-500/30 text-green-500 hover:bg-green-500/20"
                  }`}
              >
                {running ? <><Square size={12} />Stop</> : <><Play size={12} />Start Weld</>}
              </button>
              <button
                onClick={() => { setElapsed(0); setRunning(false); }}
                className="px-4 rounded-xl border border-border bg-surface text-textSecondary hover:text-textPrimary hover:border-brand/30 transition-colors"
              >
                <RefreshCw size={12} />
              </button>
            </div>

            {/* Cycle counter */}
            <div className="mt-3 text-center">
              <span className="text-[9px] text-textDim">
                Cycle {Math.floor(elapsed / selTotal) + 1} · {Math.round(elapsed / 60 * 10) / 10}m elapsed
              </span>
            </div>
          </motion.div>
        ) : (
          <motion.div key="plan" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
            <WeldPlanner weldMinutes={selWeld} restMinutes={selRest} dutyCycle={selDuty} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
