import sampleImg from '../assets/sample.jpg'

export const DUMMY_TEXT = '다낭 해변에서 노을을 봤다'
export const DUMMY_TTS_TEXT = '황금빛 노을이 물드는 다낭의 바다, 그 순간 나는 세상의 끝에 서 있는 것 같았다.'
export const DUMMY_IMAGE_PROMPT =
  'Golden sunset over Da Nang beach Vietnam, cinematic painterly warm tones, ocean waves, dreamlike nostalgic memory atmosphere, soft bokeh, wide angle'
export const DUMMY_AUDIO_KEYWORD = 'ocean'
export const DUMMY_LLM_RESULT = {
  refinedText: DUMMY_TTS_TEXT,
  imagePrompt: DUMMY_IMAGE_PROMPT,
  audioKeyword: DUMMY_AUDIO_KEYWORD,
}

// Minimal PCM WAV of silence
export function getDummyAudio(durationSec = 5): Blob {
  const sampleRate = 22050
  const numSamples = sampleRate * durationSec
  const buf = new ArrayBuffer(44 + numSamples * 2)
  const v = new DataView(buf)
  const s = (o: number, t: string) => { for (let i = 0; i < t.length; i++) v.setUint8(o + i, t.charCodeAt(i)) }
  s(0, 'RIFF'); v.setUint32(4, 36 + numSamples * 2, true)
  s(8, 'WAVE'); s(12, 'fmt ')
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true)
  v.setUint32(24, sampleRate, true); v.setUint32(28, sampleRate * 2, true)
  v.setUint16(32, 2, true); v.setUint16(34, 16, true)
  s(36, 'data'); v.setUint32(40, numSamples * 2, true)
  return new Blob([buf], { type: 'audio/wav' })
}

const AUTO_ANSWER_KEY = 'memory_debug_auto_answer'
const DUMMY_IMAGE_KEY = 'memory_debug_dummy_image'

function readFlag(key: string): boolean {
  const v = localStorage.getItem(key)
  return v === null ? false : v === 'true' // default OFF
}

export function isAutoAnswerMode(): boolean {
  return readFlag(AUTO_ANSWER_KEY)
}

export function setAutoAnswerMode(on: boolean) {
  localStorage.setItem(AUTO_ANSWER_KEY, on ? 'true' : 'false')
}

export function isDummyImageMode(): boolean {
  return readFlag(DUMMY_IMAGE_KEY)
}

export function setDummyImageMode(on: boolean) {
  localStorage.setItem(DUMMY_IMAGE_KEY, on ? 'true' : 'false')
}

export async function getDummyImage(): Promise<Blob> {
  const res = await fetch(sampleImg)
  return res.blob()
}

