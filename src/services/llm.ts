import type { ApiKeys, LLMProvider, LLMResult, ModelConfig } from '../types'

const SYSTEM_PROMPT = `You are a creative AI for an immersive memory art installation.
The user will describe a travel memory. You must output JSON with exactly these fields:
{
  "refinedText": "Korean narration text (natural, emotional, 1st person, ≤200 chars — must complete within 1 minute when spoken aloud)",
  "imagePrompt": "English image generation prompt (cinematic, painterly, detailed, evocative — describe the scene as idealized memory, 100-150 words)",
  "audioKeywords": ["keyword1", "keyword2"] // 2-3 English ambient sound keywords (e.g. 'ocean waves', 'summer cicadas')
}
Output ONLY the JSON, no markdown, no explanation.`

async function callOpenAI(text: string, model: string, key: string): Promise<LLMResult> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: text },
      ],
      response_format: { type: 'json_object' },
    }),
  })
  if (!res.ok) throw new Error(`OpenAI LLM error: ${res.status} ${await res.text()}`)
  const data = await res.json()
  return JSON.parse(data.choices[0].message.content)
}

async function callAnthropic(text: string, model: string, key: string): Promise<LLMResult> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: text }],
    }),
  })
  if (!res.ok) throw new Error(`Anthropic LLM error: ${res.status} ${await res.text()}`)
  const data = await res.json()
  return JSON.parse(data.content[0].text)
}

async function callGoogle(text: string, model: string, key: string): Promise<LLMResult> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ parts: [{ text }] }],
        generationConfig: { responseMimeType: 'application/json' },
      }),
    }
  )
  if (!res.ok) throw new Error(`Google LLM error: ${res.status} ${await res.text()}`)
  const data = await res.json()
  return JSON.parse(data.candidates[0].content.parts[0].text)
}

export async function refineMemo(
  userText: string,
  config: ModelConfig,
  keys: ApiKeys
): Promise<LLMResult> {
  const { provider, model } = config.llm
  const providerMap: Record<LLMProvider, () => Promise<LLMResult>> = {
    openai: () => callOpenAI(userText, model, keys.openai),
    anthropic: () => callAnthropic(userText, model, keys.anthropic),
    google: () => callGoogle(userText, model, keys.google),
  }
  return providerMap[provider]()
}
