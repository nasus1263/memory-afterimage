import type { ApiKeys, ModelConfig } from '../types'
import { isDebugMode, getDummyVideo } from './debug'

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve((reader.result as string).split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

async function falPoll(model: string, requestId: string, key: string, onProgress?: (msg: string) => void): Promise<Blob> {
  const startTime = Date.now()
  for (let i = 0; i < 90; i++) {
    await new Promise((r) => setTimeout(r, 3000))
    const elapsed = Math.round((Date.now() - startTime) / 1000)
    onProgress?.(`처리 중... ${elapsed}s`)
    const res = await fetch(`https://queue.fal.run/${model}/requests/${requestId}`, {
      headers: { Authorization: `Key ${key}` },
    })
    if (!res.ok) continue
    const result = await res.json()
    if (result.status === 'COMPLETED') {
      onProgress?.('비디오 다운로드...')
      const vidUrl = result.output?.video?.url ?? result.output?.videos?.[0]?.url
      if (!vidUrl) throw new Error('No video URL in fal.ai response')
      const vidRes = await fetch(vidUrl)
      return vidRes.blob()
    }
    if (result.status === 'FAILED') throw new Error(`fal.ai failed: ${result.error}`)
  }
  throw new Error('fal.ai video generation timed out')
}

async function vidFal(imageBlob: Blob, model: string, key: string, imagePrompt: string, onProgress?: (msg: string) => void): Promise<Blob> {
  const b64 = await blobToBase64(imageBlob)
  const mimeType = imageBlob.type || 'image/png'
  const imageUrl = `data:${mimeType};base64,${b64}`

  onProgress?.('fal.ai 큐 제출...')
  const submitRes = await fetch(`https://queue.fal.run/${model}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Key ${key}` },
    body: JSON.stringify({
      image_url: imageUrl,
      prompt: `${imagePrompt} cinematic ambient gentle motion dreamlike`,
      duration: '5',
      aspect_ratio: '16:9',
    }),
  })
  if (!submitRes.ok) throw new Error(`fal.ai submit error: ${submitRes.status} ${await submitRes.text()}`)
  const { request_id } = await submitRes.json()
  return falPoll(model, request_id, key, onProgress)
}

async function vidReplicate(imageBlob: Blob, model: string, key: string, onProgress?: (msg: string) => void): Promise<Blob> {
  const b64 = await blobToBase64(imageBlob)
  const imageUrl = `data:${imageBlob.type || 'image/png'};base64,${b64}`

  onProgress?.('Replicate 예측 생성...')
  const res = await fetch('https://api.replicate.com/v1/predictions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      version: model,
      input: { image: imageUrl, num_frames: 25, motion_bucket_id: 127 },
    }),
  })
  if (!res.ok) throw new Error(`Replicate submit error: ${res.status}`)
  const prediction = await res.json()

  const startTime = Date.now()
  for (let i = 0; i < 90; i++) {
    await new Promise((r) => setTimeout(r, 3000))
    const elapsed = Math.round((Date.now() - startTime) / 1000)
    onProgress?.(`처리 중... ${elapsed}s`)
    const statusRes = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
      headers: { Authorization: `Bearer ${key}` },
    })
    const result = await statusRes.json()
    if (result.status === 'succeeded') {
      onProgress?.('비디오 다운로드...')
      const vidRes = await fetch(result.output)
      return vidRes.blob()
    }
    if (result.status === 'failed') throw new Error(`Replicate failed: ${result.error}`)
  }
  throw new Error('Replicate video generation timed out')
}

async function vidGoogle(imageBlob: Blob, model: string, key: string, imagePrompt: string, onProgress?: (msg: string) => void): Promise<Blob> {
  const b64 = await blobToBase64(imageBlob)

  onProgress?.('Google Veo 요청 전송...')
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}-generate-preview:generateVideo?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: `${imagePrompt} cinematic ambient motion` },
            { inlineData: { mimeType: imageBlob.type || 'image/png', data: b64 } },
          ],
        }],
        generationConfig: { durationSeconds: 8, aspectRatio: '16:9' },
      }),
    }
  )
  if (!res.ok) throw new Error(`Google Veo submit error: ${res.status} ${await res.text()}`)
  const opData = await res.json()
  const opName = opData.name

  const startTime = Date.now()
  for (let i = 0; i < 90; i++) {
    await new Promise((r) => setTimeout(r, 5000))
    const elapsed = Math.round((Date.now() - startTime) / 1000)
    onProgress?.(`생성 대기... ${elapsed}s`)
    const opRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/${opName}?key=${key}`
    )
    const op = await opRes.json()
    if (op.done) {
      onProgress?.('비디오 디코딩...')
      const vidB64 = op.response?.videos?.[0]?.video?.videoBytes
      if (!vidB64) throw new Error('No video bytes in Google Veo response')
      const bytes = Uint8Array.from(atob(vidB64), (c) => c.charCodeAt(0))
      return new Blob([bytes], { type: 'video/mp4' })
    }
    if (op.error) throw new Error(`Google Veo error: ${op.error.message}`)
  }
  throw new Error('Google Veo timed out')
}

export async function generateVideo(
  imageBlob: Blob,
  imagePrompt: string,
  config: ModelConfig,
  keys: ApiKeys,
  onProgress?: (msg: string) => void
): Promise<Blob> {
  if (isDebugMode()) return getDummyVideo()
  const { provider, model } = config.video
  if (provider === 'fal') return vidFal(imageBlob, model, keys.fal, imagePrompt, onProgress)
  if (provider === 'replicate') return vidReplicate(imageBlob, model, keys.replicate, onProgress)
  if (provider === 'google') return vidGoogle(imageBlob, model, keys.google, imagePrompt, onProgress)
  throw new Error(`Unknown video provider: ${provider}`)
}
