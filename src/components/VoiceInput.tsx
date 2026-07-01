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
    <div className="flex flex-col items-center text-center gap-2 pt-10 pb-2">
      <p className="text-text-dim text-sm max-w-[420px]">헤드폰을 끼고, 마이크 버튼을 누른 뒤 여행의 한 장면을 들려주세요</p>

      <button
        className={`w-[140px] h-[140px] rounded-full border-2 text-5xl mt-8 flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
          listening
            ? 'border-error bg-error/15 text-error animate-pulse-red'
            : 'border-border bg-surface2 text-text hover:border-gold-dim'
        }`}
        onClick={handleToggle}
        disabled={unsupported || processing}
      >
        🎙
      </button>

      {listening && <p className="text-error text-sm font-medium mt-1">듣고 있어요...</p>}
      {processing && <p className="text-error text-sm font-medium mt-1">처리 중...</p>}
      {listening && <canvas ref={canvasRef} className="mt-3" width={320} height={80} />}

      {unsupported && (
        <p className="text-error text-xs mt-2.5 max-w-[360px]">
          이 브라우저는 음성 인식을 지원하지 않습니다. 아래 텍스트 입력을 이용해주세요.
        </p>
      )}
      {micError && <p className="text-error text-xs mt-2.5 max-w-[360px]">{micError}</p>}
    </div>
  )
}
