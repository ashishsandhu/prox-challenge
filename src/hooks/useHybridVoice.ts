/**
 * Dual-mode voice hook.
 *
 * 'immersive' — Always-on: starts listening immediately as soon as the mode
 *               activates, with no wake word. Uses Whisper for transcription.
 *               Best for hands-free power users.
 *
 * 'always-on' — Wake-word: listens for "Hey Vulcan" via browser SR, then
 *               captures the question with Whisper. Good for ambient use.
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { captureQuestionWhisper } from '@/engines/voice/voiceCaptureWhisper'
import { speak, stopSpeaking } from '@/engines/voice/tts'
import { startWakeWordListener } from '@/engines/voice/wakeWord'

export type HandsFreeState = 'idle' | 'listening' | 'processing' | 'speaking'

export type VoiceMode = 'off' | 'immersive' | 'always-on'

export function useHybridVoice(
  mode: VoiceMode,
  onQuestion: (q: string) => Promise<string>
) {
  const [state, setState] = useState<HandsFreeState>('idle')
  const abortRef = useRef(false)
  const wakeRef = useRef<ReturnType<typeof startWakeWordListener>>(null)

  // ------------------------------------------------------------------
  // Immersive loop: immediately capture → process → speak → repeat
  // ------------------------------------------------------------------
  const immersiveLoop = useCallback(async () => {
    if (abortRef.current) return

    setState('listening')
    try {
      const question = await captureQuestionWhisper()
      if (abortRef.current) return

      if (!question || question.trim().length < 2) {
        // Nothing heard — restart loop immediately
        setTimeout(() => immersiveLoop(), 400)
        return
      }

      setState('processing')
      const answer = await onQuestion(question)
      if (abortRef.current) return

      setState('speaking')
      await new Promise<void>((resolve) => {
        speak(answer, () => resolve())
      })

      if (!abortRef.current) immersiveLoop()
    } catch (err) {
      console.warn('[voiceDual] immersive loop error:', err)
      if (!abortRef.current) {
        setState('idle')
        setTimeout(() => immersiveLoop(), 1000)
      }
    }
  }, [onQuestion])

  // ------------------------------------------------------------------
  // Always-on: wake word → Whisper capture → process → speak → repeat
  // ------------------------------------------------------------------
  const startAlwaysOn = useCallback(() => {
    if (abortRef.current) return
    setState('idle')

    wakeRef.current = startWakeWordListener(async () => {
      if (abortRef.current) return
      setState('listening')

      try {
        const question = await captureQuestionWhisper()
        if (abortRef.current) return

        if (!question || question.trim().length < 2) {
          startAlwaysOn()
          return
        }

        setState('processing')
        const answer = await onQuestion(question)
        if (abortRef.current) return

        setState('speaking')
        await new Promise<void>((resolve) => {
          speak(answer, () => resolve())
        })

        if (!abortRef.current) startAlwaysOn()
      } catch (err) {
        console.warn('[voiceDual] always-on error:', err)
        if (!abortRef.current) startAlwaysOn()
      }
    })
  }, [onQuestion])

  // ------------------------------------------------------------------
  // Effect: wire mode changes
  // ------------------------------------------------------------------
  useEffect(() => {
    abortRef.current = false

    if (mode === 'immersive') {
      wakeRef.current?.stop?.()
      immersiveLoop()
    } else if (mode === 'always-on') {
      startAlwaysOn()
    } else {
      // off
      abortRef.current = true
      wakeRef.current?.stop?.()
      stopSpeaking()
      setState('idle')
    }

    return () => {
      abortRef.current = true
      wakeRef.current?.stop?.()
      stopSpeaking()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  return { state }
}
