import type { ApiKeys, ModelConfig } from '../types'
import { OPENAI_BASE, GOOGLE_BASE, ELEVENLABS_BASE } from '../config/endpoints'

export interface TTSResult {
  blob: Blob
  duration: number
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

async function ttsOpenAI(text: string, model: string, voice: string, key: string): Promise<TTSResult> {
  const res = await fetch(`${OPENAI_BASE}/audio/speech`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, input: text, voice, response_format: 'mp3' }),
  })
  if (!res.ok) throw new Error(`OpenAI TTS error: ${res.status}`)
  const blob = await res.blob()
  const duration = await getBlobDuration(blob)
  return { blob, duration }
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

async function ttsElevenLabs(text: string, model: string, voice: string, key: string): Promise<TTSResult> {
  const res = await fetch(`${ELEVENLABS_BASE}/text-to-speech/${voice}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'xi-api-key': key },
    body: JSON.stringify({ text, model_id: model }),
  })
  if (!res.ok) throw new Error(`ElevenLabs TTS ${res.status}: ${await res.text()}`)
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
  if (provider === 'openai') return ttsOpenAI(text, model, voice, keys.openai)
  if (provider === 'google') return ttsGoogle(text, model, voice, keys.google)
  if (provider === 'elevenlabs') return ttsElevenLabs(text, model, voice, keys.elevenlabs)
  if (provider === 'local-kokoro') return ttsLocal(text)
  throw new Error(`Unknown TTS provider: ${provider}`)
}
