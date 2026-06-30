import type { StageStatus } from '../types'

const LABEL: Record<string, string> = {
  refine: '본문 다듬기',
  tts: 'TTS 생성',
  image: '이미지 생성',
  audio: '앰비언트 오디오 탐색',
  imgToVid: '이미지 → 동영상',
  compose: '최종 합성',
}

const ICON: Record<StageStatus, string> = {
  idle: '○',
  running: '◌',
  done: '●',
  error: '✕',
}

interface Props {
  stage: string
  status: StageStatus
  message?: string
}

export function StageCard({ stage, status, message }: Props) {
  return (
    <div className={`stage-card stage-${status}`}>
      <span className="stage-icon">{ICON[status]}</span>
      <div className="stage-info">
        <span className="stage-label">{LABEL[stage] ?? stage}</span>
        {message && <span className="stage-msg">{message}</span>}
      </div>
    </div>
  )
}
