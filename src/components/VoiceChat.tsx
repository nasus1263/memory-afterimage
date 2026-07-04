import { useEffect, useRef, useState } from 'react'
import type { ApiKeys, ModelConfig } from '../types'
import { summarizeChat } from '../services/llm'
import { useQuestions } from '../hooks/useQuestions'
import { useSpeechRecognition } from '../hooks/useSpeechRecognition'
import { VoiceZone } from './VoiceZone'

interface Props {
  userText: string
  keys: ApiKeys
  config: ModelConfig
  onComplete: (summary: string) => void
}

type Phase = 'speaking' | 'listening' | 'reviewing' | 'submitting'

export function VoiceChat({ userText, keys, config, onComplete }: Props) {
  const { questions, choices, initialAnswers, error: fetchError } = useQuestions(userText, config, keys)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [phase, setPhase] = useState<Phase>('speaking')
  const [pendingTranscript, setPendingTranscript] = useState('')
  const [submitError, setSubmitError] = useState<string | null>(null)

  const answersRef = useRef<string[]>([])
  const startedRef = useRef(false)
  const suppressRecEndRef = useRef(false)

  const rec = useSpeechRecognition({
    onEnd: (text) => {
      if (suppressRecEndRef.current) { suppressRecEndRef.current = false; return }
      setPendingTranscript(text)
      setPhase('reviewing')
    },
  })

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

  function askQuestion(i: number) {
    if (!questions) return
    if (i >= questions.length) { finalize(); return }
    setCurrentIndex(i)
    setPendingTranscript('')
    setPhase('speaking')
    speak(questions[i], () => {
      if (rec.unsupported) { setPhase('reviewing'); return }
      setPhase('listening')
      rec.start()
    })
  }

  useEffect(() => {
    if (!questions || startedRef.current) return
    startedRef.current = true
    answersRef.current = [...initialAnswers]
    askQuestion(0)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questions])

  function commitAnswer(answer: string) {
    answersRef.current[currentIndex] = answer
    askQuestion(currentIndex + 1)
  }

  function selectChoice(choiceIndex: number) {
    const answer = choices[currentIndex]?.[choiceIndex] ?? ''
    window.speechSynthesis.cancel()
    if (rec.listening) { suppressRecEndRef.current = true; rec.stop() }
    commitAnswer(answer)
  }

  function acceptTranscript() {
    commitAnswer(pendingTranscript)
  }

  function retryRecording() {
    setPendingTranscript('')
    setPhase('listening')
    rec.start()
  }

  async function finalize() {
    if (!questions) return
    setPhase('submitting')
    try {
      const qa = questions.map((q, i) => ({ question: q, answer: answersRef.current[i] ?? '' }))
      const summary = await summarizeChat(userText, qa, config, keys)
      onComplete(summary)
    } catch (e: any) {
      setSubmitError(e?.message ?? String(e))
      setPhase('reviewing')
    }
  }

  if (fetchError && !questions) {
    return (
      <section className="input-card" aria-label="추가 질문">
        <p className="notice error">오류: {fetchError}</p>
      </section>
    )
  }

  if (!questions) {
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
  const showManualInput = phase === 'reviewing' && rec.unsupported

  return (
    <section className="input-card" aria-label="추가 질문 (음성)">
      <div className="input-title">
        <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
        </svg>
        조금 더 이야기해 주세요
      </div>

      {phase === 'submitting' ? (
        <div className="memory-orb" aria-hidden="true">
          <span className="loading-core" />
        </div>
      ) : (
        <VoiceZone
          active={phase === 'listening'}
          interactive={phase === 'listening'}
          onToggle={rec.stop}
          disabled={phase !== 'listening'}
          title={questions[currentIndex]}
          subtitle={
            phase === 'speaking' ? '질문을 듣고 있어요...'
            : phase === 'listening' ? '말씀해주세요. 끝나면 마이크를 눌러주세요.'
            : '아래에서 계속하거나 다시 시도해주세요'
          }
        />
      )}

      {phase === 'listening' && (
        <div className="live-transcript" aria-live="polite">
          {rec.finalText}
          <span className="interim">{rec.interimText}</span>
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

      {showManualInput && (
        <>
          <input
            className="chat-answer-input"
            type="text"
            value={pendingTranscript}
            onChange={(e) => setPendingTranscript(e.target.value)}
            placeholder="답변을 입력하세요"
            autoFocus
          />
          <button type="button" className="primary-wide-button mt-3" onClick={acceptTranscript} disabled={!pendingTranscript.trim()}>
            다음으로
          </button>
        </>
      )}

      {phase === 'reviewing' && !rec.unsupported && (
        <div className="retry-popup-actions">
          <button className="retry-close-button" type="button" onClick={retryRecording}>다시 시도하기</button>
          <button className="retry-record-button" type="button" onClick={acceptTranscript}>계속하기</button>
        </div>
      )}

      {rec.micError && <p className="notice error mt-3">{rec.micError}</p>}
      {submitError && <p className="notice error">오류: {submitError}</p>}
    </section>
  )
}
