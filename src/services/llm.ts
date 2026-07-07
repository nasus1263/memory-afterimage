import type { ApiKeys, ChatQA, LLMResult, ModelConfig } from '../types'
import { GOOGLE_BASE, NVIDIA_LLM_BASE, OLLAMA_BASE } from '../config/endpoints'

const SYSTEM_PROMPT = `You are a creative AI for an immersive memory art installation.
The user will describe a travel memory. You must output JSON with exactly these fields:
{
  "refinedText": "Korean narration text (natural, emotional, 1st person, 1000-1600 chars)",
  "imagePrompt": "English image generation prompt (cinematic, painterly, detailed, evocative — describe the scene as idealized memory, 100-150 words)",
  "audioKeyword": "waves" // exactly 1 single English ambient sound word, no phrases (e.g. "waves", "rain", "cicadas")
}
CRITICAL LANGUAGE RULES — each field has a FIXED language, regardless of the input language:
- "refinedText" MUST be Korean (한국어), written in Hangul ONLY. It is narration spoken by a Korean TTS voice
  that CRASHES on non-Hangul characters. Therefore transliterate EVERY foreign word, place name, and proper noun
  into Hangul using Korean loanword spelling — never leave Latin letters. Examples: "CN Tower"→"씨엔 타워",
  "Niagara Falls"→"나이아가라 폭포", "Eiffel"→"에펠", "Louvre"→"루브르". No English letters may appear in refinedText.
- "imagePrompt" MUST be English ONLY. It is fed to an image model trained on English; Korean or any non-English
  text produces wrong, unrelated images. Do NOT write imagePrompt in Korean under any circumstances — translate
  the scene into natural English. Every word of imagePrompt must be English.
- "audioKeyword" MUST be a single English word.
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
CRITICAL: every prompt MUST be written in English ONLY — never Korean or any other language. These are fed to an
image model trained on English; non-English text produces wrong images. Even if the base prompt is not English,
output all prompts in natural English.
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

// 이미지 프롬프트는 반드시 영어여야 한다(FLUX 등 영어 학습 모델). 로컬 소형 모델이 종종 한국어로
// 생성하므로, 한글 음절이 섞이면 실패로 간주해 withRetry가 재생성하도록 한다.
const HANGUL_RE = /[가-힣]/
function assertEnglishImagePrompt(prompt: string): void {
  if (HANGUL_RE.test(prompt)) {
    throw new Error(`imagePrompt must be English but contains Korean: ${prompt.slice(0, 40)}...`)
  }
}

// refinedText는 GPT-SoVITS(한국어 전용, 비한글에 크래시)로 낭독되므로 라틴 문자가 없어야 한다.
// 로컬 모델이 고유명사를 영어로 남기면 실패로 간주해 withRetry가 재생성하도록 한다.
const LATIN_RE = /[A-Za-z]/
function assertHangulNarration(text: string): void {
  if (LATIN_RE.test(text)) {
    const latin = text.match(/[A-Za-z]+/g)?.slice(0, 5).join(', ')
    throw new Error(`refinedText must be Hangul-only but contains Latin letters: ${latin}`)
  }
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

async function callOllama(systemPrompt: string, text: string, model: string, baseUrl: string): Promise<string> {
  // Ollama OpenAI 호환 엔드포인트. 로컬이라 인증 없음.
  // response_format json_object로 소형 모델의 JSON 이탈을 억제(extractJSON/withRetry가 백업).
  // num_ctx는 이 경로에서 지원되지 않아, 긴 refinedText는 max_tokens로 출력 여유를 확보.
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    signal: makeSignal(),
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: text }],
      max_tokens: 2048,
      temperature: 0.7,
      response_format: { type: 'json_object' },
    }),
  })
  if (!res.ok) throw new Error(`Ollama LLM ${res.status}: ${await res.text()}`)
  const data = await res.json()
  return data.choices[0].message.content
}

async function callProvider(
  systemPrompt: string,
  userText: string,
  config: ModelConfig,
  keys: ApiKeys
): Promise<string> {
  const { provider, model } = config.llm
  if (provider === 'nvidia') return callNvidia(systemPrompt, userText, model, keys.nvidia, NVIDIA_LLM_BASE)
  if (provider === 'google') return callGoogle(systemPrompt, userText, model, keys.google)
  if (provider === 'ollama') return callOllama(systemPrompt, userText, model, OLLAMA_BASE)
  throw new Error(`Unknown LLM provider: ${provider}`)
}

const JSON_RETRIES = 3

// 추론 모델에 JSON 요청 시 파싱 실패·형식 불일치(길이 검증 등)로 던지는 에러를 최대 3회까지 재시도.
async function withRetry<T>(fn: () => Promise<T>, retries = JSON_RETRIES): Promise<T> {
  let lastErr: unknown
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn()
    } catch (e) {
      lastErr = e
      console.warn(`[llm] JSON 요청 실패, 재시도 ${attempt}/${retries}`, e)
    }
  }
  throw lastErr
}

export async function refineMemo(
  userText: string,
  config: ModelConfig,
  keys: ApiKeys
): Promise<LLMResult> {
  return withRetry(async () => {
    const raw = await callProvider(SYSTEM_PROMPT, userText, config, keys)
    const result = extractJSON<LLMResult>(raw)
    assertEnglishImagePrompt(result.imagePrompt)
    assertHangulNarration(result.refinedText)
    return result
  })
}

export async function refineAudioKeyword(
  userText: string,
  config: ModelConfig,
  keys: ApiKeys
): Promise<string> {
  return withRetry(async () => {
    const raw = await callProvider(KEYWORD_SYSTEM_PROMPT, userText, config, keys)
    const { audioKeyword } = extractJSON<{ audioKeyword: string }>(raw)
    return audioKeyword
  })
}

export async function generateImagePrompts(
  basePrompt: string,
  count: number,
  config: ModelConfig,
  keys: ApiKeys
): Promise<string[]> {
  if (count <= 1) return [basePrompt]
  return withRetry(async () => {
    const raw = await callProvider(
      IMAGE_VARIANTS_SYSTEM_PROMPT,
      `Base prompt: ${basePrompt}\nN = ${count}`,
      config,
      keys
    )
    const { prompts } = extractJSON<{ prompts: string[] }>(raw)
    // LLM이 종종 요청한 개수보다 1~2개 더 반환한다(특히 소형 모델). 초과분은 잘라내고,
    // 부족할 때만 에러를 던져 재시도를 유발한다.
    if (!Array.isArray(prompts) || prompts.length < count) throw new Error(`Expected ${count} image prompts, got ${prompts?.length}`)
    const sliced = prompts.slice(0, count)
    sliced.forEach(assertEnglishImagePrompt)
    return sliced
  })
}

export async function generateQuestions(
  userText: string,
  baseQuestions: string[],
  config: ModelConfig,
  keys: ApiKeys
): Promise<{ questions: string[]; choices: string[][] }> {
  return withRetry(async () => {
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
  })
}

export async function generateQuestionsWithAnswers(
  userText: string,
  baseQuestions: string[],
  config: ModelConfig,
  keys: ApiKeys
): Promise<{ questions: string[]; answers: string[] }> {
  return withRetry(async () => {
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
  })
}

export async function generateSingleAnswer(
  userText: string,
  question: string,
  config: ModelConfig,
  keys: ApiKeys
): Promise<string> {
  return withRetry(async () => {
    const raw = await callProvider(
      SINGLE_ANSWER_SYSTEM_PROMPT,
      `User's memory:\n${userText}\n\nQuestion:\n${question}`,
      config,
      keys
    )
    const { answer } = extractJSON<{ answer: string }>(raw)
    return answer
  })
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
  return withRetry(async () => {
    const raw = await callProvider(
      CHAT_SUMMARY_SYSTEM_PROMPT,
      `Initial memory:\n${userText}\n\n${qaText}`,
      config,
      keys
    )
    const { summary } = extractJSON<{ summary: string }>(raw)
    return summary
  })
}
