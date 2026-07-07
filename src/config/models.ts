export const LLM_MODELS = {
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
  // Ollama: localhost:11434, OpenAI-compatible /v1/chat/completions, 인증 없음.
  // 무료·오프라인·API장애 무관. dev 전용(로컬 서버 필요). 모델은 미리 `ollama pull` 필요.
  ollama: [
    { id: 'exaone3.5:7.8b', label: 'EXAONE 3.5 7.8B ✓로컬·한국어특화 (Ollama :11434 필요)' },
    { id: 'qwen3:8b', label: 'Qwen3 8B ✓로컬·빠름·다국어 (Ollama :11434 필요)' },
    { id: 'qwen3-8b-16k:latest', label: 'Qwen3 8B (16k) ⚠느림·8GB VRAM 초과시 스왑 (Ollama :11434 필요)' },
  ],
}

export const TTS_MODELS = {
  'local-kokoro': [
    { id: 'local', label: '브라우저 Web Speech API ✓무료·오프라인 (녹음 불가 — 음성은 스피커 재생)' },
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
  // GPT-SoVITS: 로컬 서버(:9880) 본인 목소리 클로닝. dev 전용(로컬 서버 필요). 무료·오프라인
  'gpt-sovits': [
    { id: 'v2', label: '내 목소리 클로닝 ✓무료·로컬 (GPT-SoVITS 서버 :9880 필요)' },
  ],
}

export const TTS_VOICES: Record<string, string[]> = {
  google: ['Aoede', 'Charon', 'Fenrir', 'Kore', 'Puck'],
  'local-kokoro': [],
  // GPT-SoVITS: 참조 wav가 목소리를 결정 → 별도 voice 선택 불필요
  'gpt-sovits': [],
  // ElevenLabs voice IDs — elevenslabs.io/voice-library 에서 추가 가능
  elevenlabs: [
    'JBFqnCBsd6RMkjVDRZzb',  // George
    'pNInz6obpgDQGcFmaJgB',  // Adam
    'EXAVITQu4vr4xnSDxMaL',  // Bella
  ],
}

export const IMAGE_MODELS = {
  google: [
    // Imagen 4 deprecated 2026-06-24 → 대체: Gemini image generation
    { id: 'gemini-2.0-flash-exp', label: 'Gemini 2.0 Flash Image ✓무료(free tier)' },
    { id: 'imagen-4-fast', label: 'Imagen 4 Fast ⚠deprecated 2026-06-24 / 2 IPM' },
    { id: 'imagen-4-ultra', label: 'Imagen 4 Ultra ⚠deprecated 2026-06-24' },
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
