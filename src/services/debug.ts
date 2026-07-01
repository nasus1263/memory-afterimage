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

const KEY = 'memory_debug_mode'

export function isDebugMode(): boolean {
  const v = localStorage.getItem(KEY)
  return v === null ? false : v === 'true' // default OFF
}

export function setDebugMode(on: boolean) {
  localStorage.setItem(KEY, on ? 'true' : 'false')
}

export function getDummyImage(): Promise<Blob> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas')
    canvas.width = 1024; canvas.height = 576
    const ctx = canvas.getContext('2d')!

    const g = ctx.createLinearGradient(0, 0, 1024, 576)
    g.addColorStop(0, '#1a0a2e')
    g.addColorStop(0.5, '#2d1b4e')
    g.addColorStop(1, '#0d1a2e')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 1024, 576)

    // Subtle radial glow
    const radial = ctx.createRadialGradient(512, 288, 0, 512, 288, 400)
    radial.addColorStop(0, 'rgba(200, 169, 110, 0.25)')
    radial.addColorStop(1, 'transparent')
    ctx.fillStyle = radial
    ctx.fillRect(0, 0, 1024, 576)

    ctx.fillStyle = 'rgba(200, 169, 110, 0.85)'
    ctx.font = 'bold 40px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('[DEBUG] 더미 이미지', 512, 268)
    ctx.font = '22px sans-serif'
    ctx.fillStyle = 'rgba(255,255,255,0.35)'
    ctx.fillText('실제 API 호출 없음', 512, 316)

    canvas.toBlob((blob) => resolve(blob!), 'image/png')
  })
}

