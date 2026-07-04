import { useEffect, useRef, useState } from 'react'
import type { ApiKeys, ModelConfig } from '../types'
import { BASE_QUESTIONS } from '../config/questions'
import { generateQuestions, generateQuestionsWithAnswers } from '../services/llm'
import { isAutoAnswerMode } from '../services/debug'

export function useQuestions(userText: string, config: ModelConfig, keys: ApiKeys) {
  const [questions, setQuestions] = useState<string[] | null>(null)
  const [choices, setChoices] = useState<string[][]>([])
  const [initialAnswers, setInitialAnswers] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return
    ran.current = true

    if (isAutoAnswerMode()) {
      generateQuestionsWithAnswers(userText, BASE_QUESTIONS, config, keys)
        .then(({ questions: qs, answers: ans }) => {
          setQuestions(qs)
          setChoices(qs.map(() => []))
          setInitialAnswers(ans)
        })
        .catch((e) => setError(e?.message ?? String(e)))
    } else {
      generateQuestions(userText, BASE_QUESTIONS, config, keys)
        .then(({ questions: qs, choices: chs }) => {
          setQuestions(qs)
          setChoices(chs)
          setInitialAnswers(new Array(qs.length).fill(''))
        })
        .catch((e) => setError(e?.message ?? String(e)))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { questions, choices, initialAnswers, error }
}
