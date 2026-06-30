import type { ApiKeys, ModelConfig } from '../types'

async function searchFreesound(keywords: string[], key: string): Promise<Blob> {
  const query = keywords.join(' ')
  const res = await fetch(
    `https://freesound.org/apiv2/search/text/?query=${encodeURIComponent(query)}&fields=id,name,previews&filter=duration:[5 TO 120]&page_size=5&token=${key}`
  )
  if (!res.ok) throw new Error(`Freesound search error: ${res.status}`)
  const data = await res.json()
  if (!data.results?.length) throw new Error('No Freesound results')

  const sound = data.results[0]
  const previewUrl = sound.previews?.['preview-hq-mp3'] ?? sound.previews?.['preview-lq-mp3']
  if (!previewUrl) throw new Error('No Freesound preview URL')

  // Freesound previews require auth token in URL
  const audioRes = await fetch(`${previewUrl}?token=${key}`)
  if (!audioRes.ok) throw new Error(`Freesound download error: ${audioRes.status}`)
  return audioRes.blob()
}

async function searchPixabay(keywords: string[], key: string): Promise<Blob> {
  const query = keywords.slice(0, 2).join(' ')
  const res = await fetch(
    `https://pixabay.com/api/music/?key=${key}&q=${encodeURIComponent(query)}&order=popular`
  )
  if (!res.ok) throw new Error(`Pixabay search error: ${res.status}`)
  const data = await res.json()
  if (!data.hits?.length) throw new Error('No Pixabay results')

  // Pixabay music hits have audio URL
  const hit = data.hits[0]
  const audioUrl = hit.audio ?? hit.downloads?.mp3
  if (!audioUrl) throw new Error('No Pixabay audio URL')

  const audioRes = await fetch(audioUrl)
  if (!audioRes.ok) throw new Error(`Pixabay download error: ${audioRes.status}`)
  return audioRes.blob()
}

export async function fetchAmbientAudio(
  keywords: string[],
  config: ModelConfig,
  keys: ApiKeys
): Promise<Blob | null> {
  const { provider } = config.audio
  try {
    if (provider === 'freesound') {
      if (!keys.freesound) throw new Error('Freesound API key missing')
      return await searchFreesound(keywords, keys.freesound)
    }
    if (provider === 'pixabay') {
      if (!keys.pixabay) throw new Error('Pixabay API key missing')
      return await searchPixabay(keywords, keys.pixabay)
    }
  } catch (e) {
    console.warn('Ambient audio fetch failed, continuing without:', e)
    return null
  }
  return null
}
