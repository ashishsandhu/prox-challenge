'use client'
import { animate } from 'framer-motion'
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'

interface Props {
  process: 'MIG' | 'FLUX' | 'TIG' | 'STICK'
  wireFeedSpeed?: number   // IPM
  voltage?: number         // Volts
  amperage?: number        // Amps
  thickness?: string       // e.g. "1/8 inch"
}

function AnimatedNumber({ target, unit }: { target: number; unit: string }) {
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    const controls = animate(0, target, {
      duration: 1.5,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setDisplay(Math.round(v)),
    })
    return controls.stop
  }, [target])

  return (
    <div className="flex items-baseline justify-center font-mono">
      {/* Ghost segment background for LCD realism */}
      <div className="relative">
        <span className="opacity-10 absolute inset-0 text-[#22c55e] blur-[1px]">888</span>
        <span className="relative text-[#4ade80] text-4xl font-bold tracking-widest drop-shadow-[0_0_8px_rgba(74,222,128,0.8)]">
          {display.toString().padStart(3, ' ')}
        </span>
      </div>
      <span className="text-sm ml-1.5 text-[#22c55e] font-bold opacity-80">{unit}</span>
    </div>
  )
}

export function ParametersModule({ process, wireFeedSpeed, voltage, amperage, thickness }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="bg-[#0f172a] rounded-2xl p-5 w-full max-w-sm mx-auto border-4 border-[#1e293b] shadow-[0_10px_40px_-10px_rgba(0,0,0,0.8),inset_0_2px_10px_rgba(0,0,0,0.5)] relative overflow-hidden"
    >
      {/* LCD Glass Glare Overlay */}
      <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/[0.03] to-transparent pointer-events-none" />

      {/* Screen Bezel inner */}
      <div className="bg-[#020617] rounded-xl p-1 border border-[#0f172a] shadow-[inset_0_4px_20px_rgba(0,0,0,1)] relative">
        
        {/* LCD Panel Background */}
        <div className="bg-gradient-to-b from-[#061e11] to-[#020a06] rounded-lg p-4 border border-[#0f3a1e] relative overflow-hidden">
          
          {/* LCD Scanlines */}
          <div className="absolute inset-0 opacity-10 bg-[repeating-linear-gradient(transparent,transparent_2px,#000_2px,#000_4px)] pointer-events-none" />

          {/* LCD Header */}
          <div className="flex justify-between items-center border-b border-[#166534]/50 pb-2 mb-4 relative z-10">
            <div className="flex items-center gap-2">
              <motion.div 
                animate={{ opacity: [1, 0.3, 1] }} 
                transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                className="w-2 h-2 rounded-full bg-[#4ade80] shadow-[0_0_8px_#4ade80]"
              />
              <p className="text-[#4ade80] font-mono text-[10px] font-bold tracking-widest uppercase opacity-90 drop-shadow-[0_0_4px_rgba(74,222,128,0.5)]">
                OMNIPRO 220
              </p>
            </div>
            <p className="text-[#4ade80] font-mono text-[10px] font-bold tracking-widest uppercase px-2 py-0.5 border border-[#4ade80]/30 rounded bg-[#4ade80]/10">
              {process}
            </p>
          </div>

          {/* Settings Grid */}
          <div className="grid grid-cols-2 gap-4 relative z-10">
            {wireFeedSpeed !== undefined && (
              <div className="text-center bg-[#022c14]/30 rounded p-2 border border-[#166534]/30">
                <p className="text-[#22c55e] font-mono text-[9px] uppercase tracking-widest mb-1 opacity-70">Wire Speed</p>
                <AnimatedNumber target={wireFeedSpeed} unit="IPM" />
              </div>
            )}
            {voltage !== undefined && (
              <div className="text-center bg-[#022c14]/30 rounded p-2 border border-[#166534]/30">
                <p className="text-[#22c55e] font-mono text-[9px] uppercase tracking-widest mb-1 opacity-70">Voltage</p>
                <AnimatedNumber target={voltage} unit="V" />
              </div>
            )}
            {amperage !== undefined && (
              <div className="text-center bg-[#022c14]/30 rounded p-2 border border-[#166534]/30">
                <p className="text-[#22c55e] font-mono text-[9px] uppercase tracking-widest mb-1 opacity-70">Amperage</p>
                <AnimatedNumber target={amperage} unit="A" />
              </div>
            )}
            {thickness && (
              <div className="text-center bg-[#022c14]/30 rounded p-2 border border-[#166534]/30 flex flex-col justify-center items-center">
                <p className="text-[#22c55e] font-mono text-[9px] uppercase tracking-widest mb-1 opacity-70">Material</p>
                <p className="text-[#4ade80] font-mono text-sm font-bold tracking-wider drop-shadow-[0_0_4px_rgba(74,222,128,0.5)]">{thickness}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Synergic nudge */}
      <p className="text-[#64748b] text-[10px] font-bold uppercase tracking-widest text-center mt-4">
        Synergic Auto-Tune Enabled
      </p>
    </motion.div>
  )
}
