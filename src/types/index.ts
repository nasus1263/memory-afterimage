export type AspectRatio = '16:9' | '9:16' | '1:1'

export interface SessionImage {
  id: string
  file: File
  url: string
}

export interface ChatQA {
  question: string
  answer: string
}

export type LLMProvider = 'openai' | 'anthropic' | 'google' | 'nvidia'
export type TTSProvider = 'local-kokoro' | 'openai' | 'google' | 'elevenlabs'
export type ImageProvider = 'openai' | 'google' | 'huggingface' | 'fal' | 'nvidia'
export type AudioProvider = 'freesound' | 'jamendo'

export interface ApiKeys {
  openai: string
  anthropic: string
  google: string
  nvidia: string
  elevenlabs: string
  fal: string
  huggingface: string
  freesound: string
  jamendo: string
}

export interface ModelConfig {
  llm: { provider: LLMProvider; model: string }
  tts: { provider: TTSProvider; model: string; voice: string }
  image: { provider: ImageProvider; model: string }
  audio: { provider: AudioProvider }
}

export interface TTSAlignment {
  characters: string[]
  characterStartTimesSeconds: number[]
  characterEndTimesSeconds: number[]
}

export interface LLMResult {
  refinedText: string
  imagePrompt: string
  audioKeyword: string
}

export type StageStatus = 'idle' | 'running' | 'done' | 'error'

export interface StageMessages {
  refine?: string
  tts?: string
  image?: string
  audio?: string
  compose?: string
}

export interface StageDurations {
  refine?: number
  tts?: number
  image?: number
  audio?: number
  compose?: number
}

export interface PipelineState {
  refine: StageStatus
  tts: StageStatus
  image: StageStatus
  audio: StageStatus
  compose: StageStatus
  messages: StageMessages
  durations: StageDurations
  imageMessages?: string[]
  error?: string
  ttsBlob?: Blob
  ttsDuration?: number
  ttsAlignment?: TTSAlignment
  imageBlobs?: Blob[]
  ambientBlob?: Blob
  finalBlob?: Blob
  llmResult?: LLMResult
}
