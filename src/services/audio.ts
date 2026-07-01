import type { ApiKeys, ModelConfig } from '../types'
import { FREESOUND_BASE, JAMENDO_BASE } from '../config/endpoints'
import { refineAudioKeywords } from './llm'

async function searchFreesound(keywords: string[], key: string): Promise<Blob> {
  const query = keywords.join(' ')
  const res = await fetch(
    `${FREESOUND_BASE}/search/text/?query=${encodeURIComponent(query)}&fields=id,name,previews&filter=duration:[10 TO 120]&page_size=5&token=${key}`
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

// Jamendo: free music API with ambient/soundtrack tracks
async function searchJamendo(keywords: string[], key: string): Promise<Blob> {
  const tags = keywords.join('+')
  const res = await fetch(
    `${JAMENDO_BASE}/tracks/?client_id=${key}&format=json&limit=5&tags=${encodeURIComponent(tags)}&audioformat=mp32&include=musicinfo&groupby=artist_id`
  )
  if (!res.ok) throw new Error(`Jamendo search error: ${res.status}`)
  const data = await res.json()
  if (!data.results?.length) throw new Error('No Jamendo results')

  const track = data.results[0]
  const audioUrl = track.audiodownload ?? track.audio
  if (!audioUrl) throw new Error('No Jamendo audio URL')

  const audioRes = await fetch(audioUrl)
  if (!audioRes.ok) throw new Error(`Jamendo download error: ${audioRes.status}`)
  return audioRes.blob()
}

export async function fetchAmbientAudio(
  keywords: string[],
  config: ModelConfig,
  keys: ApiKeys,
  onProgress?: (msg: string) => void
): Promise<Blob | null> {
  const { provider } = config.audio
  const keywordLabel = keywords.join(', ')
  console.log(`[audio] 검색 키워드: ${keywordLabel} (provider: ${provider})`)
  try {
    if (provider === 'freesound') {
      if (!keys.freesound) throw new Error('Freesound API key missing')
      onProgress?.(`Freesound 검색... (키워드: ${keywordLabel})`)
      const blob = await searchFreesound(keywords, keys.freesound)
      onProgress?.('오디오 다운로드 완료')
      return blob
    }
    if (provider === 'jamendo') {
      if (!keys.jamendo) throw new Error('Jamendo client_id missing')
      onProgress?.(`Jamendo 검색... (키워드: ${keywordLabel})`)
      const blob = await searchJamendo(keywords, keys.jamendo)
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
  initialKeywords: string[],
  config: ModelConfig,
  keys: ApiKeys,
  onProgress?: (msg: string) => void
): Promise<Blob | null> {
  let keywords = initialKeywords

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const blob = await fetchAmbientAudio(keywords, config, keys, onProgress)
    if (blob) return blob

    if (attempt === MAX_RETRIES) break

    onProgress?.(`검색 실패 (${attempt + 1}/${MAX_RETRIES}), 새 키워드 요청 중...`)
    try {
      keywords = await refineAudioKeywords(userText, config, keys)
    } catch (e) {
      console.warn('Audio keyword re-request failed:', e)
      break
    }
  }
  return null
}
