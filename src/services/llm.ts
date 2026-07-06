import type { ApiKeys, ChatQA, LLMResult, ModelConfig } from '../types'
import { OPENAI_BASE, ANTHROPIC_BASE, GOOGLE_BASE, NVIDIA_LLM_BASE } from '../config/endpoints'

const SYSTEM_PROMPT = `You are a creative AI for an immersive memory art installation.
The user will describe a travel memory. You must output JSON with exactly these fields:
{
  "refinedText": "Korean narration text (natural, emotional, 1st person, 500-800 chars)",
  "imagePrompt": "English image generation prompt (cinematic, painterly, detailed, evocative — describe the scene as idealized memory, 100-150 words)",
  "audioKeyword": "waves" // exactly 1 single English ambient sound word, no phrases (e.g. "waves", "rain", "cicadas")
}
Output ONLY the JSON, no markdown, no explanation.`

const KEYWORD_SYSTEM_PROMPT = `You are a creative AI for an immersive memory art installation.
The user will describe a travel memory. Suggest 1 alternative ambient sound search keyword for it.
The keyword must be exactly 1 single English word — no phrases (e.g. "waves", "rain", "cicadas").
Output ONLY JSON: { "audioKeyword": "waves" }
No markdown, no explanation.`

const IMAGE_VARIANTS_SYSTEM_PROMPT = `You are a creative AI for an immersive memory art installation.
You will be given a base English image prompt describing a travel memory scene, and a count N.
Generate exactly N distinct English image prompts (cinematic, painterly, detailed, evocative, 100-150 words each) that share
the same mood, color palette, and style as the base prompt, but each depicts a clearly different moment, angle, or detail of
the same memory (e.g. different framing, time of moment, focal subject) — like consecutive frames from the same scene, not
unrelated images.
Output ONLY JSON: { "prompts": ["...", "...", ...] } with exactly N items, no markdown, no explanation.`

const QUESTIONS_SYSTEM_PROMPT = `You are a creative interviewer AI for an immersive memory art installation.
You will be given a base list of Korean interview questions and the user's initial travel-memory description.
Personalize and refine each question so it naturally follows from what the user already said, digging for
concrete sensory and emotional detail without repeating information the user already gave.
Keep exactly the same number of questions as the base list, in Korean, each a single short question (≤40 chars).
For each question, ALSO generate exactly 4 short, distinct, plausible Korean answer choices (each ≤20 chars) the
user could quickly pick instead of typing, relevant to that question and the user's memory context.
Prepend each question and each choice with one relevant emoji followed by a space (e.g. "🌅 노을이 예뻤나요?").
Output ONLY JSON: { "questions": ["...", ...], "choices": [["...","...","...","..."], ...] } — "questions" and
"choices" must each have exactly N items matching the base list length, and each "choices" entry must have exactly
4 strings, no markdown, no explanation.`

const QUESTIONS_WITH_ANSWERS_SYSTEM_PROMPT = `You are a creative interviewer AI for an immersive memory art installation, currently in a debug/testing mode.
You will be given a base list of Korean interview questions and the user's initial travel-memory description.
Personalize and refine each question the same way you normally would, but ALSO write a short plausible Korean
sample answer for each question, as if the user had answered it, consistent with the user's memory description.
Keep exactly the same number of questions as the base list, in Korean, each question a single short line (≤40 chars)
and each answer a short natural sentence (≤60 chars).
Prepend each question with one relevant emoji followed by a space (e.g. "🌅 노을이 예뻤나요?").
Output ONLY JSON: { "questions": ["...", ...], "answers": ["...", ...] } with exactly N items each, matching the base list length, no markdown, no explanation.`

const SINGLE_ANSWER_SYSTEM_PROMPT = `You are helping a user recall a travel memory for an immersive memory art installation.
You will be given the user's initial travel-memory description and one follow-up interview question.
Write a short, plausible, natural Korean answer to the question, consistent with the user's memory description,
as if the user were answering it themselves (1st person, ≤60 chars).
Output ONLY JSON: { "answer": "..." } no markdown, no explanation.`

const CHAT_SUMMARY_SYSTEM_PROMPT = `You are a summarizer AI for an immersive memory art installation.
You will be given a user's initial travel-memory description and a list of follow-up question/answer pairs.
Combine all of this into one concise Korean paragraph describing the memory. Preserve every concrete detail
(place, people, time, sensory details, emotions) mentioned across the original description and all answers —
do not drop any information — but remove redundancy and keep it tight (≤1000 chars).
Output ONLY JSON: { "summary": "..." } no markdown, no explanation.`

const TIMEOUT_MS = 60_000

function makeSignal(): AbortSignal {
  return AbortSignal.timeout(TIMEOUT_MS)
}

// Small/local models sometimes stop generating before closing the JSON object
// (finish_reason "stop" with a dangling string or missing braces). Best-effort repair.
function repairTruncatedJSON(s: string): string {
  let out = s
  const quoteCount = (out.match(/(?<!\\)"/g) ?? []).length
  if (quoteCount % 2 === 1) out += '"'
  const openBraces = (out.match(/{/g) ?? []).length
  const closeBraces = (out.match(/}/g) ?? []).length
  out += '}'.repeat(Math.max(0, openBraces - closeBraces))
  return out
}

function extractJSON<T>(raw: string): T {
  // strip <think>...</think> blocks (DeepSeek reasoning models)
  const stripped = raw.replace(/<think>[\s\S]*?<\/think>/gi, '').trim()
  // strip ```json ... ``` fences
  const fenced = stripped.replace(/^```(?:json)?\s*/m, '').replace(/\s*```\s*$/m, '').trim()
  try {
    return JSON.parse(fenced)
  } catch {
    return JSON.parse(repairTruncatedJSON(fenced))
  }
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

export async function refineAudioKeyword(
  userText: string,
  config: ModelConfig,
  keys: ApiKeys
): Promise<string> {
  const raw = await callProvider(KEYWORD_SYSTEM_PROMPT, userText, config, keys)
  const { audioKeyword } = extractJSON<{ audioKeyword: string }>(raw)
  return audioKeyword
}

export async function generateImagePrompts(
  basePrompt: string,
  count: number,
  config: ModelConfig,
  keys: ApiKeys
): Promise<string[]> {
  if (count <= 1) return [basePrompt]
  const raw = await callProvider(
    IMAGE_VARIANTS_SYSTEM_PROMPT,
    `Base prompt: ${basePrompt}\nN = ${count}`,
    config,
    keys
  )
  const { prompts } = extractJSON<{ prompts: string[] }>(raw)
  if (!Array.isArray(prompts) || prompts.length !== count) throw new Error(`Expected ${count} image prompts, got ${prompts?.length}`)
  return prompts
}

export async function generateQuestions(
  userText: string,
  baseQuestions: string[],
  config: ModelConfig,
  keys: ApiKeys
): Promise<{ questions: string[]; choices: string[][] }> {
  const raw = await callProvider(
    QUESTIONS_SYSTEM_PROMPT,
    `Base questions:\n${baseQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}\n\nUser's memory:\n${userText}`,
    config,
    keys
  )
  const { questions, choices } = extractJSON<{ questions: string[]; choices: string[][] }>(raw)
  if (!Array.isArray(questions) || questions.length !== baseQuestions.length) {
    throw new Error(`Expected ${baseQuestions.length} questions, got ${questions?.length}`)
  }
  if (!Array.isArray(choices) || choices.length !== baseQuestions.length || choices.some((c) => !Array.isArray(c) || c.length !== 4)) {
    throw new Error(`Expected ${baseQuestions.length} choice groups of 4, got ${JSON.stringify(choices)}`)
  }
  return { questions, choices }
}

export async function generateQuestionsWithAnswers(
  userText: string,
  baseQuestions: string[],
  config: ModelConfig,
  keys: ApiKeys
): Promise<{ questions: string[]; answers: string[] }> {
  const raw = await callProvider(
    QUESTIONS_WITH_ANSWERS_SYSTEM_PROMPT,
    `Base questions:\n${baseQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}\n\nUser's memory:\n${userText}`,
    config,
    keys
  )
  const { questions, answers } = extractJSON<{ questions: string[]; answers: string[] }>(raw)
  if (!Array.isArray(questions) || questions.length !== baseQuestions.length) {
    throw new Error(`Expected ${baseQuestions.length} questions, got ${questions?.length}`)
  }
  if (!Array.isArray(answers) || answers.length !== baseQuestions.length) {
    throw new Error(`Expected ${baseQuestions.length} answers, got ${answers?.length}`)
  }
  return { questions, answers }
}

export async function generateSingleAnswer(
  userText: string,
  question: string,
  config: ModelConfig,
  keys: ApiKeys
): Promise<string> {
  const raw = await callProvider(
    SINGLE_ANSWER_SYSTEM_PROMPT,
    `User's memory:\n${userText}\n\nQuestion:\n${question}`,
    config,
    keys
  )
  const { answer } = extractJSON<{ answer: string }>(raw)
  return answer
}

export async function summarizeChat(
  userText: string,
  qa: ChatQA[],
  config: ModelConfig,
  keys: ApiKeys
): Promise<string> {
  const qaText = qa
    .filter((x) => x.answer.trim())
    .map((x) => `Q: ${x.question}\nA: ${x.answer}`)
    .join('\n\n')
  const raw = await callProvider(
    CHAT_SUMMARY_SYSTEM_PROMPT,
    `Initial memory:\n${userText}\n\n${qaText}`,
    config,
    keys
  )
  const { summary } = extractJSON<{ summary: string }>(raw)
  return summary
}
