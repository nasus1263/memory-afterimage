import type { ApiKeys, ModelConfig, TTSAlignment } from '../types'
import {
  GOOGLE_BASE, ELEVENLABS_BASE,
  GPT_SOVITS_BASE, GPT_SOVITS_REF_WAV_PATH, GPT_SOVITS_REF_PROMPT_TEXT,
} from '../config/endpoints'

export interface TTSResult {
  blob: Blob
  duration: number
  alignment?: TTSAlignment
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

// GPT-SoVITS 로컬 서버(:9880) 본인 목소리 클로닝. 고정 참조 wav(사용자 목소리) 경로 + 그
// wav의 실제 대사(prompt_text)를 함께 넘겨 zero-shot 합성. 파라미터는 Phase 0에서 청취로
// 확정한 값(A: top_k=15/top_p=0.6/temperature=0.5).
// dev 전용 — Vite 프록시(/gpt-sovits)가 :9880으로 CORS 우회. prod엔 로컬 서버 없음.
//
// cut_punc: 이 api.py는 넘긴 구두점에서 텍스트를 문장 단위로 쪼개 순차 합성한다. 비우면
// 긴 대본을 통째로 모델에 넣어 앞 ~10초만 합성되고 잘리므로, 문장 종결 부호를 지정해
// 대본 전체가 합성되도록 한다. (text_split_method=cut0은 이 버전이 인식 못 하는 파라미터)
async function ttsGptSovits(text: string): Promise<TTSResult> {
  const lang = detectTtsLang(text)
  const params = new URLSearchParams({
    text,
    text_language: lang,
    refer_wav_path: GPT_SOVITS_REF_WAV_PATH,
    prompt_text: GPT_SOVITS_REF_PROMPT_TEXT,
    prompt_language: 'ko',
    top_k: '15',
    top_p: '0.6',
    temperature: '0.5',
    cut_punc: '.!?。！？…',
  })
  const res = await fetch(`${GPT_SOVITS_BASE}/?${params.toString()}`)
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
