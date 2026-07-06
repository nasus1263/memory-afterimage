import { useEffect, useRef, useState } from 'react'
import type { ApiKeys, ModelConfig } from '../types'
import { summarizeChat, generateSingleAnswer } from '../services/llm'
import { isAutoAnswerMode } from '../services/debug'
import { isAnswerAutoFillEnabled } from '../store/settings'
import { useQuestions } from '../hooks/useQuestions'
import { useSpeechRecognition } from '../hooks/useSpeechRecognition'
import { speakText, stopSpeaking } from '../services/promptSpeech'
import { useAlert } from '../hooks/useAlert'
import { SparkleIcon } from './icons'
import { VoiceZone } from './VoiceZone'

interface Props {
  userText: string
  keys: ApiKeys
  config: ModelConfig
  onComplete: (summary: string) => void
}

// 'manual' = STT 미지원 브라우저용 텍스트 직접입력 단계
type Phase = 'speaking' | 'listening' | 'manual' | 'submitting'

const EMOJI_RE = new RegExp('[\\p{Extended_Pictographic}\\u{FE0F}\\u{200D}]', 'gu')

export function VoiceChat({ userText, keys, config, onComplete }: Props) {
  const { questions, choices, initialAnswers, error: fetchError } = useQuestions(userText, config, keys)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [phase, setPhase] = useState<Phase>('speaking')
  const [manualText, setManualText] = useState('')
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [answerOverride, setAnswerOverride] = useState<string | null>(null)
  const [generatingAnswer, setGeneratingAnswer] = useState(false)

  const answersRef = useRef<string[]>([])
  const startedRef = useRef(false)
  const manualInputRef = useRef<HTMLInputElement>(null)

  const rec = useSpeechRecognition()
  const { showAlert } = useAlert()

  useEffect(() => {
    if (phase === 'manual') manualInputRef.current?.focus()
  }, [phase])

  function stripEmoji(text: string): string {
    return text.replace(EMOJI_RE, '').replace(/\s+/g, ' ').trim()
  }

  function speak(text: string, onEnd: () => void) {
    speakText(stripEmoji(text), keys.elevenlabs, onEnd)
  }

  function askQuestion(i: number) {
    if (!questions) return
    if (i >= questions.length) { finalize(); return }
    setCurrentIndex(i)
    setManualText('')
    setAnswerOverride(null)
    setPhase('speaking')
    speak(questions[i], () => {
      if (rec.unsupported) { setPhase('manual'); return }
      setPhase('listening')
      rec.start()
    })
  }

  useEffect(() => {
    if (!questions || startedRef.current) return
    startedRef.current = true
    answersRef.current = [...initialAnswers]
    if (isAutoAnswerMode()) finalize()
    else askQuestion(0)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questions])

  function commitAnswer(answer: string) {
    answersRef.current[currentIndex] = answer
    askQuestion(currentIndex + 1)
  }

  function selectChoice(choiceIndex: number) {
    const answer = choices[currentIndex]?.[choiceIndex] ?? ''
    stopSpeaking()
    rec.stop()
    commitAnswer(answer)
  }

  function continueToNext() {
    const answer = phase === 'manual' ? manualText : (answerOverride ?? rec.finalText)
    rec.stop()
    commitAnswer(answer.trim())
  }

  function retryRecording() {
    setAnswerOverride(null)
    rec.stop()
    rec.start()
  }

  async function autoFillAnswer() {
    if (!questions || generatingAnswer) return
    setGeneratingAnswer(true)
    try {
      const answer = await generateSingleAnswer(userText, questions[currentIndex], config, keys)
      if (phase === 'manual') setManualText(answer)
      else setAnswerOverride(answer)
    } catch (e: any) {
      showAlert('답변을 자동으로 만들지 못했어요. 다시 시도해주세요.')
      console.error('[VoiceChat] 답변 자동 생성 실패', e)
    } finally {
      setGeneratingAnswer(false)
    }
  }

  function replayQuestion() {
    if (!questions) return
    const resumePhase = phase
    if (resumePhase === 'listening') rec.stop()
    setPhase('speaking')
    speak(questions[currentIndex], () => {
      if (resumePhase === 'listening' && !rec.unsupported) {
        setPhase('listening')
        rec.start()
      } else {
        setPhase(resumePhase)
      }
    })
  }

  async function finalize() {
    if (!questions) return
    setSubmitError(null)
    setPhase('submitting')
    try {
      const qa = questions.map((q, i) => ({ question: q, answer: answersRef.current[i] ?? '' }))
      const summary = await summarizeChat(userText, qa, config, keys)
      onComplete(summary)
    } catch (e: any) {
      setSubmitError(e?.message ?? String(e))
    }
  }

  if (fetchError && !questions) {
    return (
      <section className="input-card" aria-label="추가 질문">
        <p className="notice error">오류: {fetchError}</p>
      </section>
    )
  }

  if (!questions || (isAutoAnswerMode() && phase !== 'submitting')) {
    return (
      <section className="input-card" aria-label="추가 질문 준비 중" aria-live="polite">
        <div className="memory-orb" aria-hidden="true">
          <span className="loading-core" />
        </div>
        <p className="loading-desc text-center">기억을 더 깊이 들여다볼<br />질문을 준비하고 있어요...</p>
      </section>
    )
  }

  const currentChoices = choices[currentIndex] ?? []

  return (
    <section className="input-card" aria-label="추가 질문 (음성)">
      <div className="input-title">
        <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
        </svg>
        조금 더 이야기해 주세요
      </div>

      {phase === 'submitting' && !submitError ? (
        <div className="memory-orb" aria-hidden="true">
          <span className="loading-core" />
        </div>
      ) : phase !== 'submitting' ? (
        <VoiceZone
          active={phase === 'listening'}
          interactive={false}
          title={questions[currentIndex]}
          subtitle={
            phase === 'speaking' ? '질문을 듣고 있어요...'
            : phase === 'listening' ? '말씀해주세요. 끝나면 계속하기를 눌러주세요.'
            : '아래에 답변을 입력해주세요'
          }
        />
      ) : null}

      {!rec.unsupported && phase !== 'submitting' && (
        <div className={`live-transcript${phase !== 'listening' ? ' is-disabled' : ''}`} aria-live="polite">
          {phase === 'listening' && answerOverride == null && rec.finalText}
          {phase === 'listening' && answerOverride == null && rec.interimText && (
            <span className="interim">{rec.interimText}</span>
          )}
          {phase === 'listening' && answerOverride}
        </div>
      )}

      {currentChoices.length > 0 && phase !== 'submitting' && (
        <div className="chat-choice-row voice-choice-row" role="radiogroup" aria-label="답변 선택지">
          {currentChoices.map((choice, i) => (
            <button key={i} type="button" className="chat-choice-pill" onClick={() => selectChoice(i)}>
              {choice}
            </button>
          ))}
        </div>
      )}

      {rec.unsupported && phase !== 'submitting' && (
        <div className="chat-answer-row">
          <input
            ref={manualInputRef}
            className="chat-answer-input"
            type="text"
            value={manualText}
            onChange={(e) => setManualText(e.target.value)}
            placeholder="답변을 입력하세요"
            disabled={phase !== 'manual'}
          />
          {isAnswerAutoFillEnabled() && (
            <button
              type="button"
              className="voice-answer-autofill-button"
              aria-label="답변 자동 생성"
              disabled={generatingAnswer || phase !== 'manual'}
              onClick={autoFillAnswer}
            >
              <SparkleIcon className={generatingAnswer ? 'animate-spin' : ''} />
              자동 생성
            </button>
          )}
        </div>
      )}

      {phase !== 'submitting' && (
        <div className="retry-popup-actions">
          <div className="retry-popup-actions-row">
            <button className="retry-close-button" type="button" onClick={replayQuestion}>다시 듣기</button>
            {!rec.unsupported && (
              <button className="retry-close-button" type="button" onClick={retryRecording} disabled={phase !== 'listening'}>다시 시도하기</button>
            )}
            {!rec.unsupported && isAnswerAutoFillEnabled() && (
              <button
                type="button"
                className="voice-answer-autofill-button"
                disabled={generatingAnswer || phase !== 'listening'}
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
            disabled={phase === 'manual' ? !manualText.trim() : (phase !== 'listening' || !(answerOverride ?? rec.finalText).trim())}
          >
            계속하기
          </button>
        </div>
      )}

      {rec.micError && <p className="notice error mt-3">{rec.micError}</p>}
      {submitError && (
        <>
          <p className="notice error">오류: {submitError}</p>
          <button type="button" className="primary-wide-button" onClick={finalize}>다시 시도</button>
        </>
      )}
    </section>
  )
}
