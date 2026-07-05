import { useEffect, useRef, useState } from 'react'
import { useSpeechRecognition } from '../hooks/useSpeechRecognition'
import { VoiceZone } from './VoiceZone'

interface Props {
  onComplete: (text: string) => void
  onListeningChange?: (listening: boolean) => void
}

type Phase = 'speaking' | 'listening'

const PROMPT_TEXT = '기억하고 싶은 여행의 순간을 들려주세요'

export function VoiceInput({ onComplete, onListeningChange }: Props) {
  const [phase, setPhase] = useState<Phase>('speaking')
  const startedRef = useRef(false)

  const rec = useSpeechRecognition()

  useEffect(() => {
    onListeningChange?.(phase === 'listening')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  useEffect(() => () => { window.speechSynthesis?.cancel() }, [])

  function speak(text: string, onEnd: () => void) {
    if (!('speechSynthesis' in window)) { onEnd(); return }
    window.speechSynthesis.cancel()
    const utter = new SpeechSynthesisUtterance(text)
    utter.lang = 'ko-KR'
    utter.onend = onEnd
    utter.onerror = onEnd
    window.speechSynthesis.speak(utter)
  }

  function startFlow() {
    setPhase('speaking')
    speak(PROMPT_TEXT, () => {
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
        <button type="button" className="ghost-link mx-auto block" onClick={replayPrompt}>
          다시 듣기
        </button>
      )}

      {phase === 'listening' && (
        <div className="live-transcript" aria-live="polite">
          {rec.finalText}
          <span className="interim">{rec.interimText}</span>
        </div>
      )}

      {phase === 'listening' && (
        <div className="retry-popup-actions">
          <button className="retry-close-button" type="button" onClick={retryRecording}>다시 시도하기</button>
          <button
            className="retry-record-button"
            type="button"
            onClick={continueToNext}
            disabled={!rec.finalText.trim()}
          >
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
