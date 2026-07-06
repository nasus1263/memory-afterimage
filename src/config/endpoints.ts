// SSOT: 모든 서비스 base URL

export const GOOGLE_BASE = 'https://generativelanguage.googleapis.com/v1beta'
export const ELEVENLABS_BASE = 'https://api.elevenlabs.io/v1'
export const FREESOUND_BASE = 'https://freesound.org/apiv2'
export const FFMPEG_CORE_BASE = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm'

// NVIDIA NIM: dev는 Vite 프록시(vite.config.ts), prod는 Cloudflare Worker 프록시(../nim-proxy) 경유 — NIM이 CORS 헤더 미제공
const NIM_PROXY_ORIGIN = import.meta.env.DEV ? '' : 'https://nim-proxy.dlsehf1263.workers.dev'
export const NVIDIA_LLM_BASE = `${NIM_PROXY_ORIGIN}/nvidia-nim/v1`
export const NVIDIA_GENAI_BASE = `${NIM_PROXY_ORIGIN}/nvidia-genai`
