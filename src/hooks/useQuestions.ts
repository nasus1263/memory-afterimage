import { useEffect, useRef, useState } from 'react'
import type { ApiKeys, ChatQA, ModelConfig } from '../types'
import { BASE_QUESTIONS } from '../config/questions'
import { generateNextQuestion } from '../services/llm'
import { stripEmoji } from '../utils/emoji'

export function useQuestions(userText: string, config: ModelConfig, keys: ApiKeys) {
  const [index, setIndex] = useState(0)
  const [question, setQuestion] = useState<string | null>(null)
  const [choices, setChoices] = useState<string[]>([])
  const [history, setHistory] = useState<ChatQA[]>([])
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fetchedIndex = useRef(-1)

  useEffect(() => {
    if (index >= BASE_QUESTIONS.length) {
      setDone(true)
      return
    }
    if (fetchedIndex.current === index) return
    fetchedIndex.current = index
    setQuestion(null)
    generateNextQuestion(userText, BASE_QUESTIONS[index], history, config, keys)
      .then(({ question: q, choices: chs }) => {
        setQuestion(q)
        setChoices(chs)
      })
      .catch((e) => setError(e?.message ?? String(e)))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index])

  function submitAnswer(answer: string) {
    if (question == null) return
    setHistory((prev) => [...prev, { question, answer: stripEmoji(answer) }])
    setIndex((i) => i + 1)
  }

  return {
    question,
    choices,
    index,
    total: BASE_QUESTIONS.length,
    done,
    history,
    error,
    submitAnswer,
  }
}
