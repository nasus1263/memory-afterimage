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
  // ElevenLabs: model_id + voice_id 분리. 무료 10K chars/월
  elevenlabs: [
    { id: 'eleven_multilingual_v2', label: 'Multilingual v2 (한국어 지원·고품질)' },
    { id: 'eleven_turbo_v2_5', label: 'Turbo v2.5 (저지연·저렴)' },
    { id: 'eleven_flash_v2_5', label: 'Flash v2.5 (최속·최저가)' },
  ],
}

export const TTS_VOICES: Record<string, string[]> = {
  openai: ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'],
  google: ['Aoede', 'Charon', 'Fenrir', 'Kore', 'Puck'],
  'local-kokoro': [],
  // ElevenLabs voice IDs — elevenslabs.io/voice-library 에서 추가 가능
  elevenlabs: [
    'JBFqnCBsd6RMkjVDRZzb',  // George
    'pNInz6obpgDQGcFmaJgB',  // Adam
    'EXAVITQu4vr4xnSDxMaL',  // Bella
  ],
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
  // 자체 호스팅 ComfyUI REST API 래퍼 — 모델 선택 없음, 서버 주소만 필요
  restapi: [
    { id: 'default', label: 'ComfyUI REST API (자체 호스팅)' },
  ],
}

// Default: 무료 경로만 사용
export const DEFAULT_CONFIG = {
  llm: { provider: 'google' as const, model: 'gemini-2.5-flash-lite' },
  tts: { provider: 'elevenlabs' as const, model: 'eleven_multilingual_v2', voice: 'EXAVITQu4vr4xnSDxMaL' },
  image: { provider: 'nvidia' as const, model: 'black-forest-labs/flux.1-dev' },
  audio: { provider: 'freesound' as const },
}
