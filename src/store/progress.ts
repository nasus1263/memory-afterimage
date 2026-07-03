import type { AspectRatio } from '../types'

const PROGRESS_KEY = 'memory_afterimage_progress'

export interface SessionProgress {
  route: '/input' | '/chat' | '/process'
  userText: string
  aspectRatio: AspectRatio
  showCaptions: boolean
  captionBgColor: string
  captionTextColor: string
  secondsPerImage: number
}

export function loadProgress(): SessionProgress | null {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function saveProgress(progress: SessionProgress) {
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress))
}

export function clearProgress() {
  localStorage.removeItem(PROGRESS_KEY)
}
