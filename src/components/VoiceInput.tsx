import { useEffect, useRef, useState } from 'react'

interface Props {
  onComplete: (text: string) => void
}

const BAR_COUNT = 56

function fmt(s: number) {
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

export function VoiceInput({ onComplete }: Props) {
  const [listening, setListening] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [unsupported, setUnsupported] = useState(false)
  const [micError, setMicError] = useState<string | null>(null)
  const [finalText, setFinalText] = useState('')
  const [interimText, setInterimText] = useState('')
  const [metered, setMetered] = useState(false)
  const [seconds, setSeconds] = useState(0)

  const recognitionRef = useRef<any>(null)
  const transcriptRef = useRef('')
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
      if (transcriptRef.current.trim()) onComplete(transcriptRef.current.trim())
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
    setSeconds(0)
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000)
  }

  function stopTimer() {
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = null
  }

  async function handleToggle() {
    if (unsupported) return

    if (!listening) {
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
    } else {
      setListening(false)
      setProcessing(true)
      stopMeter()
      stopTimer()
      recognitionRef.current?.stop()
    }
  }

  return (
    <div className="flex flex-col items-center w-full">
      {!listening ? (
        <button
          className="mic-button"
          aria-label="녹음 시작"
          onClick={handleToggle}
          disabled={unsupported || processing}
        />
      ) : (
        <button className="stop-button" aria-label="녹음 종료" onClick={handleToggle}>
          <span className="stop-square" />
        </button>
      )}

      {listening && (
        <>
          <div className={`wave-wrap ${metered ? 'live' : ''}`}>
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
          <p className="pane-desc">말씀이 끝나면 정지 버튼을 눌러주세요.</p>
        </>
      )}

      {!listening && !processing && <p className="pane-desc mt-2">버튼을 눌러 이야기를 시작해보세요.</p>}
      {processing && <p className="pane-desc mt-2 text-gold">처리 중...</p>}

      {unsupported && (
        <p className="notice error mt-3">
          이 브라우저는 음성 인식을 지원하지 않아요. 아래 텍스트 입력을 이용해주세요.
        </p>
      )}
      {micError && <p className="notice error mt-3">{micError}</p>}
    </div>
  )
}
