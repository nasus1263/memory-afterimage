import type { ApiKeys, ModelConfig } from '../types'
import { FREESOUND_BASE } from '../config/endpoints'
import { refineAudioKeyword } from './llm'

async function searchFreesound(keyword: string, key: string): Promise<Blob> {
  const res = await fetch(
    `${FREESOUND_BASE}/search/text/?query=${encodeURIComponent(keyword)}&fields=id,name,previews&filter=duration:[10 TO 120]&page_size=5&token=${key}`
  )
  if (!res.ok) throw new Error(`Freesound search error: ${res.status}`)
  const data = await res.json()
  if (!data.results?.length) throw new Error('No Freesound results')

  const sound = data.results[0]
  const previewUrl = sound.previews?.['preview-hq-mp3'] ?? sound.previews?.['preview-lq-mp3']
  if (!previewUrl) throw new Error('No Freesound preview URL')

  const audioRes = await fetch(`${previewUrl}?token=${key}`)
  if (!audioRes.ok) throw new Error(`Freesound download error: ${audioRes.status}`)
  return audioRes.blob()
}

export async function fetchAmbientAudio(
  keyword: string,
  config: ModelConfig,
  keys: ApiKeys,
  onProgress?: (msg: string) => void
): Promise<Blob | null> {
  const { provider } = config.audio
  console.log(`[audio] 검색 키워드: ${keyword} (provider: ${provider})`)
  try {
    if (provider === 'freesound') {
      if (!keys.freesound) throw new Error('Freesound API key missing')
      onProgress?.(`Freesound 검색... (키워드: ${keyword})`)
      const blob = await searchFreesound(keyword, keys.freesound)
      onProgress?.('오디오 다운로드 완료')
      return blob
    }
  } catch (e) {
    console.warn('Ambient audio fetch failed, continuing without:', e)
    return null
  }
  return null
}

const MAX_RETRIES = 5

export async function fetchAmbientAudioWithRetry(
  userText: string,
  initialKeyword: string,
  config: ModelConfig,
  keys: ApiKeys,
  onProgress?: (msg: string) => void
): Promise<Blob | null> {
  let keyword = initialKeyword

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const blob = await fetchAmbientAudio(keyword, config, keys, onProgress)
    if (blob) return blob

    if (attempt === MAX_RETRIES) break

    onProgress?.(`검색 실패 (${attempt + 1}/${MAX_RETRIES}), 새 키워드 요청 중...`)
    try {
      keyword = await refineAudioKeyword(userText, config, keys)
    } catch (e) {
      console.warn('Audio keyword re-request failed:', e)
      break
    }
  }
  return null
}
