// SSOT: 모든 서비스 base URL

export const OPENAI_BASE = 'https://api.openai.com/v1'
export const ANTHROPIC_BASE = 'https://api.anthropic.com/v1'
export const GOOGLE_BASE = 'https://generativelanguage.googleapis.com/v1beta'
export const ELEVENLABS_BASE = 'https://api.elevenlabs.io/v1'
export const HUGGINGFACE_BASE = 'https://api-inference.huggingface.co/models'
export const FAL_QUEUE_BASE = 'https://queue.fal.run'
export const FREESOUND_BASE = 'https://freesound.org/apiv2'
export const JAMENDO_BASE = 'https://api.jamendo.com/v3.0'
export const FFMPEG_CORE_BASE = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm'

// NVIDIA NIM: dev는 Vite 프록시(vite.config.ts), prod는 Cloudflare Worker 프록시(../nim-proxy) 경유 — NIM이 CORS 헤더 미제공
const NIM_PROXY_ORIGIN = 'https://nim-proxy.dlsehf1263.workers.dev'
export const NVIDIA_LLM_BASE = import.meta.env.DEV ? '/nvidia-nim/v1' : `${NIM_PROXY_ORIGIN}/nvidia-nim/v1`
