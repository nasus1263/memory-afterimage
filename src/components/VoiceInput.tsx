import { useEffect, useRef, useState } from 'react'
import type { ApiKeys, ModelConfig } from '../types'
import { useSpeechRecognition } from '../hooks/useSpeechRecognition'
import { speakText } from '../services/promptSpeech'
import { generateSingleAnswer } from '../services/llm'
import { isAnswerAutoFillEnabled } from '../store/settings'
import { useAlert } from '../hooks/useAlert'
import { SparkleIcon, ReplayIcon, RetryIcon, ContinueIcon } from './icons'
import { VoiceZone } from './VoiceZone'

interface Props {
  apiKey?: string
  keys: ApiKeys
  config: ModelConfig
  onComplete: (text: string) => void
  onListeningChange?: (listening: boolean) => void
}

type Phase = 'speaking' | 'listening'

const PROMPT_TEXT = '기억하고 싶은 여행의 순간을 들려주세요'

export function VoiceInput({ apiKey, keys, config, onComplete, onListeningChange }: Props) {
  const [phase, setPhase] = useState<Phase>('speaking')
  const [answerOverride, setAnswerOverride] = useState<string | null>(null)
  const [generatingAnswer, setGeneratingAnswer] = useState(false)
  const startedRef = useRef(false)

  const rec = useSpeechRecognition()
  const { showAlert } = useAlert()

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
    const text = (answerOverride ?? rec.finalText).trim()
    rec.stop()
    onComplete(text)
  }

  function retryRecording() {
    setAnswerOverride(null)
    rec.stop()
    rec.start()
  }

  function replayPrompt() {
    setAnswerOverride(null)
    if (phase === 'listening') rec.stop()
    startFlow()
  }

  async function autoFillAnswer() {
    if (generatingAnswer) return
    setGeneratingAnswer(true)
    try {
      const answer = await generateSingleAnswer('', PROMPT_TEXT, config, keys)
      setAnswerOverride(answer)
    } catch (e: any) {
      showAlert('답변을 자동으로 만들지 못했어요. 다시 시도해주세요.')
      console.error('[VoiceInput] 답변 자동 생성 실패', e)
    } finally {
      setGeneratingAnswer(false)
    }
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
          {phase === 'listening' && answerOverride == null && rec.finalText}
          {phase === 'listening' && answerOverride == null && rec.interimText && (
            <span className="interim">{rec.interimText}</span>
          )}
          {phase === 'listening' && answerOverride}
        </div>
      )}

      {!rec.unsupported && (
        <div className="retry-popup-actions">
          <div className="retry-popup-actions-row">
            <button className="retry-close-button" type="button" onClick={replayPrompt}>
              <ReplayIcon />
              다시 듣기
            </button>
            <button className="retry-close-button" type="button" onClick={retryRecording} disabled={phase !== 'listening'}>
              <RetryIcon />
              다시 시도하기
            </button>
            {isAnswerAutoFillEnabled() && (
              <button
                type="button"
                className="voice-answer-autofill-button"
                disabled={phase !== 'listening' || generatingAnswer}
                onClick={autoFillAnswer}
              >
                <SparkleIcon className={generatingAnswer ? 'animate-spin' : ''} />
                자동 생성
              </button>
            )}
          </div>
          <button
            className="retry-record-button retry-record-button-large"
            type="button"
            onClick={continueToNext}
            disabled={phase !== 'listening' || !(answerOverride ?? rec.finalText).trim()}
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
