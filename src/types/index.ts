export type LLMProvider = 'openai' | 'anthropic' | 'google'
export type TTSProvider = 'local-kokoro' | 'openai' | 'google'
export type ImageProvider = 'openai' | 'google' | 'huggingface' | 'fal'
export type VidProvider = 'google' | 'fal' | 'replicate'
export type AudioProvider = 'freesound' | 'pixabay'

export interface ApiKeys {
  openai: string
  anthropic: string
  google: string
  fal: string
  replicate: string
  huggingface: string
  freesound: string
  pixabay: string
}

export interface ModelConfig {
  llm: { provider: LLMProvider; model: string }
  tts: { provider: TTSProvider; model: string; voice: string }
  image: { provider: ImageProvider; model: string }
  video: { provider: VidProvider; model: string }
  audio: { provider: AudioProvider }
}

export interface LLMResult {
  refinedText: string
  imagePrompt: string
  audioKeywords: string[]
}

export type StageStatus = 'idle' | 'running' | 'done' | 'error'

export interface PipelineState {
  refine: StageStatus
  tts: StageStatus
  image: StageStatus
  audio: StageStatus
  imgToVid: StageStatus
  compose: StageStatus
  error?: string
  ttsBlob?: Blob
  ttsDuration?: number
  imageBlob?: Blob
  ambientBlob?: Blob
  videoBlob?: Blob
  finalBlob?: Blob
  llmResult?: LLMResult
}
