import type { Context } from '@netlify/functions'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic()

const SYSTEM_PROMPT = `You are the FinClear AI assistant — a concise, friendly guide embedded on a site of free calculators (debt snowball, retirement, BMI/calories, sleep cycles, freelance rate).

Rules:
- Keep answers short (2–5 sentences) and practical.
- Explain concepts in plain English. Use examples with round numbers.
- Point users to the relevant on-site calculator by name when it matches their question.
- Never give regulated financial, legal, tax, or medical advice. For specific personal decisions, recommend a licensed professional.
- Decline politely if asked for anything outside finance, budgeting, freelancing, sleep, or general wellness.`

type ChatMessage = { role: 'user' | 'assistant'; content: string }

export default async (req: Request, _context: Context) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  let payload: { messages?: ChatMessage[] }
  try {
    payload = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const messages = (payload.messages || [])
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .slice(-12)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }))

  if (messages.length === 0 || messages[messages.length - 1].role !== 'user') {
    return Response.json({ error: 'Last message must be from the user.' }, { status: 400 })
  }

  try {
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 400,
      system: SYSTEM_PROMPT,
      messages,
    })

    const reply = message.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { type: 'text'; text: string }).text)
      .join('\n')
      .trim()

    return Response.json({ reply })
  } catch (err) {
    console.error('chat function error', err)
    return Response.json({ error: 'Assistant unavailable.' }, { status: 502 })
  }
}

export const config = {
  path: '/api/chat',
}
