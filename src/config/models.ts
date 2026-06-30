export const LLM_MODELS = {
  openai: [
    { id: 'gpt-4o', label: 'GPT-4o' },
    { id: 'gpt-4o-mini', label: 'GPT-4o mini (저렴)' },
  ],
  anthropic: [
    { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
    { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5 (저렴)' },
  ],
  google: [
    { id: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash (무료)' },
    { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (무료)' },
    { id: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite (무료·최속)' },
    { id: 'gemini-3.1-pro', label: 'Gemini 3.1 Pro (유료·최고품질)' },
  ],
}

export const TTS_MODELS = {
  'local-kokoro': [
    { id: 'kokoro-82m', label: 'Kokoro 82M (로컬·무료·Apache 2.0)' },
  ],
  openai: [
    { id: 'tts-1', label: 'TTS-1 (빠름)' },
    { id: 'tts-1-hd', label: 'TTS-1 HD (고품질)' },
  ],
  google: [
    { id: 'gemini-3.1-flash-tts', label: 'Gemini 3.1 Flash TTS (최신)' },
    { id: 'gemini-2.5-flash-preview-tts', label: 'Gemini 2.5 Flash TTS' },
  ],
}

export const TTS_VOICES = {
  openai: ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'],
  google: ['Aoede', 'Charon', 'Fenrir', 'Kore', 'Puck'],
  'local-kokoro': ['af_heart', 'af_bella', 'am_adam', 'bf_emma', 'bm_george'],
}

export const IMAGE_MODELS = {
  openai: [
    { id: 'dall-e-3', label: 'DALL-E 3' },
  ],
  google: [
    { id: 'imagen-4-fast', label: 'Imagen 4 Fast (무료·빠름)' },
    { id: 'imagen-4', label: 'Imagen 4' },
    { id: 'imagen-4-ultra', label: 'Imagen 4 Ultra (최고품질)' },
  ],
  huggingface: [
    { id: 'black-forest-labs/FLUX.1-schnell', label: 'FLUX.1 Schnell (무료)' },
    { id: 'stabilityai/stable-diffusion-xl-base-1.0', label: 'SDXL (무료)' },
  ],
  fal: [
    { id: 'fal-ai/flux-pro', label: 'FLUX Pro (크레딧)' },
    { id: 'fal-ai/flux/dev', label: 'FLUX Dev (크레딧)' },
    { id: 'fal-ai/flux/schnell', label: 'FLUX Schnell (크레딧)' },
  ],
}

export const VIDEO_MODELS = {
  google: [
    { id: 'veo-3.1', label: 'Veo 3.1 (최신)' },
    { id: 'veo-3.1-lite', label: 'Veo 3.1 Lite (저렴)' },
    { id: 'veo-3', label: 'Veo 3' },
  ],
  fal: [
    { id: 'fal-ai/wan/i2v-14b', label: 'Wan 2.2 I2V (크레딧·Apache 2.0)' },
    { id: 'fal-ai/ltx-video/image-to-video', label: 'LTX-Video (크레딧·빠름)' },
  ],
  replicate: [
    { id: 'stability-ai/stable-video-diffusion', label: 'SVD (무료 predictions)' },
    { id: 'lightricks/ltx-video', label: 'LTX-Video on Replicate' },
  ],
}

export const DEFAULT_CONFIG = {
  llm: { provider: 'google' as const, model: 'gemini-2.5-flash' },
  tts: { provider: 'google' as const, model: 'gemini-2.5-flash-preview-tts', voice: 'Aoede' },
  image: { provider: 'google' as const, model: 'imagen-4-fast' },
  video: { provider: 'fal' as const, model: 'fal-ai/ltx-video/image-to-video' },
  audio: { provider: 'freesound' as const },
}
