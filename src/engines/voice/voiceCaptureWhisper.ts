/**
 * Captures audio from the microphone, sends it to /api/transcribe (Whisper),
 * and falls back to Web Speech API if Whisper is unavailable or returns empty.
 */
export async function captureQuestionWhisper(): Promise<string> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true })

  return new Promise((resolve) => {
    const chunks: Blob[] = []
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : MediaRecorder.isTypeSupported('audio/webm')
      ? 'audio/webm'
      : 'audio/ogg'

    const recorder = new MediaRecorder(stream, { mimeType })

    // Play a ready chime
    try {
      const ctx = new AudioContext()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.value = 920
      gain.gain.setValueAtTime(0.25, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18)
      osc.start()
      osc.stop(ctx.currentTime + 0.18)
    } catch {}

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data)
    }

    recorder.onstop = async () => {
      // Stop all tracks
      stream.getTracks().forEach((t) => t.stop())

      const blob = new Blob(chunks, { type: mimeType })

      // Try Whisper
      try {
        const form = new FormData()
        form.append('audio', blob, 'audio.webm')
        const res = await fetch('/api/transcribe', { method: 'POST', body: form })
        if (res.ok) {
          const { text } = await res.json()
          if (text && text.trim().length > 1) {
            resolve(text.trim())
            return
          }
        }
      } catch (e) {
        console.warn('[voiceCapture] Whisper transcription failed, falling back:', e)
      }

      // Browser SR fallback
      resolve(await browserSRCapture())
    }

    // Record for up to 8 seconds then stop
    recorder.start()
    setTimeout(() => {
      if (recorder.state === 'recording') recorder.stop()
    }, 8000)

    // VAD: stop early on silence using AudioContext analyser
    try {
      const ctx = new AudioContext()
      const source = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 1024
      source.connect(analyser)

      const buffer = new Uint8Array(analyser.frequencyBinCount)
      let silenceFrames = 0

      const checkSilence = () => {
        if (recorder.state !== 'recording') return
        analyser.getByteFrequencyData(buffer)
        const avg = buffer.reduce((a, b) => a + b, 0) / buffer.length
        if (avg < 4) {
          silenceFrames++
          // ~1.2s silence (60 frames × ~20ms)
          if (silenceFrames > 60) {
            recorder.stop()
            return
          }
        } else {
          silenceFrames = 0
        }
        requestAnimationFrame(checkSilence)
      }
      // Start VAD after 600ms to skip initial silence
      setTimeout(() => requestAnimationFrame(checkSilence), 600)
    } catch {}
  })
}

/** Browser Web Speech API fallback */
function browserSRCapture(): Promise<string> {
  return new Promise((resolve) => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) { resolve(''); return }

    const recognition = new SR()
    recognition.continuous = false
    recognition.interimResults = false
    recognition.lang = 'en-US'

    recognition.onresult = (event: any) => {
      const text = event.results[0][0].transcript
      resolve(text?.trim() ?? '')
    }
    recognition.onerror = () => resolve('')
    recognition.onend = () => resolve('')

    try { recognition.start() } catch { resolve('') }
  })
}
