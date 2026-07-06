import { ELEVENLABS_BASE } from '../config/endpoints'

// /input, /chat의 고정 안내 문구를 읽어주는 음성. 동일 텍스트는 캐싱하여 재요청하지 않음.
const VOICE_ID = 'EXAVITQu4vr4xnSDxMaL'
const MODEL_ID = 'eleven_multilingual_v2'

const audioUrlCache = new Map<string, Promise<string>>()

function fetchElevenLabsAudioUrl(text: string, apiKey: string): Promise<string> {
  return fetch(`${ELEVENLABS_BASE}/text-to-speech/${VOICE_ID}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'xi-api-key': apiKey },
    body: JSON.stringify({ text, model_id: MODEL_ID }),
  }).then(async (res) => {
    if (!res.ok) throw new Error(`ElevenLabs TTS ${res.status}: ${await res.text()}`)
    const blob = await res.blob()
    return URL.createObjectURL(blob)
  })
}

function getElevenLabsAudioUrl(text: string, apiKey: string): Promise<string> {
  let entry = audioUrlCache.get(text)
  if (!entry) {
    entry = fetchElevenLabsAudioUrl(text, apiKey)
    entry.catch(() => audioUrlCache.delete(text))
    audioUrlCache.set(text, entry)
  }
  return entry
}

function speakBrowser(text: string, onEnd: () => void) {
  if (!('speechSynthesis' in window)) { onEnd(); return }
  window.speechSynthesis.cancel()
  const utter = new SpeechSynthesisUtterance(text)
  utter.lang = 'ko-KR'
  utter.onend = onEnd
  utter.onerror = onEnd
  window.speechSynthesis.speak(utter)
}

let currentAudio: HTMLAudioElement | null = null

export function stopSpeaking() {
  if (currentAudio) {
    currentAudio.pause()
    currentAudio.onended = null
    currentAudio.onerror = null
    currentAudio = null
  }
  if ('speechSynthesis' in window) window.speechSynthesis.cancel()
}

// ElevenLabs API 키가 있으면 그걸로 읽어주고, 없거나 요청 실패 시 브라우저 내장 TTS로 대체.
export async function speakText(text: string, apiKey: string | undefined, onEnd: () => void) {
  stopSpeaking()
  if (!apiKey) { speakBrowser(text, onEnd); return }
  try {
    const url = await getElevenLabsAudioUrl(text, apiKey)
    const audio = new Audio(url)
    currentAudio = audio
    audio.onended = onEnd
    audio.onerror = onEnd
    await audio.play()
  } catch {
    speakBrowser(text, onEnd)
  }
}
