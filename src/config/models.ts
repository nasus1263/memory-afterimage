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
    { id: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash ✓무료 15RPM/1500RPD' },
    { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash ✓무료 10RPM/1500RPD' },
    { id: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite ✓무료·최속' },
    { id: 'gemini-3.1-pro', label: 'Gemini 3.1 Pro 유료·최고품질' },
  ],
  // NVIDIA NIM: integrate.api.nvidia.com/v1, OpenAI-compatible, nvapi-* key
  // 무료: 1000 크레딧 / 40 RPM (build.nvidia.com 무료 계정)
  nvidia: [
    { id: 'deepseek-ai/deepseek-v4-pro', label: 'DeepSeek V4 Pro ✓무료크레딧·최신·최고품질' },
    { id: 'nvidia/llama-3.3-nemotron-super-49b-v1', label: 'Nemotron-Super 49B ✓무료크레딧·NVIDIA 플래그십' },
    { id: 'meta/llama-3.3-70b-instruct', label: 'Llama 3.3 70B Instruct ✓무료크레딧·고품질' },
    { id: 'meta/llama-3.1-8b-instruct', label: 'Llama 3.1 8B Instruct ✓무료크레딧·최속' },
    { id: 'deepseek-ai/deepseek-r1', label: 'DeepSeek R1 ✓무료크레딧·추론특화(크레딧 소모大)' },
  ],
}

export const TTS_MODELS = {
  'local-kokoro': [
    { id: 'local', label: '브라우저 Web Speech API ✓무료·오프라인 (녹음 불가 — 음성은 스피커 재생)' },
  ],
  openai: [
    { id: 'tts-1', label: 'TTS-1 (빠름)' },
    { id: 'tts-1-hd', label: 'TTS-1 HD (고품질)' },
  ],
  google: [
    { id: 'gemini-3.1-flash-tts-preview', label: 'Gemini 3.1 Flash TTS ✓무료(preview)' },
    { id: 'gemini-2.5-flash-preview-tts', label: 'Gemini 2.5 Flash TTS 유료 $0.30/M' },
  ],
}

export const TTS_VOICES = {
  openai: ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'],
  google: ['Aoede', 'Charon', 'Fenrir', 'Kore', 'Puck'],
  'local-kokoro': [],
}

export const IMAGE_MODELS = {
  openai: [
    { id: 'dall-e-3', label: 'DALL-E 3' },
  ],
  google: [
    // Imagen 4 deprecated 2026-06-24 → 대체: Gemini image generation
    { id: 'gemini-2.0-flash-exp', label: 'Gemini 2.0 Flash Image ✓무료(free tier)' },
    { id: 'imagen-4-fast', label: 'Imagen 4 Fast ⚠deprecated 2026-06-24 / 2 IPM' },
    { id: 'imagen-4-ultra', label: 'Imagen 4 Ultra ⚠deprecated 2026-06-24' },
  ],
  huggingface: [
    { id: 'black-forest-labs/FLUX.1-schnell', label: 'FLUX.1 Schnell ✓무료(rate-limited)' },
    { id: 'stabilityai/stable-diffusion-xl-base-1.0', label: 'SDXL ✓무료(rate-limited)' },
  ],
  fal: [
    { id: 'fal-ai/flux-pro', label: 'FLUX Pro ($20 크레딧)' },
    { id: 'fal-ai/flux/dev', label: 'FLUX Dev ($20 크레딧)' },
    { id: 'fal-ai/flux/schnell', label: 'FLUX Schnell ($20 크레딧)' },
  ],
  // NVIDIA NIM: integrate.api.nvidia.com/v1/images/generations, OpenAI-compatible
  // 무료: 1000 크레딧 / 40 RPM (build.nvidia.com 무료 계정)
  nvidia: [
    { id: 'black-forest-labs/flux.1-schnell', label: 'FLUX.1 Schnell ✓무료크레딧·최속' },
    { id: 'black-forest-labs/flux.1-dev', label: 'FLUX.1 Dev ✓무료크레딧·고품질' },
    { id: 'qwen/qwen-image', label: 'Qwen Image 20B ✓무료크레딧·텍스트렌더링강점' },
  ],
}

export const VIDEO_MODELS = {
  google: [
    { id: 'veo-3.1', label: 'Veo 3.1 유료 ~$0.50/5s' },
    { id: 'veo-3.1-lite', label: 'Veo 3.1 Lite 유료 (저렴)' },
    { id: 'veo-3', label: 'Veo 3 유료' },
  ],
  fal: [
    { id: 'fal-ai/wan/i2v-14b', label: 'Wan 2.2 I2V ($20 크레딧·Apache 2.0)' },
    { id: 'fal-ai/ltx-video/image-to-video', label: 'LTX-Video ($20 크레딧·빠름)' },
  ],
  replicate: [
    { id: 'stability-ai/stable-video-diffusion', label: 'SVD on Replicate (신규계정 무료예측 한도)' },
    { id: 'lightricks/ltx-video', label: 'LTX-Video on Replicate' },
  ],
}

// Default: 무료 경로만 사용
export const DEFAULT_CONFIG = {
  llm: { provider: 'google' as const, model: 'gemini-2.5-flash' },
  tts: { provider: 'google' as const, model: 'gemini-3.1-flash-tts-preview', voice: 'Aoede' },
  image: { provider: 'nvidia' as const, model: 'black-forest-labs/flux.1-dev' },
  video: { provider: 'fal' as const, model: 'fal-ai/ltx-video/image-to-video' },
  audio: { provider: 'freesound' as const },
}
