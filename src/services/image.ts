import type { ApiKeys, ModelConfig } from '../types'
import { isDebugMode, getDummyImage } from './debug'
import { OPENAI_BASE, GOOGLE_BASE, HUGGINGFACE_BASE, FAL_QUEUE_BASE, NVIDIA_GENAI_BASE } from '../config/endpoints'

async function imageOpenAI(prompt: string, key: string, onProgress?: (msg: string) => void): Promise<Blob> {
  onProgress?.('DALL-E 3 요청 전송...')
  const res = await fetch(`${OPENAI_BASE}/images/generations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: 'dall-e-3',
      prompt,
      n: 1,
      size: '1792x1024',
      response_format: 'b64_json',
    }),
  })
  if (!res.ok) throw new Error(`OpenAI Image error: ${res.status}`)
  onProgress?.('이미지 디코딩...')
  const data = await res.json()
  const bytes = Uint8Array.from(atob(data.data[0].b64_json), (c) => c.charCodeAt(0))
  return new Blob([bytes], { type: 'image/png' })
}

async function imageGoogle(prompt: string, model: string, key: string, onProgress?: (msg: string) => void): Promise<Blob> {
  // Gemini native image generation (gemini-2.0-flash-exp etc.)
  if (model.startsWith('gemini-')) {
    onProgress?.('Gemini 이미지 생성 요청...')
    const res = await fetch(
      `${GOOGLE_BASE}/models/${model}:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseModalities: ['IMAGE', 'TEXT'] },
        }),
      }
    )
    if (!res.ok) throw new Error(`Google Gemini Image error: ${res.status} ${await res.text()}`)
    onProgress?.('이미지 디코딩...')
    const data = await res.json()
    const part = data.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData)
    if (!part?.inlineData) throw new Error('No image in Gemini response')
    const bytes = Uint8Array.from(atob(part.inlineData.data), (c) => c.charCodeAt(0))
    return new Blob([bytes], { type: part.inlineData.mimeType || 'image/png' })
  }

  // Imagen 4 (deprecated 2026-06-24 — may return 404)
  onProgress?.('Imagen 요청 전송...')
  const res = await fetch(
    `${GOOGLE_BASE}/models/${model}:predict?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instances: [{ prompt }],
        parameters: { sampleCount: 1, aspectRatio: '16:9' },
      }),
    }
  )
  if (!res.ok) throw new Error(`Google Imagen error: ${res.status} ${await res.text()}`)
  const data = await res.json()
  const b64 = data.predictions?.[0]?.bytesBase64Encoded
  if (!b64) throw new Error('No image data in Imagen response')
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
  return new Blob([bytes], { type: 'image/png' })
}

async function imageHuggingFace(prompt: string, model: string, key: string, onProgress?: (msg: string) => void): Promise<Blob> {
  onProgress?.('HuggingFace 추론 API 요청...')
  const res = await fetch(`${HUGGINGFACE_BASE}/${model}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(key ? { Authorization: `Bearer ${key}` } : {}),
    },
    body: JSON.stringify({ inputs: prompt }),
  })
  if (!res.ok) throw new Error(`HuggingFace Image error: ${res.status}`)
  onProgress?.('이미지 수신 중...')
  return res.blob()
}

async function imageFal(prompt: string, model: string, key: string, onProgress?: (msg: string) => void): Promise<Blob> {
  onProgress?.('fal.ai 큐 제출...')
  const submitRes = await fetch(`${FAL_QUEUE_BASE}/${model}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Key ${key}` },
    body: JSON.stringify({ prompt }),
  })
  if (!submitRes.ok) throw new Error(`fal.ai submit error: ${submitRes.status}`)
  const { request_id } = await submitRes.json()

  const startTime = Date.now()
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 2000))
    const elapsed = Math.round((Date.now() - startTime) / 1000)
    onProgress?.(`처리 중... ${elapsed}s`)
    const statusRes = await fetch(`${FAL_QUEUE_BASE}/${model}/requests/${request_id}`, {
      headers: { Authorization: `Key ${key}` },
    })
    if (!statusRes.ok) continue
    const result = await statusRes.json()
    if (result.status === 'COMPLETED') {
      onProgress?.('이미지 다운로드...')
      const imageUrl = result.output?.images?.[0]?.url ?? result.output?.image?.url
      if (!imageUrl) throw new Error('No image URL in fal.ai response')
      const imgRes = await fetch(imageUrl)
      return imgRes.blob()
    }
    if (result.status === 'FAILED') throw new Error(`fal.ai failed: ${result.error}`)
  }
  throw new Error('fal.ai image generation timed out')
}

async function imageNvidia(prompt: string, _model: string, key: string, onProgress?: (msg: string) => void): Promise<Blob> {
  // 확인된 hosted 엔드포인트로 고정 — 다른 모델(qwen/qwen-image 등)은 이 경로에서 404
  const model = 'black-forest-labs/flux.1-dev'
  onProgress?.('NVIDIA NIM 이미지 생성 요청...')
  const res = await fetch(`${NVIDIA_GENAI_BASE}/v1/genai/${model}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      prompt,
      mode: 'base',
      cfg_scale: 5,
      width: 1344,
      height: 768,
      samples: 1,
      seed: 0,
      steps: 50,
    }),
  })
  if (!res.ok) throw new Error(`NVIDIA NIM Image error: ${res.status} ${await res.text()}`)
  onProgress?.('이미지 디코딩...')
  const data = await res.json()
  const b64 = data.artifacts?.[0]?.base64
  if (!b64) throw new Error('No image data in NVIDIA NIM response')
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
  return new Blob([bytes], { type: 'image/png' })
}

export async function generateImage(
  prompt: string,
  config: ModelConfig,
  keys: ApiKeys,
  onProgress?: (msg: string) => void
): Promise<Blob> {
  if (isDebugMode()) return getDummyImage()
  const { provider, model } = config.image
  if (provider === 'openai') return imageOpenAI(prompt, keys.openai, onProgress)
  if (provider === 'google') return imageGoogle(prompt, model, keys.google, onProgress)
  if (provider === 'huggingface') return imageHuggingFace(prompt, model, keys.huggingface, onProgress)
  if (provider === 'fal') return imageFal(prompt, model, keys.fal, onProgress)
  if (provider === 'nvidia') return imageNvidia(prompt, model, keys.nvidia, onProgress)
  throw new Error(`Unknown image provider: ${provider}`)
}

export async function generateImages(
  prompts: string[],
  config: ModelConfig,
  keys: ApiKeys,
  onProgress?: (msg: string) => void
): Promise<Blob[]> {
  const blobs: Blob[] = []
  for (let i = 0; i < prompts.length; i++) {
    const blob = await generateImage(prompts[i], config, keys, (msg) => onProgress?.(`(${i + 1}/${prompts.length}) ${msg}`))
    blobs.push(blob)
  }
  return blobs
}
