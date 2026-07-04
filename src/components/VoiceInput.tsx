import { useEffect, useState } from 'react'
import { useSpeechRecognition } from '../hooks/useSpeechRecognition'
import { VoiceZone } from './VoiceZone'

interface Props {
  onComplete: (text: string) => void
  onListeningChange?: (listening: boolean) => void
}

const BAR_COUNT = 56

function fmt(s: number) {
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

export function VoiceInput({ onComplete, onListeningChange }: Props) {
  const [showRetry, setShowRetry] = useState(false)

  const rec = useSpeechRecognition({
    onEnd: (text, tooShort) => {
      if (tooShort) { setShowRetry(true); return }
      onComplete(text)
    },
  })

  useEffect(() => {
    onListeningChange?.(rec.listening)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rec.listening])

  function handleToggle() {
    if (rec.listening) rec.stop()
    else rec.start()
  }

  function closeRetry() {
    setShowRetry(false)
  }

  if (rec.listening) {
    return (
      <div className="listening-screen" aria-live="polite">
        <p className="step-label">02 LISTENING</p>
        <h2>듣고 있어요...</h2>
        <p className="listening-desc">여행의 한 장면을 자유롭게 들려주세요.</p>

        <div className={`wave-wrap ${rec.metered ? 'live' : ''}`} aria-hidden="true">
          {Array.from({ length: BAR_COUNT }).map((_, i) => (
            <span
              key={i}
              ref={(el) => { rec.barRefs.current[i] = el }}
              className="bar"
              style={{ height: `${14 + Math.abs(Math.sin(i * 0.45)) * 50 + (i % 7) * 4}px` }}
            />
          ))}
        </div>

        <div className="live-transcript" aria-live="polite">
          {rec.finalText}
          <span className="interim">{rec.interimText}</span>
        </div>
        <p className="timer">{fmt(rec.seconds)}</p>

        <button className="stop-button" aria-label="녹음 종료" onClick={handleToggle}>
          <span className="stop-square" />
        </button>
        <p className="record-help">말씀이 끝나면 정지 버튼을 눌러주세요.</p>
      </div>
    )
  }

  return (
    <>
      <VoiceZone
        active={false}
        interactive={!rec.unsupported && !rec.processing}
        onToggle={handleToggle}
        disabled={rec.unsupported || rec.processing}
        title="음성으로 기억 말하기"
        subtitle={rec.processing ? <span className="text-gold">처리 중...</span> : '눌러서 오늘의 순간을 들려주세요'}
      />

      {rec.unsupported && (
        <p className="notice error mt-3">
          이 브라우저는 음성 인식을 지원하지 않아요. 아래 텍스트 입력을 이용해주세요.
        </p>
      )}
      {rec.micError && <p className="notice error mt-3">{rec.micError}</p>}

      {showRetry && (
        <div className="retry-popup" role="dialog" aria-modal="true" aria-labelledby="retryPopupTitle">
          <div className="retry-popup-card">
            <div className="retry-popup-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 14a4 4 0 0 0 4-4V6a4 4 0 0 0-8 0v4a4 4 0 0 0 4 4Z" />
                <path d="M19 10a7 7 0 0 1-14 0" />
                <path d="M12 17v4" />
                <path d="M8 21h8" />
              </svg>
            </div>
            <h3 id="retryPopupTitle">음성 인식이 잘 되지 않았어요</h3>
            <p>주변 소음을 줄이고, 마이크 가까이에서 다시 말해보세요.</p>
            <div className="retry-popup-actions">
              <button className="retry-close-button" type="button" onClick={closeRetry}>닫기</button>
              <button className="retry-record-button" type="button" onClick={() => { closeRetry(); rec.start() }}>
                다시 시도하기
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
