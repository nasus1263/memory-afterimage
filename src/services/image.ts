import type { ApiKeys, ModelConfig } from '../types'
import { isDebugMode, getDummyImage } from './debug'

async function imageOpenAI(prompt: string, key: string): Promise<Blob> {
  const res = await fetch('https://api.openai.com/v1/images/generations', {
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
  const data = await res.json()
  const bytes = Uint8Array.from(atob(data.data[0].b64_json), (c) => c.charCodeAt(0))
  return new Blob([bytes], { type: 'image/png' })
}

async function imageGoogle(prompt: string, model: string, key: string): Promise<Blob> {
  // Gemini native image generation (gemini-2.0-flash-exp etc.)
  if (model.startsWith('gemini-')) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
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
    const data = await res.json()
    const part = data.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData)
    if (!part?.inlineData) throw new Error('No image in Gemini response')
    const bytes = Uint8Array.from(atob(part.inlineData.data), (c) => c.charCodeAt(0))
    return new Blob([bytes], { type: part.inlineData.mimeType || 'image/png' })
  }

  // Imagen 4 (deprecated 2026-06-24 — may return 404)
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:predict?key=${key}`,
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

async function imageHuggingFace(prompt: string, model: string, key: string): Promise<Blob> {
  const res = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(key ? { Authorization: `Bearer ${key}` } : {}),
    },
    body: JSON.stringify({ inputs: prompt }),
  })
  if (!res.ok) throw new Error(`HuggingFace Image error: ${res.status}`)
  return res.blob()
}

async function imageFal(prompt: string, model: string, key: string): Promise<Blob> {
  // Submit request
  const submitRes = await fetch(`https://queue.fal.run/${model}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Key ${key}` },
    body: JSON.stringify({ prompt }),
  })
  if (!submitRes.ok) throw new Error(`fal.ai submit error: ${submitRes.status}`)
  const { request_id } = await submitRes.json()

  // Poll for result
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 2000))
    const statusRes = await fetch(`https://queue.fal.run/${model}/requests/${request_id}`, {
      headers: { Authorization: `Key ${key}` },
    })
    if (!statusRes.ok) continue
    const result = await statusRes.json()
    if (result.status === 'COMPLETED') {
      const imageUrl = result.output?.images?.[0]?.url ?? result.output?.image?.url
      if (!imageUrl) throw new Error('No image URL in fal.ai response')
      const imgRes = await fetch(imageUrl)
      return imgRes.blob()
    }
    if (result.status === 'FAILED') throw new Error(`fal.ai failed: ${result.error}`)
  }
  throw new Error('fal.ai image generation timed out')
}

const NVIDIA_IMG_BASE = import.meta.env.DEV
  ? '/nvidia-nim/v1'
  : 'https://integrate.api.nvidia.com/v1'

async function imageNvidia(prompt: string, model: string, key: string): Promise<Blob> {
  const res = await fetch(`${NVIDIA_IMG_BASE}/images/generations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      prompt,
      n: 1,
      size: '1024x576',
      response_format: 'b64_json',
    }),
  })
  if (!res.ok) throw new Error(`NVIDIA NIM Image error: ${res.status} ${await res.text()}`)
  const data = await res.json()
  const b64 = data.data?.[0]?.b64_json
  if (!b64) throw new Error('No image data in NVIDIA NIM response')
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
  return new Blob([bytes], { type: 'image/png' })
}

export async function generateImage(
  prompt: string,
  config: ModelConfig,
  keys: ApiKeys
): Promise<Blob> {
  if (isDebugMode()) return getDummyImage()
  const { provider, model } = config.image
  if (provider === 'openai') return imageOpenAI(prompt, keys.openai)
  if (provider === 'google') return imageGoogle(prompt, model, keys.google)
  if (provider === 'huggingface') return imageHuggingFace(prompt, model, keys.huggingface)
  if (provider === 'fal') return imageFal(prompt, model, keys.fal)
  if (provider === 'nvidia') return imageNvidia(prompt, model, keys.nvidia)
  throw new Error(`Unknown image provider: ${provider}`)
}
