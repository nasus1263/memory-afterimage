import type { StageStatus } from '../types'

const LABEL: Record<string, string> = {
  refine: '본문 다듬기',
  tts: 'TTS 생성',
  image: '이미지 생성',
  audio: '앰비언트 오디오 탐색',
  compose: '최종 합성',
}

const ICON: Record<StageStatus, string> = {
  idle: '○',
  running: '◌',
  done: '●',
  error: '✕',
}

const STATUS_STYLE: Record<StageStatus, string> = {
  idle: 'border-border opacity-50',
  running: 'border-running text-running',
  done: 'border-success',
  error: 'border-error text-error',
}

function formatDuration(ms: number): string {
  const totalSec = ms / 1000
  if (totalSec < 60) return `${totalSec.toFixed(1)}초`
  const min = Math.floor(totalSec / 60)
  const sec = Math.round(totalSec % 60)
  return `${min}분 ${sec}초`
}

interface Props {
  stage: string
  status: StageStatus
  message?: string
  durationMs?: number
  subitems?: string[]
}

export function StageCard({ stage, status, message, durationMs, subitems }: Props) {
  return (
    <div className={`flex items-center gap-3 py-3 px-3.5 rounded-2xl border bg-surface text-base transition-colors ${STATUS_STYLE[status]}`}>
      <span className={`text-lg w-5 text-center shrink-0 ${status === 'running' ? 'inline-block animate-spin' : ''}`}>
        {ICON[status]}
      </span>
      <div className="flex flex-col gap-0.5 flex-1">
        <span className="text-base">{LABEL[stage] ?? stage}</span>
        {message && <span className="text-base text-text-dim opacity-85">{message}</span>}
        {subitems && subitems.length > 0 && (
          <div className="flex flex-col gap-0.5 mt-1">
            {subitems.map((item, i) => (
              <span key={i} className="text-base text-text-dim opacity-85">
                {i + 1}번 이미지: {item}
              </span>
            ))}
          </div>
        )}
      </div>
      {durationMs != null && <span className="text-base text-text-dim whitespace-nowrap ml-auto">{formatDuration(durationMs)}</span>}
    </div>
  )
}
