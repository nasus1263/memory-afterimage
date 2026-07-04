import { useEffect, useRef, useState } from 'react'

interface Options {
  onEnd?: (text: string, tooShort: boolean) => void
}

export function useSpeechRecognition({ onEnd }: Options = {}) {
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
  const secondsRef = useRef(0)
  const barRefs = useRef<(HTMLSpanElement | null)[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const rafRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const onEndRef = useRef(onEnd)
  onEndRef.current = onEnd

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
      const tooShort = secondsRef.current < 2 || !transcriptRef.current.trim()
      onEndRef.current?.(transcriptRef.current.trim(), tooShort)
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

  async function start() {
    if (unsupported || listening) return
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
  }

  function stop() {
    if (!listening) return
    setListening(false)
    setProcessing(true)
    stopMeter()
    stopTimer()
    recognitionRef.current?.stop()
  }

  return {
    listening, processing, unsupported, micError,
    finalText, interimText, metered, seconds, barRefs,
    start, stop,
  }
}
