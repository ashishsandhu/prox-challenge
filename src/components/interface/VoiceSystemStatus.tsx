'use client'
import { motion, AnimatePresence } from 'framer-motion'
import type { HandsFreeState } from '@/hooks/useVoiceOrchestration'

const CONFIG: Record<HandsFreeState, { label: string; color: string; pulse: boolean }> = {
  idle:       { label: 'Say "Hey Vulcan"',  color: 'bg-gray-500',   pulse: false },
  listening:  { label: 'Listening...',       color: 'bg-green-500',  pulse: true  },
  processing: { label: 'Thinking...',        color: 'bg-yellow-500', pulse: true  },
  speaking:   { label: 'Speaking...',        color: 'bg-blue-500',   pulse: true  },
}

export function VoiceSystemStatus({ state }: { state: HandsFreeState }) {
  const { label, color, pulse } = CONFIG[state]
  return (
    <AnimatePresence>
      <motion.div
        key={state}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 8 }}
        className="fixed bottom-28 left-1/2 -translate-x-1/2 z-50
                   flex items-center gap-2 bg-black/75 text-white
                   px-4 py-2 rounded-full text-sm backdrop-blur-sm"
      >
        <span className={`w-2 h-2 rounded-full ${color} ${pulse ? 'animate-pulse' : ''}`} />
        {label}
      </motion.div>
    </AnimatePresence>
  )
}
