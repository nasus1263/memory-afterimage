import { useEffect, useRef, useState } from 'react'
import type { ApiKeys, ModelConfig } from '../types'
import { summarizeChat, generateSingleAnswer } from '../services/llm'
import { isAutoAnswerMode } from '../services/debug'
import { isAnswerAutoFillEnabled } from '../store/settings'
import { useQuestions } from '../hooks/useQuestions'
import { useAlert } from '../hooks/useAlert'
import { SparkleIcon } from './icons'

interface Props {
  userText: string
  keys: ApiKeys
  config: ModelConfig
  onComplete: (summary: string) => void
}

type Selection = number | 'custom' | null

export function Chat({ userText, keys, config, onComplete }: Props) {
  const { question, choices, index, total, done, history, error: fetchError, submitAnswer } = useQuestions(userText, config, keys)
  const [answer, setAnswer] = useState('')
  const [selected, setSelected] = useState<Selection>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [generating, setGenerating] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const { showAlert } = useAlert()

  useEffect(() => {
    if (!question) return
    setAnswer('')
    setSelected(null)
    if (isAutoAnswerMode()) autoFillAnswer()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question])

  useEffect(() => {
    if (done) handleComplete()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done])

  async function autoFillAnswer() {
    if (!question || generating) return
    setGenerating(true)
    try {
      const a = await generateSingleAnswer(userText, question, config, keys)
      setAnswer(a)
      setSelected('custom')
    } catch (e: any) {
      showAlert('답변을 자동으로 만들지 못했어요. 다시 시도해주세요.')
      console.error('[Chat] 답변 자동 생성 실패', e)
    } finally {
      setGenerating(false)
    }
  }

  function selectChoice(choiceIndex: number) {
    setAnswer(choices[choiceIndex])
    setSelected(choiceIndex)
  }

  function selectCustom() {
    setSelected('custom')
    inputRef.current?.focus()
  }

  function handleNext() {
    submitAnswer(answer)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return
    e.preventDefault()
    handleNext()
  }

  async function handleComplete() {
    if (submitting) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const summary = await summarizeChat(userText, history, config, keys)
      onComplete(summary)
    } catch (e: any) {
      setSubmitError(e?.message ?? String(e))
      setSubmitting(false)
    }
  }

  if (fetchError && !question) {
    return (
      <section className="input-card" aria-label="추가 질문">
        <p className="notice error">오류: {fetchError}</p>
      </section>
    )
  }

  if (!question || submitting) {
    return (
      <section className="input-card" aria-label="추가 질문 준비 중" aria-live="polite">
        <div className="memory-orb" aria-hidden="true">
          <span className="loading-core" />
        </div>
        <p className="loading-desc text-center">
          {submitting ? '기억을 정리하고 있어요...' : <>기억을 더 깊이 들여다볼<br />질문을 준비하고 있어요...</>}
        </p>
      </section>
    )
  }

  return (
    <section className="input-card" aria-label="추가 질문">
      <div className="input-title">
        <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
        </svg>
        조금 더 이야기해 주세요 ({index + 1}/{total})
      </div>

      <div className="chat-list">
        <div className="chat-question current">
          <span className="chat-question-label">{question}</span>
          {choices.length > 0 && (
            <div className="chat-choice-row" role="radiogroup" aria-label="답변 선택지">
              {choices.map((choice, choiceIndex) => (
                <button
                  key={choiceIndex}
                  type="button"
                  role="radio"
                  aria-checked={selected === choiceIndex}
                  className={`chat-choice-pill${selected === choiceIndex ? ' active' : ''}`}
                  onClick={() => selectChoice(choiceIndex)}
                >
                  {choice}
                </button>
              ))}
              <button
                type="button"
                role="radio"
                aria-checked={selected === 'custom'}
                className={`chat-choice-pill custom-pill${selected === 'custom' ? ' active' : ''}`}
                onClick={selectCustom}
              >
                직접입력
              </button>
            </div>
          )}
          <div className="chat-answer-row">
            <input
              ref={inputRef}
              className="chat-answer-input"
              type="text"
              value={answer}
              onChange={(e) => { setAnswer(e.target.value); setSelected('custom') }}
              onKeyDown={handleKeyDown}
              placeholder="답변을 입력하세요"
            />
            {isAnswerAutoFillEnabled() && (
              <button
                type="button"
                className="answer-autofill-button"
                aria-label="답변 자동 생성"
                disabled={generating}
                onClick={autoFillAnswer}
              >
                <SparkleIcon className={generating ? 'animate-spin' : ''} />
                자동 생성
              </button>
            )}
          </div>
        </div>
      </div>

      {submitError && <p className="notice error">오류: {submitError}</p>}

      <button type="button" className="primary-wide-button" onClick={handleNext}>
        {index + 1 >= total ? '완료' : '다음'}
      </button>
    </section>
  )
}
