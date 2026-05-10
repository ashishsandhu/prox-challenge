import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createOpenAI } from '@ai-sdk/openai' // Groq uses OpenAI-compatible endpoint

export type ModelCapabilities = {
  supportsVision: boolean
  provider: 'anthropic' | 'google' | 'groq'
}

export function getModel() {
  if (process.env.ANTHROPIC_API_KEY) {
    const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    return anthropic('claude-opus-4-7')
  }

  if (process.env.GOOGLE_API_KEY) {
    const google = createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_API_KEY })
    return google('gemini-3.1-pro-preview')
  }

  if (process.env.GROQ_API_KEY) {
    const groq = createOpenAI({
      apiKey: process.env.GROQ_API_KEY,
      baseURL: 'https://api.groq.com/openai/v1',
    })
    return groq('llama-3.3-70b-versatile')
  }

  throw new Error(
    'No API key found. Set ANTHROPIC_API_KEY, GOOGLE_API_KEY, or GROQ_API_KEY in .env'
  )
}

export function getFastModel() {
  if (process.env.ANTHROPIC_API_KEY) {
    const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    return anthropic('claude-haiku-4-5')
  }

  if (process.env.GOOGLE_API_KEY) {
    const google = createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_API_KEY })
    return google('gemini-3.1-flash-lite-preview')
  }

  if (process.env.GROQ_API_KEY) {
    const groq = createOpenAI({
      apiKey: process.env.GROQ_API_KEY,
      baseURL: 'https://api.groq.com/openai/v1',
    })
    return groq('llama3-8b-8192')
  }

  throw new Error('No API key found.')
}

export function getModelCapabilities(): ModelCapabilities {
  if (process.env.ANTHROPIC_API_KEY) return { supportsVision: true,  provider: 'anthropic' }
  if (process.env.GOOGLE_API_KEY)    return { supportsVision: true,  provider: 'google'    }
  if (process.env.GROQ_API_KEY)      return { supportsVision: true,  provider: 'groq'      }
  throw new Error('No API key found.')
}
