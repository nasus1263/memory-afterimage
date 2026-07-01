import { useEffect, useRef, useState } from 'react'

interface Props {
  onComplete: (text: string) => void
  onListeningChange?: (listening: boolean) => void
}

const BAR_COUNT = 56

function fmt(s: number) {
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

export function VoiceInput({ onComplete, onListeningChange }: Props) {
  const [listening, setListening] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [unsupported, setUnsupported] = useState(false)
  const [micError, setMicError] = useState<string | null>(null)
  const [finalText, setFinalText] = useState('')
  const [interimText, setInterimText] = useState('')
  const [metered, setMetered] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [showRetry, setShowRetry] = useState(false)

  const recognitionRef = useRef<any>(null)
  const transcriptRef = useRef('')
  const secondsRef = useRef(0)
  const barRefs = useRef<(HTMLSpanElement | null)[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const rafRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) { setUnsupported(true); return }

    const recognition = new SpeechRecognition()
    recognition.lang = 'ko-KR'
    recognition.continuous = true
    recognition.interimResults = true
    recognition.onresult = (e: any) => {
      let final = ''
      let interim = ''
      for (let i = 0; i < e.results.length; i++) {
        const t = e.results[i][0].transcript
        if (e.results[i].isFinal) final += t
        else interim += t
      }
      transcriptRef.current = final
      setFinalText(final)
      setInterimText(interim)
    }
    recognition.onend = () => {
      setProcessing(false)
      if (secondsRef.current < 2 || !transcriptRef.current.trim()) {
        setShowRetry(true)
        return
      }
      onComplete(transcriptRef.current.trim())
    }
    recognitionRef.current = recognition

    return () => {
      recognition.stop()
      cancelAnimationFrame(rafRef.current)
      if (timerRef.current) clearInterval(timerRef.current)
      audioCtxRef.current?.close()
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function startMeter(stream: MediaStream) {
    const audioCtx = new AudioContext()
    const source = audioCtx.createMediaStreamSource(stream)
    const analyser = audioCtx.createAnalyser()
    analyser.fftSize = 256
    source.connect(analyser)
    audioCtxRef.current = audioCtx

    const data = new Uint8Array(analyser.frequencyBinCount)

    function loop() {
      rafRef.current = requestAnimationFrame(loop)
      analyser.getByteFrequencyData(data)
      const bars = barRefs.current
      for (let i = 0; i < bars.length; i++) {
        const idx = Math.floor((i / bars.length) * data.length)
        const v = data[idx] / 255
        const bar = bars[i]
        if (bar) bar.style.transform = `scaleY(${0.3 + v * 2.4})`
      }
    }
    loop()
    setMetered(true)
  }

  function stopMeter() {
    cancelAnimationFrame(rafRef.current)
    audioCtxRef.current?.close()
    audioCtxRef.current = null
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    setMetered(false)
  }

  function startTimer() {
    secondsRef.current = 0
    setSeconds(0)
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      secondsRef.current += 1
      setSeconds(secondsRef.current)
    }, 1000)
  }

  function stopTimer() {
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = null
  }

  async function handleToggle() {
    if (unsupported) return

    if (!listening) {
      setShowRetry(false)
      setMicError(null)
      setFinalText('')
      setInterimText('')
      transcriptRef.current = ''
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        streamRef.current = stream
        startMeter(stream)
      } catch {
        setMicError('마이크 권한이 필요합니다')
        return
      }
      recognitionRef.current?.start()
      startTimer()
      setListening(true)
      onListeningChange?.(true)
    } else {
      setListening(false)
      onListeningChange?.(false)
      setProcessing(true)
      stopMeter()
      stopTimer()
      recognitionRef.current?.stop()
    }
  }

  function closeRetry() {
    setShowRetry(false)
  }

  if (listening) {
    return (
      <div className="listening-screen" aria-live="polite">
        <p className="step-label">02 LISTENING</p>
        <h2>듣고 있어요...</h2>
        <p className="listening-desc">여행의 한 장면을 자유롭게 들려주세요.</p>

        <div className={`wave-wrap ${metered ? 'live' : ''}`} aria-hidden="true">
          {Array.from({ length: BAR_COUNT }).map((_, i) => (
            <span
              key={i}
              ref={(el) => { barRefs.current[i] = el }}
              className="bar"
              style={{ height: `${14 + Math.abs(Math.sin(i * 0.45)) * 50 + (i % 7) * 4}px` }}
            />
          ))}
        </div>

        <div className="live-transcript" aria-live="polite">
          {finalText}
          <span className="interim">{interimText}</span>
        </div>
        <p className="timer">{fmt(seconds)}</p>

        <button className="stop-button" aria-label="녹음 종료" onClick={handleToggle}>
          <span className="stop-square" />
        </button>
        <p className="record-help">말씀이 끝나면 정지 버튼을 눌러주세요.</p>
      </div>
    )
  }

  return (
    <>
      <div className="voice-zone">
        <div className="mic-wrap">
          <span className="ring one" />
          <span className="ring two" />
          <span className="ring three" />
          <button
            className="mic-button"
            aria-label="녹음 시작"
            onClick={handleToggle}
            disabled={unsupported || processing}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 14a4 4 0 0 0 4-4V6a4 4 0 0 0-8 0v4a4 4 0 0 0 4 4Z" />
              <path d="M19 10a7 7 0 0 1-14 0" />
              <path d="M12 17v4" />
              <path d="M8 21h8" />
            </svg>
          </button>
        </div>
        <h2>음성으로 기억 말하기</h2>
        {!processing && <p>눌러서 오늘의 순간을 들려주세요</p>}
        {processing && <p className="text-gold">처리 중...</p>}
      </div>

      {unsupported && (
        <p className="notice error mt-3">
          이 브라우저는 음성 인식을 지원하지 않아요. 아래 텍스트 입력을 이용해주세요.
        </p>
      )}
      {micError && <p className="notice error mt-3">{micError}</p>}

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
              <button className="retry-record-button" type="button" onClick={() => { closeRetry(); handleToggle() }}>
                다시 시도하기
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
