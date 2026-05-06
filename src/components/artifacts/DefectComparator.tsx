"use client";

import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { GripVertical } from "lucide-react";

const REFERENCES: Record<string, { bad: string; label: string }> = {
  porosity:    { bad: "/assets/weld-diagnosis/porosity.png",    label: "Porosity" },
  spatter:     { bad: "/assets/weld-diagnosis/spatter.png",     label: "Spatter" },
  undercut:    { bad: "/assets/weld-diagnosis/undercut.png",    label: "Undercut" },
  overlap:     { bad: "/assets/weld-diagnosis/overlap.png",     label: "Overlap" },
  burnthrough: { bad: "/assets/weld-diagnosis/burn-through.png",label: "Burn-Through" },
};

interface Props {
  issue: string;
  userImageUrl?: string;
}

export function DefectComparator({ issue, userImageUrl }: Props) {
  const [pos, setPos] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const ref = REFERENCES[issue.toLowerCase()] ?? REFERENCES.porosity;
  const goodSrc = userImageUrl ?? "/assets/weld-diagnosis/good-bead.png";

  function handlePointerMove(clientX: number) {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    setPos(pct);
  }

  return (
    <div className="w-full max-w-sm mx-auto">
      <div className="mb-4 flex items-center justify-between text-xs font-bold uppercase tracking-widest text-textSecondary">
        <span>Ideal Bead</span>
        <span className="text-brand">vs</span>
        <span className="text-red">{ref.label}</span>
      </div>

      <div
        ref={containerRef}
        className="relative w-full h-56 rounded-2xl overflow-hidden cursor-ew-resize select-none border border-border shadow-sm"
        onMouseMove={(e) => {
          if (e.buttons === 1) handlePointerMove(e.clientX);
        }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          handlePointerMove(e.clientX);
        }}
        onPointerMove={(e) => {
          if (e.buttons === 1) handlePointerMove(e.clientX);
        }}
      >
        {/* Defect Image (Background) */}
        <div className="absolute inset-0 bg-surface">
          <img
            src={ref.bad}
            alt={`Defect: ${ref.label}`}
            className="h-full w-full object-cover"
            draggable={false}
          />
          <div className="absolute top-3 right-3 rounded bg-red/90 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-white shadow-sm">
            {ref.label}
          </div>
        </div>

        {/* Good Image (Foreground Clipped) */}
        <div
          className="absolute inset-0 bg-surface"
          style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
        >
          <img
            src={goodSrc}
            alt="Target / Ideal Weld"
            className="h-full w-full object-cover"
            draggable={false}
          />
          <div className="absolute top-3 left-3 rounded bg-emerald-500/90 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-white shadow-sm">
            Target
          </div>
        </div>

        {/* Slider Handle */}
        <motion.div
          className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_8px_rgba(0,0,0,0.5)] flex items-center justify-center pointer-events-none"
          style={{ left: `${pos}%` }}
        >
          <div className="absolute w-8 h-8 bg-white rounded-full shadow-[0_2px_8px_rgba(0,0,0,0.4)] flex items-center justify-center text-gray-700 text-xs z-10 border border-gray-200">
            <GripVertical size={16} />
          </div>
        </motion.div>
      </div>
    </div>
  )
}
