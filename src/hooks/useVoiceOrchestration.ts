import { useEffect, useRef, useState, useCallback } from 'react'
import { startWakeWordListener } from '@/engines/voice/wakeWord'
import { captureQuestion } from '@/engines/voice/voiceCapture'
import { speak, stopSpeaking } from '@/engines/voice/tts'

export type HandsFreeState = 'idle' | 'listening' | 'processing' | 'speaking'

export function useVoiceOrchestration(
  enabled: boolean,
  onQuestion: (q: string) => Promise<string>
) {
  const [state, setState] = useState<HandsFreeState>('idle')
  const listenerRef = useRef<ReturnType<typeof startWakeWordListener>>(null)

  const startListening = useCallback(() => {
    listenerRef.current = startWakeWordListener(() => {
      setState('listening')

      captureQuestion(async (question) => {
        setState('processing')

        try {
          const answer = await onQuestion(question)
          setState('speaking')
          speak(answer, () => {
            setState('idle')
            // Resume wake word detection after answer finishes
            if (enabled) startListening()
          })
        } catch {
          setState('idle')
          if (enabled) startListening()
        }
      })
    })
  }, [enabled, onQuestion])

  useEffect(() => {
    if (!enabled) {
      listenerRef.current?.stop()
      stopSpeaking()
      setState('idle')
      return
    }
    startListening()
    return () => {
      listenerRef.current?.stop()
      stopSpeaking()
    }
  }, [enabled, startListening])

  return { state }
}
