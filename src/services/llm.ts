import type { ApiKeys, LLMResult, ModelConfig } from '../types'
import { OPENAI_BASE, ANTHROPIC_BASE, GOOGLE_BASE, NVIDIA_LLM_BASE } from '../config/endpoints'

const SYSTEM_PROMPT = `You are a creative AI for an immersive memory art installation.
The user will describe a travel memory. You must output JSON with exactly these fields:
{
  "refinedText": "Korean narration text (natural, emotional, 1st person, ≤200 chars — must complete within 1 minute when spoken aloud)",
  "imagePrompt": "English image generation prompt (cinematic, painterly, detailed, evocative — describe the scene as idealized memory, 100-150 words)",
  "audioKeywords": ["keyword1", "keyword2"] // 2-3 English ambient sound keywords (e.g. 'ocean waves', 'summer cicadas')
}
Output ONLY the JSON, no markdown, no explanation.`

function keywordSystemPrompt(maxWords: number): string {
  const lengthRule = maxWords === 1
    ? 'each keyword must be exactly 1 English word — a single word, no phrases (e.g. "waves", "rain", "cicadas")'
    : `each keyword at most ${maxWords} English words long`
  return `You are a creative AI for an immersive memory art installation.
The user will describe a travel memory. Suggest 3 alternative English ambient sound search
keywords for it. ${lengthRule}.
Output ONLY JSON: { "audioKeywords": ["keyword1", "keyword2", "keyword3"] }
No markdown, no explanation.`
}

const TIMEOUT_MS = 60_000

function makeSignal(): AbortSignal {
  return AbortSignal.timeout(TIMEOUT_MS)
}

function extractJSON<T>(raw: string): T {
  // strip <think>...</think> blocks (DeepSeek reasoning models)
  const stripped = raw.replace(/<think>[\s\S]*?<\/think>/gi, '').trim()
  // strip ```json ... ``` fences
  const fenced = stripped.replace(/^```(?:json)?\s*/m, '').replace(/\s*```\s*$/m, '').trim()
  return JSON.parse(fenced)
}

async function callOpenAI(systemPrompt: string, text: string, model: string, key: string): Promise<string> {
  const res = await fetch(`${OPENAI_BASE}/chat/completions`, {
    method: 'POST',
    signal: makeSignal(),
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: text }],
      response_format: { type: 'json_object' },
      max_tokens: 1024,
    }),
  })
  if (!res.ok) throw new Error(`OpenAI LLM ${res.status}: ${await res.text()}`)
  const data = await res.json()
  return data.choices[0].message.content
}

async function callNvidia(systemPrompt: string, text: string, model: string, key: string, baseUrl: string): Promise<string> {
  // NVIDIA NIM: response_format not universally supported; rely on system prompt + extractJSON
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    signal: makeSignal(),
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: text }],
      max_tokens: 2048,
      temperature: 0.7,
    }),
  })
  if (!res.ok) throw new Error(`NVIDIA LLM ${res.status}: ${await res.text()}`)
  const data = await res.json()
  return data.choices[0].message.content
}

async function callAnthropic(systemPrompt: string, text: string, model: string, key: string): Promise<string> {
  const res = await fetch(`${ANTHROPIC_BASE}/messages`, {
    method: 'POST',
    signal: makeSignal(),
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: text }],
    }),
  })
  if (!res.ok) throw new Error(`Anthropic LLM ${res.status}: ${await res.text()}`)
  const data = await res.json()
  return data.content[0].text
}

async function callGoogle(systemPrompt: string, text: string, model: string, key: string): Promise<string> {
  const res = await fetch(
    `${GOOGLE_BASE}/models/${model}:generateContent?key=${key}`,
    {
      method: 'POST',
      signal: makeSignal(),
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ parts: [{ text }] }],
        generationConfig: { responseMimeType: 'application/json' },
      }),
    }
  )
  if (!res.ok) throw new Error(`Google LLM ${res.status}: ${await res.text()}`)
  const data = await res.json()
  return data.candidates[0].content.parts[0].text
}

async function callProvider(
  systemPrompt: string,
  userText: string,
  config: ModelConfig,
  keys: ApiKeys
): Promise<string> {
  const { provider, model } = config.llm
  if (provider === 'openai') return callOpenAI(systemPrompt, userText, model, keys.openai)
  if (provider === 'nvidia') return callNvidia(systemPrompt, userText, model, keys.nvidia, NVIDIA_LLM_BASE)
  if (provider === 'anthropic') return callAnthropic(systemPrompt, userText, model, keys.anthropic)
  if (provider === 'google') return callGoogle(systemPrompt, userText, model, keys.google)
  throw new Error(`Unknown LLM provider: ${provider}`)
}

export async function refineMemo(
  userText: string,
  config: ModelConfig,
  keys: ApiKeys
): Promise<LLMResult> {
  const raw = await callProvider(SYSTEM_PROMPT, userText, config, keys)
  return extractJSON<LLMResult>(raw)
}

export async function refineAudioKeywords(
  userText: string,
  maxWords: number,
  config: ModelConfig,
  keys: ApiKeys
): Promise<string[]> {
  const raw = await callProvider(keywordSystemPrompt(maxWords), userText, config, keys)
  const { audioKeywords } = extractJSON<{ audioKeywords: string[] }>(raw)
  return audioKeywords
}
