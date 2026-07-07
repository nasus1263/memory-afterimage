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
  const listeningRef = useRef(false)
  const transcriptRef = useRef('')
  const secondsRef = useRef(0)
  const barRefs = useRef<(HTMLSpanElement | null)[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  // 즉석 보이스 클로닝용: STT와 같은 마이크 스트림에서 발화 오디오를 녹음해 blob으로 보관.
  // GPT-SoVITS 참조 오디오로 쓰인다. STT(텍스트)와 별개로 "방금 말한 목소리" 자체가 필요.
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const recordedBlobRef = useRef<Blob | null>(null)
  const recordedMimeRef = useRef<string>('audio/webm')
  // stop() 시 recorder.onstop(비동기)이 최종 청크까지 flush하고 blob을 확정하면 resolve된다.
  // getRecordedBlob()이 이 Promise를 기다려 "잘린 참조"를 방지한다.
  const recordedReadyRef = useRef<Promise<Blob | null>>(Promise.resolve(null))
  const recordedResolveRef = useRef<(b: Blob | null) => void>(() => {})
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
      stopRecorder()
      cancelAnimationFrame(rafRef.current)
      if (timerRef.current) clearInterval(timerRef.current)
      audioCtxRef.current?.close()
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 브라우저가 wav 녹음을 지원하면 wav로(GPT-SoVITS librosa 로드가 가장 안정적),
  // 아니면 webm/opus로 폴백. 서버는 librosa로 디코딩하므로 둘 다 처리 가능.
  function pickRecorderMime(): string {
    const MR: any = (window as any).MediaRecorder
    if (MR?.isTypeSupported?.('audio/wav')) return 'audio/wav'
    if (MR?.isTypeSupported?.('audio/webm;codecs=opus')) return 'audio/webm;codecs=opus'
    if (MR?.isTypeSupported?.('audio/webm')) return 'audio/webm'
    return ''
  }

  function startRecorder(stream: MediaStream) {
    if (!('MediaRecorder' in window)) return
    try {
      const mime = pickRecorderMime()
      const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream)
      recordedMimeRef.current = recorder.mimeType || mime || 'audio/webm'
      chunksRef.current = []
      // 이번 녹음의 "완료 대기" Promise를 새로 건다. onstop에서 resolve.
      recordedReadyRef.current = new Promise<Blob | null>((resolve) => { recordedResolveRef.current = resolve })
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorder.onstop = () => {
        // onstop 시점엔 최종 dataavailable까지 모두 도착해 있다 → 온전한 blob 확정.
        const blob = chunksRef.current.length > 0
          ? new Blob(chunksRef.current, { type: recordedMimeRef.current })
          : null
        recordedBlobRef.current = blob
        // 트랙은 여기서(최종 flush 후) 정지해 마지막 청크 유실을 막는다.
        streamRef.current?.getTracks().forEach((t) => t.stop())
        streamRef.current = null
        recorderRef.current = null
        recordedResolveRef.current(blob)
      }
      // timeslice(1s): 녹음 중 주기적으로 청크를 flush 한다.
      recorder.start(1000)
      recorderRef.current = recorder
    } catch {
      // 녹음 실패는 STT 흐름을 막지 않는다 — 클로닝만 고정 참조로 폴백.
      recorderRef.current = null
    }
  }

  function stopRecorder() {
    const recorder = recorderRef.current
    if (recorder && recorder.state !== 'inactive') {
      // recorderRef는 여기서 null로 만들지 않는다 → onstop이 트랙 정지·정리를 마칠 때까지
      // stopMeter가 "recorder 살아있음"으로 보고 트랙을 미리 끊지 않게 하기 위함.
      try { recorder.stop() } catch { /* ignore */ }
    } else {
      recorderRef.current = null
    }
  }

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
    // recorder가 살아있으면 트랙 정지는 recorder.onstop이 최종 flush 후에 책임진다.
    // (여기서 미리 끊으면 마지막 청크가 유실되고 streamRef가 null이 돼 onstop이 트랙을 못 멈춘다.)
    if (!recorderRef.current) {
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
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
    if (unsupported || listeningRef.current) return
    setMicError(null)
    setFinalText('')
    setInterimText('')
    transcriptRef.current = ''
    recordedBlobRef.current = null
    try {
      // 클로닝 참조 품질을 위해 브라우저 오디오 전처리를 켠다. 마이크 잡음·에코가 참조에 섞이면
      // GPT-SoVITS가 그 잡음까지 음색으로 복제해 본래 목소리와 안 닮는다(Phase0 성공참조는 SNR~99dB,
      // 즉석 녹음은 27dB였음). autoGainControl로 과도한 게인(peak 0.99 근접)도 완화한다.
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          noiseSuppression: true,
          echoCancellation: true,
          autoGainControl: true,
        },
      })
      streamRef.current = stream
      startMeter(stream)
      startRecorder(stream)
    } catch {
      setMicError('마이크 권한이 필요해요. 브라우저 주소창의 마이크 아이콘을 눌러 허용해주세요.')
      return
    }
    try {
      recognitionRef.current?.start()
    } catch {
      // native recognition may still be finishing a prior stop() — ignore, UI stays consistent via listeningRef
      return
    }
    startTimer()
    listeningRef.current = true
    setListening(true)
  }

  function stop() {
    if (!listeningRef.current) return
    listeningRef.current = false
    setListening(false)
    setProcessing(true)
    // 트랙 정지(stopMeter)보다 먼저 녹음을 멈춰야 마지막 청크가 온전히 flush 된다.
    stopRecorder()
    stopMeter()
    stopTimer()
    recognitionRef.current?.stop()
  }

  // 마지막 발화의 녹음 blob(즉석 클로닝 참조용). 녹음 실패/미지원 시 null.
  // stop()의 recorder.onstop이 최종 청크까지 flush해 blob을 확정할 때까지 기다린 뒤 반환한다.
  // → "잘린 참조"(앞부분 소실·엉뚱한 목소리)를 방지.
  function getRecordedBlob(): Promise<Blob | null> {
    return recordedReadyRef.current
  }

  return {
    listening, processing, unsupported, micError,
    finalText, interimText, metered, seconds, barRefs,
    start, stop, getRecordedBlob,
  }
}
