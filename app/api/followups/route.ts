import { NextResponse } from 'next/server'
import { generateObject } from 'ai'
import { z } from 'zod'
import { getFastModel } from '@/providers/ModelProvider'


export const runtime = 'edge'

export async function POST(req: Request) {
  try {
    const { messages, currentIntent } = await req.json()
    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ prompts: [] })
    }

    // Build concise history
    const historyLines = messages.slice(-6).map((m: any) => {
      let content = typeof m.content === 'string' ? m.content : '[Image/Data]'
      return `${m.role === 'user' ? 'User' : 'Assistant'}: ${content}`
    }).join('\n')

    const fastModel = getFastModel()

    const { object } = await generateObject({
      model: fastModel,
      schema: z.object({
        prompts: z.array(z.string())
      }),
      system: `You are generating 3 short, highly relevant follow-up questions for a user operating a Vulcan OmniPro 220 welder.
The questions must be exactly what the user might ask next based on the recent conversation history.
If the user just asked about MIG setup, give questions about MIG settings or gas.
If the user just asked about duty cycle, ask about cooling times or changing amperage.
Keep the questions under 10 words each. Do not use generic filler.
Current suspected intent: ${currentIntent || 'general'}`,
      prompt: `CONVERSATION HISTORY:\n${historyLines}\n\nGenerate exactly 3 follow-up prompts for the user.`
    })

    return NextResponse.json(object)
  } catch (error) {
    console.error('[followups]', error)
    return NextResponse.json({ prompts: [] })
  }
}
