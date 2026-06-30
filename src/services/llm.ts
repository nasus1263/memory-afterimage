import type { ApiKeys, LLMResult, ModelConfig } from '../types'

const SYSTEM_PROMPT = `You are a creative AI for an immersive memory art installation.
The user will describe a travel memory. You must output JSON with exactly these fields:
{
  "refinedText": "Korean narration text (natural, emotional, 1st person, ≤200 chars — must complete within 1 minute when spoken aloud)",
  "imagePrompt": "English image generation prompt (cinematic, painterly, detailed, evocative — describe the scene as idealized memory, 100-150 words)",
  "audioKeywords": ["keyword1", "keyword2"] // 2-3 English ambient sound keywords (e.g. 'ocean waves', 'summer cicadas')
}
Output ONLY the JSON, no markdown, no explanation.`

const TIMEOUT_MS = 60_000

function makeSignal(): AbortSignal {
  return AbortSignal.timeout(TIMEOUT_MS)
}

function extractJSON(raw: string): LLMResult {
  // strip <think>...</think> blocks (DeepSeek reasoning models)
  const stripped = raw.replace(/<think>[\s\S]*?<\/think>/gi, '').trim()
  // strip ```json ... ``` fences
  const fenced = stripped.replace(/^```(?:json)?\s*/m, '').replace(/\s*```\s*$/m, '').trim()
  return JSON.parse(fenced)
}

async function callOpenAI(text: string, model: string, key: string): Promise<LLMResult> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    signal: makeSignal(),
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: text }],
      response_format: { type: 'json_object' },
      max_tokens: 1024,
    }),
  })
  if (!res.ok) throw new Error(`OpenAI LLM ${res.status}: ${await res.text()}`)
  const data = await res.json()
  return extractJSON(data.choices[0].message.content)
}

async function callNvidia(text: string, model: string, key: string, baseUrl: string): Promise<LLMResult> {
  // NVIDIA NIM: response_format not universally supported; rely on system prompt + extractJSON
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    signal: makeSignal(),
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: text }],
      max_tokens: 2048,
      temperature: 0.7,
    }),
  })
  if (!res.ok) throw new Error(`NVIDIA LLM ${res.status}: ${await res.text()}`)
  const data = await res.json()
  return extractJSON(data.choices[0].message.content)
}

async function callAnthropic(text: string, model: string, key: string): Promise<LLMResult> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
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
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: text }],
    }),
  })
  if (!res.ok) throw new Error(`Anthropic LLM ${res.status}: ${await res.text()}`)
  const data = await res.json()
  return extractJSON(data.content[0].text)
}

async function callGoogle(text: string, model: string, key: string): Promise<LLMResult> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
    {
      method: 'POST',
      signal: makeSignal(),
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ parts: [{ text }] }],
        generationConfig: { responseMimeType: 'application/json' },
      }),
    }
  )
  if (!res.ok) throw new Error(`Google LLM ${res.status}: ${await res.text()}`)
  const data = await res.json()
  return extractJSON(data.candidates[0].content.parts[0].text)
}

// Dev: Vite proxy (/nvidia-nim → https://integrate.api.nvidia.com)
// Prod: direct call will CORS-fail — needs a reverse proxy
const NVIDIA_LLM_BASE = import.meta.env.DEV
  ? '/nvidia-nim/v1'
  : 'https://integrate.api.nvidia.com/v1'

export async function refineMemo(
  userText: string,
  config: ModelConfig,
  keys: ApiKeys
): Promise<LLMResult> {
  const { provider, model } = config.llm
  if (provider === 'openai') return callOpenAI(userText, model, keys.openai)
  if (provider === 'nvidia') return callNvidia(userText, model, keys.nvidia, NVIDIA_LLM_BASE)
  if (provider === 'anthropic') return callAnthropic(userText, model, keys.anthropic)
  if (provider === 'google') return callGoogle(userText, model, keys.google)
  throw new Error(`Unknown LLM provider: ${provider}`)
}
