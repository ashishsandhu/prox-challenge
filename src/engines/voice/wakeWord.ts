export function startWakeWordListener(onWake: () => void): any | null {
  const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
  if (!SR) return null

  const recognition = new SR()
  recognition.continuous = true
  recognition.interimResults = true
  recognition.lang = 'en-US'

  recognition.onresult = (event: any) => {
    const transcript = Array.from(event.results)
      .map((r: any) => r[0].transcript.toLowerCase())
      .join(' ')

    if (transcript.includes('hey vulcan') || transcript.includes('hey welder')) {
      recognition.stop()
      onWake()
    }
  }

  // Auto-restart — browser kills continuous recognition after ~60s silence
  recognition.onend = () => setTimeout(() => {
    try { recognition.start() } catch {}
  }, 300)

  try { recognition.start() } catch {}
  return recognition
}
