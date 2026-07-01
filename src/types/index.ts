export type LLMProvider = 'openai' | 'anthropic' | 'google' | 'nvidia'
export type TTSProvider = 'local-kokoro' | 'openai' | 'google' | 'elevenlabs'
export type ImageProvider = 'openai' | 'google' | 'huggingface' | 'fal' | 'nvidia'
export type VidProvider = 'google' | 'fal' | 'replicate'
export type AudioProvider = 'freesound' | 'jamendo'

export interface ApiKeys {
  openai: string
  anthropic: string
  google: string
  nvidia: string
  elevenlabs: string
  fal: string
  replicate: string
  huggingface: string
  freesound: string
  jamendo: string
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

export interface StageMessages {
  refine?: string
  tts?: string
  image?: string
  audio?: string
  imgToVid?: string
  compose?: string
}

export interface StageDurations {
  refine?: number
  tts?: number
  image?: number
  audio?: number
  imgToVid?: number
  compose?: number
}

export interface PipelineState {
  refine: StageStatus
  tts: StageStatus
  image: StageStatus
  audio: StageStatus
  imgToVid: StageStatus
  compose: StageStatus
  messages: StageMessages
  durations: StageDurations
  error?: string
  ttsBlob?: Blob
  ttsDuration?: number
  imageBlob?: Blob
  ambientBlob?: Blob
  videoBlob?: Blob
  finalBlob?: Blob
  llmResult?: LLMResult
}
