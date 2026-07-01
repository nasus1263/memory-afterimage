import { useEffect, useRef, useState } from 'react'

interface Props {
  onComplete: (text: string) => void
}

export function VoiceInput({ onComplete }: Props) {
  const [listening, setListening] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [unsupported, setUnsupported] = useState(false)
  const [micError, setMicError] = useState<string | null>(null)

  const recognitionRef = useRef<any>(null)
  const transcriptRef = useRef('')
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const rafRef = useRef(0)

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) { setUnsupported(true); return }

    const recognition = new SpeechRecognition()
    recognition.lang = 'ko-KR'
    recognition.continuous = true
    recognition.interimResults = true
    recognition.onresult = (e: any) => {
      let finalText = ''
      for (let i = 0; i < e.results.length; i++) {
        if (e.results[i].isFinal) finalText += e.results[i][0].transcript
      }
      transcriptRef.current = finalText
    }
    recognition.onend = () => {
      setProcessing(false)
      if (transcriptRef.current.trim()) onComplete(transcriptRef.current.trim())
    }
    recognitionRef.current = recognition

    return () => {
      recognition.stop()
      cancelAnimationFrame(rafRef.current)
      audioCtxRef.current?.close()
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function drawWaveform(stream: MediaStream) {
    const audioCtx = new AudioContext()
    const source = audioCtx.createMediaStreamSource(stream)
    const analyser = audioCtx.createAnalyser()
    analyser.fftSize = 256
    source.connect(analyser)
    audioCtxRef.current = audioCtx

    const data = new Uint8Array(analyser.frequencyBinCount)
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')

    function draw() {
      rafRef.current = requestAnimationFrame(draw)
      if (!canvas || !ctx) return
      analyser.getByteTimeDomainData(data)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.lineWidth = 2
      ctx.strokeStyle = '#c05050'
      ctx.beginPath()
      const slice = canvas.width / data.length
      let x = 0
      for (let i = 0; i < data.length; i++) {
        const v = data[i] / 128.0
        const y = (v * canvas.height) / 2
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
        x += slice
      }
      ctx.stroke()
    }
    draw()
  }

  function stopWaveform() {
    cancelAnimationFrame(rafRef.current)
    audioCtxRef.current?.close()
    audioCtxRef.current = null
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }

  async function handleToggle() {
    if (unsupported) return

    if (!listening) {
      setMicError(null)
      transcriptRef.current = ''
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        streamRef.current = stream
        drawWaveform(stream)
      } catch {
        setMicError('마이크 권한이 필요합니다')
        return
      }
      recognitionRef.current?.start()
      setListening(true)
    } else {
      setListening(false)
      setProcessing(true)
      stopWaveform()
      recognitionRef.current?.stop()
    }
  }

  return (
    <div className="voice-section">
      <p className="voice-guide">헤드폰을 끼고, 마이크 버튼을 누른 뒤 여행의 한 장면을 들려주세요</p>

      <button
        className={`mic-btn${listening ? ' mic-btn--listening' : ''}`}
        onClick={handleToggle}
        disabled={unsupported || processing}
      >
        🎙
      </button>

      {listening && <p className="listening-label">듣고 있어요...</p>}
      {processing && <p className="listening-label">처리 중...</p>}
      {listening && <canvas ref={canvasRef} className="waveform" width={320} height={80} />}

      {unsupported && <p className="voice-error">이 브라우저는 음성 인식을 지원하지 않습니다. 아래 텍스트 입력을 이용해주세요.</p>}
      {micError && <p className="voice-error">{micError}</p>}
    </div>
  )
}
