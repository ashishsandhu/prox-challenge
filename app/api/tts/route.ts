import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

// Clean markdown / UI noise from text before sending to TTS
function cleanText(raw: string): string {
  return raw
    .replace(/\*\*/g, '')
    .replace(/#{1,6} /g, '')
    .replace(/\[.*?\]\(.*?\)/g, '')
    .replace(/`/g, '')
    .replace(/\n{2,}/g, '. ')
    .replace(/\n/g, ' ')
    .trim()
    // Limit to ~300 chars so TTS stays snappy
    .slice(0, 500)
}

export async function POST(req: Request) {
  const { text } = await req.json()
  if (!text) return new Response('No text', { status: 400 })

  const clean = cleanText(text)
  const elevenKey = process.env.ELEVENLABS_API_KEY
  const fishKey = process.env.FISH_AUDIO_API_KEY

  // ── 1. FishAudio (Primary - Ultra Fast) ─────────────────────────────────
  if (fishKey) {
    try {
      const voiceId = process.env.FISH_AUDIO_VOICE_ID ?? '8ef4a238714b45718ce04243307c57a7'
      const payload = {
        text: clean,
        format: 'mp3',
        reference_id: voiceId,
        latency: 'balanced',
        prosody: {
          speed: 1.1,
          volume: 0
        }
      }
      const res = await fetch('https://api.fish.audio/v1/tts', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${fishKey}`,
          'Content-Type': 'application/json',
          'model': 's2-pro'
        },
        body: JSON.stringify(payload),
      })
      if (res.ok && res.body) {
        // Stream the response directly to the client for zero-latency start
        return new Response(res.body, {
          headers: { 
            'Content-Type': 'audio/mpeg', 
            'Cache-Control': 'no-store',
            'Transfer-Encoding': 'chunked' 
          },
        })
      }
      const errorText = await res.text()
      console.warn('[tts] FishAudio error:', res.status, errorText)
      return new Response(JSON.stringify({ error: `FishAudio Error: ${errorText}` }), { 
        status: res.status, 
        headers: { 'Content-Type': 'application/json' } 
      })
    } catch (e: any) {
      console.warn('[tts] FishAudio failed:', e)
      return new Response(JSON.stringify({ error: `FishAudio Connection Failed: ${e.message}` }), { 
        status: 500, 
        headers: { 'Content-Type': 'application/json' } 
      })
    }
  }

  // ── 2. ElevenLabs (Fallback) ─────────────────────────────────────────────
  if (elevenKey) {
    try {
      const voiceId = process.env.ELEVENLABS_VOICE_ID ?? 'EXAVITQu4vr4xnSDxMaL'
      const res = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream?output_format=mp3_44100_128`,
        {
          method: 'POST',
          headers: {
            'xi-api-key': elevenKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text: clean,
            model_id: 'eleven_turbo_v2_5',
            voice_settings: {
              stability: 0.45,
              similarity_boost: 0.80,
              style: 0.1,
              use_speaker_boost: true,
            },
          }),
        }
      )
      if (res.ok && res.body) {
        return new Response(res.body, {
          headers: { 
            'Content-Type': 'audio/mpeg', 
            'Cache-Control': 'no-store',
            'Transfer-Encoding': 'chunked'
          },
        })
      }
    } catch (e) {
      console.warn('[tts] ElevenLabs failed:', e)
    }
  }

  // ── 3. No provider configured — signal client to use browser TTS ─────────
  return new Response(
    JSON.stringify({ error: 'No TTS provider configured. Add ELEVENLABS_API_KEY or FISH_AUDIO_API_KEY to .env.' }),
    { status: 500, headers: { 'Content-Type': 'application/json' } }
  )
}
