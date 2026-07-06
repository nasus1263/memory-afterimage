import type { ApiKeys, ModelConfig } from '../types'
import { isDummyImageMode, getDummyImage } from './debug'
import { GOOGLE_BASE, NVIDIA_GENAI_BASE } from '../config/endpoints'

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
      width: 768,
      height: 768,
      samples: 1,
      seed: 0,
      steps: 20,
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

async function imageRestApi(prompt: string, baseUrl: string, onProgress?: (msg: string) => void): Promise<Blob> {
  if (!baseUrl) throw new Error('REST API 서버 주소가 설정되지 않았습니다')
  const normalizedBase = /^https?:\/\//i.test(baseUrl) ? baseUrl : `http://${baseUrl}`
  onProgress?.('REST API 이미지 생성 요청...')
  const res = await fetch(`${normalizedBase.replace(/\/$/, '')}/generate`, {
    method: 'POST',
    signal: AbortSignal.timeout(130_000),
    headers: { 'Content-Type': 'application/json', 'X-API-Key': 'changeme' },
    body: JSON.stringify({ prompt, width: 720, height: 480, steps: 1 }),
  })
  if (!res.ok) {
    if (res.status === 401) throw new Error('REST API 이미지 서버 인증 실패 (X-API-Key 불일치)')
    if (res.status === 502) throw new Error('REST API 이미지 서버가 요청을 거부했습니다 (ComfyUI 오류)')
    if (res.status === 504) throw new Error('REST API 이미지 생성 시간 초과 (120초)')
    throw new Error(`REST API Image error: ${res.status}`)
  }
  onProgress?.('이미지 수신 중...')
  return res.blob()
}

export async function generateImage(
  prompt: string,
  config: ModelConfig,
  keys: ApiKeys,
  onProgress?: (msg: string) => void
): Promise<Blob> {
  if (isDummyImageMode()) return getDummyImage()
  const { provider, model } = config.image
  if (provider === 'google') return imageGoogle(prompt, model, keys.google, onProgress)
  if (provider === 'nvidia') return imageNvidia(prompt, model, keys.nvidia, onProgress)
  if (provider === 'restapi') return imageRestApi(prompt, keys.restapi, onProgress)
  throw new Error(`Unknown image provider: ${provider}`)
}

export async function generateImages(
  prompts: string[],
  config: ModelConfig,
  keys: ApiKeys,
  onProgress?: (index: number, msg: string) => void
): Promise<Blob[]> {
  return Promise.all(
    prompts.map((prompt, i) =>
      generateImage(prompt, config, keys, (msg) => onProgress?.(i, msg))
        .then((blob) => {
          onProgress?.(i, '완료')
          return blob
        })
    )
  )
}
