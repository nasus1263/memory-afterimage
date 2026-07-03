import { useEffect, useRef, useState } from 'react'
import type { ApiKeys, ModelConfig } from '../types'
import { BASE_QUESTIONS } from '../config/questions'
import { generateQuestions, generateQuestionsWithAnswers, summarizeChat } from '../services/llm'
import { isAutoAnswerMode } from '../services/debug'

interface Props {
  userText: string
  keys: ApiKeys
  config: ModelConfig
  onComplete: (summary: string) => void
}

type Selection = number | 'custom' | null

export function Chat({ userText, keys, config, onComplete }: Props) {
  const [questions, setQuestions] = useState<string[] | null>(null)
  const [choices, setChoices] = useState<string[][]>([])
  const [answers, setAnswers] = useState<string[]>([])
  const [selected, setSelected] = useState<Selection[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const ran = useRef(false)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    if (ran.current) return
    ran.current = true

    if (isAutoAnswerMode()) {
      generateQuestionsWithAnswers(userText, BASE_QUESTIONS, config, keys)
        .then(({ questions: qs, answers: ans }) => {
          setQuestions(qs)
          setChoices(qs.map(() => []))
          setAnswers(ans)
          setSelected(ans.map(() => 'custom'))
        })
        .catch((e) => setError(e?.message ?? String(e)))
    } else {
      generateQuestions(userText, BASE_QUESTIONS, config, keys)
        .then(({ questions: qs, choices: chs }) => {
          setQuestions(qs)
          setChoices(chs)
          setAnswers(new Array(qs.length).fill(''))
          setSelected(new Array(qs.length).fill(null))
        })
        .catch((e) => setError(e?.message ?? String(e)))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleAnswerChange(i: number, value: string) {
    setAnswers((prev) => { const next = [...prev]; next[i] = value; return next })
  }

  function selectChoice(i: number, choiceIndex: number) {
    setAnswers((prev) => { const next = [...prev]; next[i] = choices[i][choiceIndex]; return next })
    setSelected((prev) => { const next = [...prev]; next[i] = choiceIndex; return next })
    setCurrentIndex(i)
  }

  function selectCustom(i: number) {
    setSelected((prev) => { const next = [...prev]; next[i] = 'custom'; return next })
    setCurrentIndex(i)
    inputRefs.current[i]?.focus()
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>, i: number) {
    if (e.key !== 'Enter') return
    e.preventDefault()
    const next = inputRefs.current[i + 1]
    if (next) next.focus()
  }

  async function handleComplete() {
    if (!questions || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const qa = questions.map((question, i) => ({ question, answer: answers[i] ?? '' }))
      const summary = await summarizeChat(userText, qa, config, keys)
      onComplete(summary)
    } catch (e: any) {
      setError(e?.message ?? String(e))
      setSubmitting(false)
    }
  }

  if (error && !questions) {
    return (
      <section className="input-card" aria-label="추가 질문">
        <p className="notice error">오류: {error}</p>
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

  return (
    <section className="input-card" aria-label="추가 질문">
      <div className="input-title">
        <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
        </svg>
        조금 더 이야기해 주세요
      </div>

      <div className="chat-list">
        {questions.map((q, i) => (
          <div className={`chat-question${i === currentIndex ? ' current' : ''}`} key={i}>
            <span className="chat-question-label">{q}</span>
            {choices[i]?.length > 0 && (
              <div className="chat-choice-row" role="radiogroup" aria-label="답변 선택지">
                {choices[i].map((choice, choiceIndex) => (
                  <button
                    key={choiceIndex}
                    type="button"
                    role="radio"
                    aria-checked={selected[i] === choiceIndex}
                    className={`chat-choice-pill${selected[i] === choiceIndex ? ' active' : ''}`}
                    onClick={() => selectChoice(i, choiceIndex)}
                  >
                    {choice}
                  </button>
                ))}
                <button
                  type="button"
                  role="radio"
                  aria-checked={selected[i] === 'custom'}
                  className={`chat-choice-pill custom-pill${selected[i] === 'custom' ? ' active' : ''}`}
                  onClick={() => selectCustom(i)}
                >
                  직접입력
                </button>
              </div>
            )}
            <input
              ref={(el) => { inputRefs.current[i] = el }}
              className="chat-answer-input"
              type="text"
              value={answers[i] ?? ''}
              onChange={(e) => handleAnswerChange(i, e.target.value)}
              onFocus={() => { setCurrentIndex(i); setSelected((prev) => { const next = [...prev]; next[i] = 'custom'; return next }) }}
              onKeyDown={(e) => handleKeyDown(e, i)}
              placeholder="답변을 입력하세요"
            />
          </div>
        ))}
      </div>

      {error && <p className="notice error">오류: {error}</p>}

      <button type="button" className="primary-wide-button" onClick={handleComplete} disabled={submitting}>
        {submitting ? '정리하는 중...' : '완료'}
      </button>
    </section>
  )
}
