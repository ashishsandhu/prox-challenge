'use client'
import Image from 'next/image'
import { motion, type Variants } from 'framer-motion'
import type { WeldProcess } from "@/data/ProductGrounding";
import { polaritySetups } from "@/data/ProductGrounding";

interface Props {
  process: WeldProcess
}

const cableVariants: Variants = {
  hidden:  { pathLength: 0, opacity: 0 },
  visible: (delay: number) => ({
    pathLength: 1,
    opacity: 1,
    transition: { duration: 1.2, ease: 'circOut' as const, delay },
  }),
}

export function WiringDiagram({ process }: Props) {
  if (process === "unknown") return null;
  const setup = polaritySetups[process];
  const isNegElectrode = process === "flux-core" || process === "tig";
  
  const socketNeg = { x: 250, y: 560 }
  const socketGas = { x: 400, y: 560 }
  const socketPos = { x: 540, y: 560 }
  
  const colors = {
    pos: '#EF4444',
    neg: '#10B981',
    gas: '#0EA5E9',
    glow: isNegElectrode ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'
  }

  return (
    <div className="w-full bg-surface rounded-[2rem] p-6 border border-border shadow-xl overflow-hidden transition-all duration-300">
      {/* Clean Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h3 className="text-xl font-black text-textPrimary tracking-tight uppercase leading-none">{process} SETUP</h3>
          <span className="text-[9px] font-bold text-textDim uppercase tracking-widest mt-1 block">Engineering Topology v2.1</span>
        </div>
        <div className="px-3 py-1 bg-brand/5 rounded-full border border-brand/10">
          <span className="text-[9px] font-black text-brand uppercase tracking-widest">{setup.label}</span>
        </div>
      </div>

      <div className="relative aspect-[800/700] w-full bg-bg rounded-2xl overflow-hidden border border-border/40 group">
        <Image 
          src="/assets/vulcan.svg" 
          alt="Vulcan OmniPro 220" 
          fill 
          sizes="100vw"
          priority
          loading="eager"
          className="object-contain opacity-70 group-hover:opacity-90 transition-opacity duration-500"
        />

        <svg viewBox="0 0 800 700" className="absolute inset-0 z-10 pointer-events-none">
          <defs>
            <filter id="subtle-glow">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Minimal Terminal Indicators - Pixel-Perfect Lock */}
          <circle cx={socketNeg.x} cy={socketNeg.y} r="28" fill="none" stroke={colors.neg} strokeWidth="1" strokeDasharray="3 3" className="animate-spin-slow" />
          <circle cx={socketPos.x} cy={socketPos.y} r="28" fill="none" stroke={colors.pos} strokeWidth="1" strokeDasharray="3 3" className="animate-spin-slow" />

          {/* Refined Holographic Cables */}
          
          {/* 1. Primary Lead */}
          <motion.path
            d={`M 150 250 C 180 450 ${isNegElectrode ? socketNeg.x : socketPos.x} 480 ${isNegElectrode ? socketNeg.x : socketPos.x} ${socketNeg.y}`}
            stroke={isNegElectrode ? colors.neg : colors.pos}
            strokeWidth="6" fill="none" strokeLinecap="round" opacity="0.8"
            variants={cableVariants} custom={0.3} initial="hidden" animate="visible"
          />
          <motion.path
            d={`M 150 250 C 180 450 ${isNegElectrode ? socketNeg.x : socketPos.x} 480 ${isNegElectrode ? socketNeg.x : socketPos.x} ${socketNeg.y}`}
            stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeDasharray="2 20"
            animate={{ strokeDashoffset: isNegElectrode ? [0, -44] : [0, 44] }}
            transition={{ repeat: Infinity, duration: 1.2, ease: "linear" }}
            filter="url(#subtle-glow)"
          />

          {/* 2. Work Lead */}
          <motion.path
            d={`M 650 620 C 620 580 ${!isNegElectrode ? socketNeg.x : socketPos.x} 520 ${!isNegElectrode ? socketNeg.x : socketPos.x} ${socketNeg.y}`}
            stroke={!isNegElectrode ? colors.neg : colors.pos}
            strokeWidth="6" fill="none" strokeLinecap="round" opacity="0.8"
            variants={cableVariants} custom={0.8} initial="hidden" animate="visible"
          />
          <motion.path
            d={`M 650 620 C 620 580 ${!isNegElectrode ? socketNeg.x : socketPos.x} 520 ${!isNegElectrode ? socketNeg.x : socketPos.x} ${socketNeg.y}`}
            stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeDasharray="2 20"
            animate={{ strokeDashoffset: !isNegElectrode ? [0, 44] : [0, -44] }}
            transition={{ repeat: Infinity, duration: 1.2, ease: "linear" }}
            filter="url(#subtle-glow)"
          />

          {/* 3. Gas Line */}
          {(process === 'mig' || process === 'tig') && (
            <motion.path
              d={`M 680 150 C 680 250 ${socketGas.x} 450 ${socketGas.x} ${socketGas.y}`}
              stroke={colors.gas}
              strokeWidth="4" fill="none" strokeLinecap="round" strokeDasharray="6 3" opacity="0.6"
              variants={cableVariants} custom={1.4} initial="hidden" animate="visible"
            />
          )}
          {/* Technical Source Labels - High Visibility */}
          <g transform="translate(30, 230)">
            <rect width="140" height="30" rx="8" fill="black" fillOpacity="0.9" />
            <text x="70" y="20" textAnchor="middle" fill="white" fontSize="12" fontWeight="900" className="uppercase tracking-widest">
              {process === 'mig' || process === 'flux-core' ? 'MIG GUN' : process === 'tig' ? 'TIG TORCH' : 'ELECTRODE'}
            </text>
          </g>

          <g transform="translate(630, 630)">
            <rect width="140" height="30" rx="8" fill="black" fillOpacity="0.9" />
            <text x="70" y="20" textAnchor="middle" fill="white" fontSize="12" fontWeight="900" className="uppercase tracking-widest">WORK CLAMP</text>
          </g>

          {(process === 'mig' || process === 'tig') && (
            <g transform="translate(630, 120)">
              <rect width="140" height="30" rx="8" fill="black" fillOpacity="0.9" />
              <text x="70" y="20" textAnchor="middle" fill={colors.gas} fontSize="12" fontWeight="900" className="uppercase tracking-widest">GAS SUPPLY</text>
            </g>
          )}
        </svg>
      </div>

      {/* Simplified Footer Labels */}
      <div className="mt-6 flex gap-4">
        <div className="flex-1 p-3 rounded-xl bg-bg border border-border">
          <span className="block text-[8px] font-bold text-textDim uppercase tracking-widest mb-1">Negative Socket</span>
          <span className="text-[11px] font-black text-textPrimary uppercase">{isNegElectrode ? 'Electrode / Torch' : 'Ground Clamp'}</span>
        </div>
        <div className="flex-1 p-3 rounded-xl bg-bg border border-border">
          <span className="block text-[8px] font-bold text-textDim uppercase tracking-widest mb-1">Positive Socket</span>
          <span className="text-[11px] font-black text-textPrimary uppercase">{!isNegElectrode ? 'Electrode / Torch' : 'Ground Clamp'}</span>
        </div>
      </div>
    </div>
  )
}






