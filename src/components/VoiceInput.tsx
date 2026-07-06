import { useEffect, useRef, useState } from 'react'
import { useSpeechRecognition } from '../hooks/useSpeechRecognition'
import { speakText } from '../services/promptSpeech'
import { VoiceZone } from './VoiceZone'

interface Props {
  apiKey?: string
  onComplete: (text: string) => void
  onListeningChange?: (listening: boolean) => void
}

type Phase = 'speaking' | 'listening'

const PROMPT_TEXT = '기억하고 싶은 여행의 순간을 들려주세요'

function ReplayIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M11 5 6 9H2v6h4l5 4V5Z" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    </svg>
  )
}

function RetryIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  )
}

function ContinueIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )
}

export function VoiceInput({ apiKey, onComplete, onListeningChange }: Props) {
  const [phase, setPhase] = useState<Phase>('speaking')
  const startedRef = useRef(false)

  const rec = useSpeechRecognition()

  useEffect(() => {
    onListeningChange?.(phase === 'listening')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  function startFlow() {
    setPhase('speaking')
    speakText(PROMPT_TEXT, apiKey, () => {
      if (rec.unsupported) return
      setPhase('listening')
      rec.start()
    })
  }

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true
    startFlow()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function continueToNext() {
    const text = rec.finalText.trim()
    rec.stop()
    onComplete(text)
  }

  function retryRecording() {
    rec.stop()
    rec.start()
  }

  function replayPrompt() {
    if (phase === 'listening') rec.stop()
    startFlow()
  }

  return (
    <>
      <VoiceZone
        active={phase === 'listening'}
        interactive={false}
        title={PROMPT_TEXT}
        subtitle={
          phase === 'speaking' ? '질문을 듣고 있어요...' : '말씀해주세요. 끝나면 계속하기를 눌러주세요.'
        }
      />

      {!rec.unsupported && (
        <div className={`live-transcript${phase !== 'listening' ? ' is-disabled' : ''}`} aria-live="polite">
          {phase === 'listening' && rec.finalText}
          {phase === 'listening' && rec.interimText && <span className="interim">{rec.interimText}</span>}
        </div>
      )}

      {!rec.unsupported && (
        <div className="retry-popup-actions">
          <button className="retry-close-button" type="button" onClick={replayPrompt}>
            <ReplayIcon />
            다시 듣기
          </button>
          <button className="retry-close-button" type="button" onClick={retryRecording} disabled={phase !== 'listening'}>
            <RetryIcon />
            다시 시도하기
          </button>
          <button
            className="retry-record-button"
            type="button"
            onClick={continueToNext}
            disabled={phase !== 'listening' || !rec.finalText.trim()}
          >
            <ContinueIcon />
            계속하기
          </button>
        </div>
      )}

      {rec.unsupported && (
        <p className="notice error mt-3">
          이 브라우저는 음성 인식을 지원하지 않아요. 아래 텍스트 입력을 이용해주세요.
        </p>
      )}
      {rec.micError && <p className="notice error mt-3">{rec.micError}</p>}
    </>
  )
}
