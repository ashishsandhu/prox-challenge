import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  const formData = await req.formData()
  const audio = formData.get('audio') as Blob | null
  if (!audio) return NextResponse.json({ error: 'No audio' }, { status: 400 })

  const groqKey = process.env.GROQ_API_KEY
  const openaiKey = process.env.OPENAI_API_KEY

  // Attempt Groq Whisper (fast, free tier)
  if (groqKey) {
    try {
      const form = new FormData()
      form.append('file', audio, 'audio.webm')
      form.append('model', 'whisper-large-v3-turbo')
      form.append('language', 'en')
      form.append('response_format', 'json')

      const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${groqKey}` },
        body: form,
      })
      if (res.ok) {
        const json = await res.json()
        return NextResponse.json({ text: json.text ?? '' })
      }
      console.warn('[transcribe] Groq Whisper error:', res.status, await res.text())
    } catch (e) {
      console.warn('[transcribe] Groq Whisper failed:', e)
    }
  }

  // Fallback 1: Google Gemini (if GOOGLE_API_KEY is present)
  const googleKey = process.env.GOOGLE_API_KEY
  if (googleKey) {
    try {
      const { GoogleGenAI } = await import('@google/genai')
      const genAI = new GoogleGenAI({ apiKey: googleKey })
      
      const buffer = await audio.arrayBuffer()
      const result = await genAI.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [
          {
            inlineData: {
              data: Buffer.from(buffer).toString('base64'),
              mimeType: 'audio/webm'
            }
          },
          { text: 'Transcribe this audio. Return ONLY the transcription text, nothing else.' }
        ]
      })
      
      const text = (result.text ?? '').trim()
      if (text) {
        return NextResponse.json({ text })
      }
    } catch (e) {
      console.warn('[transcribe] Google Gemini failed:', e)
    }
  }

  // Fallback 2: OpenAI Whisper
  if (openaiKey) {
    try {
      const form = new FormData()
      form.append('file', audio, 'audio.webm')
      form.append('model', 'whisper-1')

      const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${openaiKey}` },
        body: form,
      })
      if (res.ok) {
        const json = await res.json()
        return NextResponse.json({ text: json.text ?? '' })
      }
    } catch (e) {
      console.warn('[transcribe] OpenAI Whisper failed:', e)
    }
  }

  // No Whisper keys — return empty so client falls back to browser SR
  return NextResponse.json({ text: '' })
}
