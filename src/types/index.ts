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

export type LLMProvider = 'google' | 'nvidia'
export type TTSProvider = 'local-kokoro' | 'google' | 'elevenlabs'
export type ImageProvider = 'google' | 'nvidia' | 'restapi'
export type AudioProvider = 'freesound'

export interface ApiKeys {
  google: string
  nvidia: string
  elevenlabs: string
  freesound: string
  restapi: string
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
  composeMessages?: string[]
  error?: string
  ttsBlob?: Blob
  ttsDuration?: number
  ttsAlignment?: TTSAlignment
  imageBlobs?: Blob[]
  ambientBlob?: Blob
  finalBlob?: Blob
  llmResult?: LLMResult
}
