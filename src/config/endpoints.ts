// SSOT: 모든 서비스 base URL

export const GOOGLE_BASE = 'https://generativelanguage.googleapis.com/v1beta'
export const ELEVENLABS_BASE = 'https://api.elevenlabs.io/v1'
export const FREESOUND_BASE = 'https://freesound.org/apiv2'
export const FFMPEG_CORE_BASE = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm'

// NVIDIA NIM: dev는 Vite 프록시(vite.config.ts), prod는 Cloudflare Worker 프록시(../nim-proxy) 경유 — NIM이 CORS 헤더 미제공
const NIM_PROXY_ORIGIN = import.meta.env.DEV ? '' : 'https://nim-proxy.dlsehf1263.workers.dev'
export const NVIDIA_LLM_BASE = `${NIM_PROXY_ORIGIN}/nvidia-nim/v1`
export const NVIDIA_GENAI_BASE = `${NIM_PROXY_ORIGIN}/nvidia-genai`

// GPT-SoVITS 로컬 보이스 클로닝 서버(api.py, :9880). dev는 Vite 프록시(/gpt-sovits) 경유.
// prod(GitHub Pages)에는 로컬 서버가 없으므로 dev 전용 기능.
export const GPT_SOVITS_BASE = '/gpt-sovits'

// 고정 참조(사용자 목소리) — 서버 로컬 파일 경로 + 그 wav의 실제 대사(prompt_text).
// GPT-SoVITS는 refer_wav_path(서버가 읽는 경로)와 prompt_text가 한 쌍이어야 함.
// 다른 목소리로 바꾸려면: 새 wav를 아래 경로에 두고 REF_PROMPT_TEXT를 그 대사로 교체.
export const GPT_SOVITS_REF_WAV_PATH =
  'C:\\Users\\Jekey\\Downloads\\windows_voice_runtime\\windows_voice_runtime\\sources\\GPT-SoVITS\\ref\\user_voice.wav'
export const GPT_SOVITS_REF_PROMPT_TEXT = '안녕하세요, 오늘 날씨가 참 좋네요. 이건 제 목소리 테스트입니다.'
