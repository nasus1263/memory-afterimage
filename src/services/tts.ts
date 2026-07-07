import type { ApiKeys, ModelConfig, TTSAlignment } from '../types'
import {
  GOOGLE_BASE, ELEVENLABS_BASE,
  GPT_SOVITS_BASE, GPT_SOVITS_UPLOAD_REF,
  GPT_SOVITS_REF_WAV_PATH, GPT_SOVITS_REF_PROMPT_TEXT,
} from '../config/endpoints'
import { getVoiceRef } from './voiceRef'

export interface TTSResult {
  blob: Blob
  duration: number
  alignment?: TTSAlignment
}

// TTS는 타임아웃이 없으면 서버 크래시(GPT-SoVITS의 IncompleteRead 등)·네트워크 문제 시 무한 대기한다.
// 긴 대본 합성이 오래 걸릴 수 있으므로 여유있게 120초로 잡되, 넘으면 에러로 드러나게 한다.
const TTS_TIMEOUT_MS = 120_000
function ttsSignal(): AbortSignal {
  return AbortSignal.timeout(TTS_TIMEOUT_MS)
}

async function getBlobDuration(blob: Blob): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob)
    const audio = new Audio(url)
    audio.addEventListener('loadedmetadata', () => {
      URL.revokeObjectURL(url)
      resolve(audio.duration)
    })
    audio.addEventListener('error', () => {
      URL.revokeObjectURL(url)
      resolve(30)
    })
  })
}

async function ttsGoogle(text: string, model: string, voice: string, key: string): Promise<TTSResult> {
  const res = await fetch(
    `${GOOGLE_BASE}/models/${model}:generateContent?key=${key}`,
    {
      method: 'POST',
      signal: ttsSignal(),
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text }] }],
        generationConfig: {
          response_modalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } },
          },
        },
      }),
    }
  )
  if (!res.ok) throw new Error(`Google TTS error: ${res.status} ${await res.text()}`)
  const data = await res.json()
  const audioData = data.candidates[0].content.parts[0].inlineData
  const bytes = Uint8Array.from(atob(audioData.data), (c) => c.charCodeAt(0))
  const blob = new Blob([bytes], { type: audioData.mimeType || 'audio/wav' })
  const duration = await getBlobDuration(blob)
  return { blob, duration }
}

// Local TTS: Web Speech API for playback + silent WAV blob for video composition.
// Duration estimated at ~5 chars/sec for Korean speech.
function makeWavSilence(seconds: number): Blob {
  const sampleRate = 22050
  const numSamples = Math.ceil(sampleRate * seconds)
  const buf = new ArrayBuffer(44 + numSamples * 2)
  const v = new DataView(buf)
  const ws = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i))
  }
  ws(0, 'RIFF'); v.setUint32(4, 36 + numSamples * 2, true)
  ws(8, 'WAVE'); ws(12, 'fmt '); v.setUint32(16, 16, true)
  v.setUint16(20, 1, true); v.setUint16(22, 1, true)
  v.setUint32(24, sampleRate, true); v.setUint32(28, sampleRate * 2, true)
  v.setUint16(32, 2, true); v.setUint16(34, 16, true)
  ws(36, 'data'); v.setUint32(40, numSamples * 2, true)
  // data section is all zeros → silence
  return new Blob([buf], { type: 'audio/wav' })
}

function ttsLocal(text: string): TTSResult {
  const duration = Math.max(10, Math.ceil(text.length / 5))
  const blob = makeWavSilence(duration)
  // Speak via browser's built-in TTS (plays through speakers)
  if ('speechSynthesis' in window) {
    const utter = new SpeechSynthesisUtterance(text)
    utter.lang = 'ko-KR'
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(utter)
  }
  return { blob, duration }
}

// with-timestamps 엔드포인트: 오디오(base64) + 문자 단위 alignment(자막 싱크용)를 함께 반환
async function ttsElevenLabs(text: string, model: string, voice: string, key: string): Promise<TTSResult> {
  const res = await fetch(`${ELEVENLABS_BASE}/text-to-speech/${voice}/with-timestamps`, {
    method: 'POST',
    signal: ttsSignal(),
    headers: { 'Content-Type': 'application/json', 'xi-api-key': key },
    body: JSON.stringify({ text, model_id: model }),
  })
  if (!res.ok) throw new Error(`ElevenLabs TTS ${res.status}: ${await res.text()}`)
  const data = await res.json()
  const bytes = Uint8Array.from(atob(data.audio_base64), (c) => c.charCodeAt(0))
  const blob = new Blob([bytes], { type: 'audio/mpeg' })
  const duration = await getBlobDuration(blob)
  const alignment: TTSAlignment | undefined = data.alignment && {
    characters: data.alignment.characters,
    characterStartTimesSeconds: data.alignment.character_start_times_seconds,
    characterEndTimesSeconds: data.alignment.character_end_times_seconds,
  }
  return { blob, duration, alignment }
}

// 텍스트 주 언어 판별: 한글 음절이 하나라도 있으면 'ko', 없으면(순수 영어 등) 'en'.
// 이 GPT-SoVITS 런타임은 언어 자동 분할기(LangSegmenter, text_language=auto/all_ko)가
// 동작하지 않는다(중·일 모듈을 제외한 환경). text_language=ko에 영어 텍스트가 들어가면
// 서버가 크래시(IncompleteRead)하므로, 넘기기 전에 우리가 ko/en을 직접 골라 방어한다.
function detectTtsLang(text: string): 'ko' | 'en' {
  return /[가-힣]/.test(text) ? 'ko' : 'en'
}

// Float32 PCM(모노)을 16-bit PCM WAV blob으로 인코딩. 서버의 soundfile/librosa가 WAV를
// 네이티브 지원하므로 ffmpeg 없이도 참조 로드가 된다.
function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const buf = new ArrayBuffer(44 + samples.length * 2)
  const v = new DataView(buf)
  const ws = (off: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i)) }
  ws(0, 'RIFF'); v.setUint32(4, 36 + samples.length * 2, true)
  ws(8, 'WAVE'); ws(12, 'fmt '); v.setUint32(16, 16, true)
  v.setUint16(20, 1, true); v.setUint16(22, 1, true)
  v.setUint32(24, sampleRate, true); v.setUint32(28, sampleRate * 2, true)
  v.setUint16(32, 2, true); v.setUint16(34, 16, true)
  ws(36, 'data'); v.setUint32(40, samples.length * 2, true)
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true)
  }
  return new Blob([buf], { type: 'audio/wav' })
}

// 참조 오디오를 GPT-SoVITS 권장 길이(3~10초)로 다듬는다. 발화 전체(예: 19초)를 통째로 참조로
// 쓰면 zero-shot 음색 재현이 흐트러지고 합성이 뭉개진다(실측: 19.5s 참조→합성 0.74s로 붕괴).
// 무음 앞뒤를 잘라 유효 발화만 남기고, 그래도 길면 목표 길이만큼 앞에서 취한다.
const REF_TARGET_SEC = 8 // 3~10초 권장 구간의 중앙. 음색 파악에 충분하고 안정적.
const REF_MAX_SEC = 10
const REF_MIN_SEC = 3
function trimReferenceSamples(samples: Float32Array, sampleRate: number): Float32Array {
  const silenceThreshold = 0.02
  // 유효 발화(무음 아님)의 첫/마지막 지점을 찾는다.
  let start = 0
  while (start < samples.length && Math.abs(samples[start]) < silenceThreshold) start++
  let end = samples.length - 1
  while (end > start && Math.abs(samples[end]) < silenceThreshold) end--
  // 유효 구간이 거의 없으면(트림이 과함) 원본을 그대로 둔다 → 참조가 사라지는 것 방지.
  if (end - start < REF_MIN_SEC * sampleRate) return samples
  // 앞뒤에 짧은 여유(0.1s)를 둬 발화 시작이 뚝 끊기지 않게 한다.
  const pad = Math.floor(0.1 * sampleRate)
  const s = Math.max(0, start - pad)
  const trimmed = samples.subarray(s, Math.min(samples.length, end + pad))
  // 트림 후에도 목표보다 길면 앞에서부터 목표 길이만큼만(도입부가 음색 파악에 유리).
  const maxLen = REF_MAX_SEC * sampleRate
  if (trimmed.length > maxLen) return trimmed.subarray(0, REF_TARGET_SEC * sampleRate)
  return trimmed
}

// 참조 오디오 정제: (1) 노이즈 게이트로 무음 구간의 배경 잡음을 눌러 SNR을 올리고,
// (2) 피크 정규화로 과도한 게인(peak 0.99 근접, 왜곡 위험)을 안전 레벨로 내린다.
// 잡음이 참조에 섞이면 GPT-SoVITS가 그 잡음까지 음색으로 복제해 본래 목소리와 안 닮는다.
function cleanReferenceSamples(samples: Float32Array, sampleRate: number): Float32Array {
  const out = new Float32Array(samples.length)
  // 노이즈 플로어 추정: 20ms 프레임별 RMS의 하위 20% 수준을 배경 잡음으로 본다.
  const win = Math.max(1, Math.floor(0.02 * sampleRate))
  const frameRms: number[] = []
  for (let i = 0; i + win <= samples.length; i += win) {
    let sum = 0
    for (let j = 0; j < win; j++) sum += samples[i + j] * samples[i + j]
    frameRms.push(Math.sqrt(sum / win))
  }
  frameRms.sort((a, b) => a - b)
  const noiseFloor = frameRms.length ? frameRms[Math.floor(frameRms.length * 0.2)] : 0
  // 게이트 임계: 노이즈 플로어의 2배(잡음보다 확실히 큰 것만 통과), 하한 0.01.
  const gate = Math.max(0.01, noiseFloor * 2)
  // 프레임 단위로 부드럽게 게이팅(짧은 발화 유실 방지 위해 프레임 RMS로 판정).
  let peak = 0
  for (let i = 0; i < samples.length; i += win) {
    const end = Math.min(i + win, samples.length)
    let sum = 0
    for (let j = i; j < end; j++) sum += samples[j] * samples[j]
    const rms = Math.sqrt(sum / (end - i))
    const keep = rms >= gate
    for (let j = i; j < end; j++) {
      const v = keep ? samples[j] : samples[j] * 0.1 // 완전 0 대신 -20dB 감쇠(자연스러움 유지)
      out[j] = v
      const a = Math.abs(v)
      if (a > peak) peak = a
    }
  }
  // 피크 정규화: 목표 0.9(헤드룸 확보). peak가 이미 작으면 과증폭하지 않도록 상한 4배.
  if (peak > 0) {
    const gain = Math.min(0.9 / peak, 4)
    for (let i = 0; i < out.length; i++) out[i] *= gain
  }
  return out
}

// 녹음 blob(Chrome은 webm/opus)을 16kHz 모노 WAV로 변환. 브라우저가 디코딩하므로 서버에
// ffmpeg가 없어도 된다. GPT-SoVITS는 어차피 참조를 16kHz로 로드하므로 16k로 맞춰 용량도 줄인다.
// 변환 후 3~10초로 트림해 참조 품질을 확보한다.
// keepRatio: 원본 대비 트림 후 남은 오디오 길이 비율(0~1). prompt_text를 같은 비율로 잘라
// 오디오↔대사 길이 균형을 맞추기 위함(불균형 시 합성이 붕괴/과장됨 — 실측 확인).
async function blobToWav16k(blob: Blob): Promise<{ wav: Blob; keepRatio: number }> {
  const arrayBuf = await blob.arrayBuffer()
  const AC: typeof AudioContext = (window as any).AudioContext || (window as any).webkitAudioContext
  const ctx = new AC()
  try {
    const decoded = await ctx.decodeAudioData(arrayBuf)
    const targetRate = 16000
    // OfflineAudioContext로 16kHz 모노 리샘플링.
    const offline = new OfflineAudioContext(1, Math.ceil(decoded.duration * targetRate), targetRate)
    const src = offline.createBufferSource()
    src.buffer = decoded
    src.connect(offline.destination)
    src.start()
    const rendered = await offline.startRendering()
    const full = rendered.getChannelData(0)
    const trimmed = trimReferenceSamples(full, targetRate)
    const keepRatio = full.length > 0 ? trimmed.length / full.length : 1
    // 트림된 참조 구간에 노이즈 게이트 + 정규화를 적용해 잡음↓·게인 정상화.
    const cleaned = cleanReferenceSamples(trimmed, targetRate)
    return { wav: encodeWav(cleaned, targetRate), keepRatio }
  } finally {
    ctx.close()
  }
}

// 녹음 blob을 서버에 올려 refer_wav_path(서버 로컬 경로)로 바꾼다. GPT-SoVITS는 blob이 아닌
// 파일 경로만 받으므로 이 업로드 단계가 즉석 클로닝의 핵심이다.
// 서버에 ffmpeg가 없어 webm/opus를 못 읽으므로(NoBackendError), 브라우저에서 WAV로 변환해 올린다.
// keepRatio: 참조 오디오가 트림된 비율(prompt_text를 같은 비율로 줄이는 데 사용). wav 직접 입력은 1.
async function uploadRefBlob(blob: Blob): Promise<{ refPath: string; keepRatio: number }> {
  const { wav, keepRatio } = blob.type.includes('wav')
    ? { wav: blob, keepRatio: 1 }
    : await blobToWav16k(blob)
  const form = new FormData()
  form.append('file', wav, 'ref.wav')
  const res = await fetch(GPT_SOVITS_UPLOAD_REF, { method: 'POST', body: form, signal: ttsSignal() })
  if (!res.ok) throw new Error(`GPT-SoVITS upload_ref ${res.status}: ${await res.text()}`)
  const data = await res.json()
  if (!data?.refer_wav_path) throw new Error('GPT-SoVITS upload_ref: no refer_wav_path in response')
  return { refPath: data.refer_wav_path as string, keepRatio }
}

// 참조 오디오를 keepRatio로 잘랐으면 prompt_text도 같은 비율(앞부분)만 취해 오디오↔대사 길이를
// 맞춘다. 오디오는 짧은데 대사가 길거나 그 반대면 합성이 붕괴/과장된다(실측). 어절 경계로 자른다.
function truncatePromptText(text: string, keepRatio: number): string {
  if (keepRatio >= 0.98) return text
  const target = Math.max(1, Math.round(text.length * keepRatio))
  const head = text.slice(0, target)
  // 마지막 공백까지만 취해 단어 중간에서 끊기지 않게(단, 공백이 없으면 그대로).
  const lastSpace = head.lastIndexOf(' ')
  return (lastSpace > target * 0.5 ? head.slice(0, lastSpace) : head).trim() || text
}

// 이번 합성에 쓸 참조(경로 + 대사)를 정한다.
// 1순위: 이번 세션에 녹음된 "방금 말한 목소리"(즉석 클로닝) → 업로드해서 경로 확보.
// 폴백: endpoints.ts의 고정 참조(새로고침 등으로 세션 참조가 없을 때).
// 업로드 실패해도 합성 자체는 고정 참조로 진행되도록 방어한다.
async function resolveGptSovitsRef(): Promise<{ refPath: string; promptText: string }> {
  const voiceRef = getVoiceRef()
  if (voiceRef && voiceRef.blob.size > 0 && voiceRef.text.trim()) {
    try {
      const { refPath, keepRatio } = await uploadRefBlob(voiceRef.blob)
      return { refPath, promptText: truncatePromptText(voiceRef.text.trim(), keepRatio) }
    } catch (e) {
      console.warn('[tts] 즉석 참조 업로드 실패 → 고정 참조로 폴백', e)
    }
  }
  return { refPath: GPT_SOVITS_REF_WAV_PATH, promptText: GPT_SOVITS_REF_PROMPT_TEXT }
}

// GPT-SoVITS 로컬 서버(:9880) 본인 목소리 클로닝. 참조 wav(사용자 목소리) 경로 + 그 wav의
// 실제 대사(prompt_text)를 함께 넘겨 zero-shot 합성. 참조는 즉석(방금 녹음)이 있으면 그것을,
// 없으면 고정 참조를 쓴다. 파라미터는 Phase 0에서 청취로 확정한 값(A: top_k=15/top_p=0.6/temp=0.5).
// dev 전용 — Vite 프록시(/gpt-sovits)가 :9880으로 CORS 우회. prod엔 로컬 서버 없음.
//
// cut_punc: 이 api.py는 넘긴 구두점에서 텍스트를 문장 단위로 쪼개 순차 합성한다. 비우면
// 긴 대본을 통째로 모델에 넣어 앞 ~10초만 합성되고 잘리므로, 문장 종결 부호를 지정해
// 대본 전체가 합성되도록 한다. (text_split_method=cut0은 이 버전이 인식 못 하는 파라미터)
async function ttsGptSovits(text: string): Promise<TTSResult> {
  const lang = detectTtsLang(text)
  const { refPath, promptText } = await resolveGptSovitsRef()
  const params = new URLSearchParams({
    text,
    text_language: lang,
    refer_wav_path: refPath,
    prompt_text: promptText,
    prompt_language: 'ko',
    top_k: '15',
    top_p: '0.6',
    temperature: '0.5',
    cut_punc: '.!?。！？…',
  })
  // 서버 미기동/다운이 가장 흔한 실패. fetch는 TypeError(Failed to fetch), 프록시는 502를 낸다.
  // 둘 다 원인이 같으므로("start gs"로 서버가 안 떠 있음) 명확한 안내로 바꾼다.
  const serverDownMsg =
    'GPT-SoVITS 로컬 서버(:9880)에 연결하지 못했어요. 새 PowerShell 창에서 "start gs"로 서버를 먼저 켜주세요.'
  let res: Response
  try {
    res = await fetch(`${GPT_SOVITS_BASE}/?${params.toString()}`, { signal: ttsSignal() })
  } catch (e) {
    if (e instanceof TypeError) throw new Error(serverDownMsg)
    throw e
  }
  if (res.status === 502 || res.status === 503 || res.status === 504) throw new Error(serverDownMsg)
  if (!res.ok) throw new Error(`GPT-SoVITS TTS ${res.status}: ${await res.text()}`)
  const ct = res.headers.get('Content-Type') ?? ''
  if (!ct.includes('audio')) throw new Error(`GPT-SoVITS TTS non-audio response: ${await res.text()}`)
  const blob = await res.blob()
  const duration = await getBlobDuration(blob)
  return { blob, duration }
}

export async function generateTTS(
  text: string,
  config: ModelConfig,
  keys: ApiKeys
): Promise<TTSResult> {
  const { provider, model, voice } = config.tts
  if (provider === 'google') return ttsGoogle(text, model, voice, keys.google)
  if (provider === 'elevenlabs') return ttsElevenLabs(text, model, voice, keys.elevenlabs)
  if (provider === 'gpt-sovits') return ttsGptSovits(text)
  if (provider === 'local-kokoro') return ttsLocal(text)
  throw new Error(`Unknown TTS provider: ${provider}`)
}
