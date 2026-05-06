'use client'
import Image from 'next/image'
import { motion, type Variants } from 'framer-motion'

interface Props {
  polarity: 'DCEN' | 'DCEP'
  process?: string
}

const cableVariants: Variants = {
  hidden:  { pathLength: 0, opacity: 0 },
  visible: (delay: number) => ({
    pathLength: 1,
    opacity: 1,
    transition: { duration: 1.5, ease: 'easeInOut' as const, delay },
  }),
}

export function WiringEngine({ polarity, process }: Props) {
  const isNegElectrode = polarity === 'DCEN'
  
  // Real socket coordinates on product.webp (mapped to 400x400)
  const negSocket = { x: 204, y: 304 }
  const posSocket = { x: 268, y: 304 }
  
  const colors = {
    pos: '#EF4444',
    neg: '#10B981',
    glow: isNegElectrode ? 'rgba(16,185,129,0.4)' : 'rgba(239,68,68,0.4)'
  }

  return (
    <div className="w-full max-w-lg mx-auto bg-surface rounded-[2.5rem] p-8 border border-border shadow-2xl overflow-hidden transition-colors duration-300">
      <div className="flex justify-between items-center mb-8">
        <div>
          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-brand/60 font-mono">Infrastructure_Visual: 01</span>
          <h3 className="text-2xl font-black text-textPrimary tracking-tight">{polarity} CONFIGURATION</h3>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-[10px] font-mono text-textSecondary uppercase tracking-widest">Process_ID</span>
          <span className="text-sm font-black text-brand uppercase">{process ?? 'SYSTEM'}</span>
        </div>
      </div>

      <div className="relative aspect-square w-full bg-bg rounded-3xl overflow-hidden border border-border shadow-inner group">
        {/* The Real Product Image */}
        <Image 
          src="/images/product.webp" 
          alt="Vulcan OmniPro 220 Topology" 
          fill 
          className="object-cover opacity-60 grayscale group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-700"
        />

        {/* The Holographic SVG Overlay */}
        <svg viewBox="0 0 400 400" className="absolute inset-0 z-10 drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]">
          <defs>
            <filter id="neon-glow">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Sockets Callouts */}
          <circle cx={negSocket.x} cy={negSocket.y} r="12" fill="none" stroke={colors.neg} strokeWidth="2" strokeDasharray="2 2" className="animate-spin-slow" />
          <circle cx={posSocket.x} cy={posSocket.y} r="12" fill="none" stroke={colors.pos} strokeWidth="2" strokeDasharray="2 2" className="animate-spin-slow" />

          {/* Electrode Cable (Routed to appropriate socket) */}
          <motion.path
            d={`M 60 80 C 80 150 ${isNegElectrode ? negSocket.x - 20 : posSocket.x - 20} 250 ${isNegElectrode ? negSocket.x : posSocket.x} ${negSocket.y}`}
            stroke={isNegElectrode ? colors.neg : colors.pos}
            strokeWidth="8" fill="none" strokeLinecap="round"
            variants={cableVariants} custom={0.5} initial="hidden" animate="visible"
          />
          {/* Animated Electron Stream */}
          <motion.path
            d={`M 60 80 C 80 150 ${isNegElectrode ? negSocket.x - 20 : posSocket.x - 20} 250 ${isNegElectrode ? negSocket.x : posSocket.x} ${negSocket.y}`}
            stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" strokeDasharray="4 20"
            animate={{ strokeDashoffset: isNegElectrode ? [0, -48] : [0, 48] }}
            transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
            filter="url(#neon-glow)"
          />

          {/* Work Clamp Cable */}
          <motion.path
            d={`M 340 340 C 320 320 ${!isNegElectrode ? negSocket.x + 20 : posSocket.x + 20} 280 ${!isNegElectrode ? negSocket.x : posSocket.x} ${posSocket.y}`}
            stroke={!isNegElectrode ? colors.neg : colors.pos}
            strokeWidth="8" fill="none" strokeLinecap="round"
            variants={cableVariants} custom={1.2} initial="hidden" animate="visible"
          />
          <motion.path
            d={`M 340 340 C 320 320 ${!isNegElectrode ? negSocket.x + 20 : posSocket.x + 20} 280 ${!isNegElectrode ? negSocket.x : posSocket.x} ${posSocket.y}`}
            stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" strokeDasharray="4 20"
            animate={{ strokeDashoffset: !isNegElectrode ? [0, -48] : [0, 48] }}
            transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
            filter="url(#neon-glow)"
          />

          {/* Label Nodes */}
          <g transform="translate(40, 60)">
            <rect width="90" height="20" rx="10" fill="black" fillOpacity="0.6" className="backdrop-blur-sm" />
            <text x="45" y="13" textAnchor="middle" fill="white" fontSize="8" fontWeight="bold" className="uppercase tracking-widest">Electrode_Source</text>
          </g>
          <g transform="translate(280, 350)">
            <rect width="80" height="20" rx="10" fill="black" fillOpacity="0.6" className="backdrop-blur-sm" />
            <text x="40" y="13" textAnchor="middle" fill="white" fontSize="8" fontWeight="bold" className="uppercase tracking-widest">Work_Ground</text>
          </g>
        </svg>

        {/* HUD Info Overlays */}
        <div className="absolute top-6 right-6 z-20 flex flex-col gap-2 items-end">
          <div className="px-3 py-1 bg-black/40 backdrop-blur-md rounded-lg border border-white/10">
            <span className="text-[9px] font-mono text-brand font-bold tracking-tighter uppercase">POLARITY_SYNC: ACTIVE</span>
          </div>
          <div className="px-3 py-1 bg-black/40 backdrop-blur-md rounded-lg border border-white/10">
            <span className="text-[9px] font-mono text-white/60 font-bold tracking-tighter uppercase">RENDER_ENGINE: VULCAN_V4</span>
          </div>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-4">
        <div className="p-4 rounded-2xl bg-bg border border-border shadow-inner">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: isNegElectrode ? colors.neg : colors.pos }} />
            <span className="text-[9px] font-black uppercase tracking-widest text-textSecondary">ELECTRODE_LINK</span>
          </div>
          <p className="text-xs font-black text-textPrimary uppercase">{isNegElectrode ? 'Negative (−) Socket' : 'Positive (+) Socket'}</p>
        </div>
        <div className="p-4 rounded-2xl bg-bg border border-border shadow-inner">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: !isNegElectrode ? colors.neg : colors.pos }} />
            <span className="text-[9px] font-black uppercase tracking-widest text-textSecondary">GROUND_LINK</span>
          </div>
          <p className="text-xs font-black text-textPrimary uppercase">{!isNegElectrode ? 'Negative (−) Socket' : 'Positive (+) Socket'}</p>
        </div>
      </div>
    </div>
  )
}


