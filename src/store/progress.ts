import type { AspectRatio } from '../types'
import { isProgressAutoSaveEnabled } from './settings'

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
  // 자동 저장(이어하기)이 꺼져 있으면 저장하지 않음 → 다음 접속 시 항상 메인부터.
  // 혹시 예전에 남은 진행 상황이 있으면 함께 정리한다.
  if (!isProgressAutoSaveEnabled()) {
    localStorage.removeItem(PROGRESS_KEY)
    return
  }
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress))
}

export function clearProgress() {
  localStorage.removeItem(PROGRESS_KEY)
}
