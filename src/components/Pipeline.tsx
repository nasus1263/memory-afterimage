import { useEffect, useRef } from 'react'
import type { ApiKeys, ModelConfig, PipelineState, StageStatus } from '../types'
import { refineMemo } from '../services/llm'
import { generateTTS } from '../services/tts'
import { generateImage } from '../services/image'
import { generateVideo } from '../services/imgToVid'
import { fetchAmbientAudio } from '../services/audio'
import { composeVideo } from '../services/composer'
import { StageCard } from './StageCard'

type SetState = React.Dispatch<React.SetStateAction<PipelineState>>

interface Props {
  userText: string
  keys: ApiKeys
  config: ModelConfig
  state: PipelineState
  setState: SetState
  onProgress: (p: number) => void
  composeProgress: number
}

const STAGES = ['refine', 'tts', 'image', 'audio', 'imgToVid', 'compose'] as const
type Stage = typeof STAGES[number]

function set(setState: SetState, patch: Partial<PipelineState>) {
  setState((prev) => ({ ...prev, ...patch }))
}

function stageStatus(patch: Partial<Record<Stage, StageStatus>>): Partial<PipelineState> {
  return patch as Partial<PipelineState>
}

function makeSetMsg(setState: SetState) {
  return (stage: Stage, msg: string) => {
    setState((prev) => ({ ...prev, messages: { ...prev.messages, [stage]: msg } }))
  }
}

export function Pipeline({ userText, keys, config, state, setState, onProgress, composeProgress }: Props) {
  const ran = useRef(false)
  const startTimes = useRef<Partial<Record<Stage, number>>>({})

  useEffect(() => {
    if (ran.current) return
    ran.current = true

    const setMsg = makeSetMsg(setState)

    function markRunning(...stages: Stage[]) {
      const now = performance.now()
      for (const stage of stages) startTimes.current[stage] = now
    }

    function markDone(...stages: Stage[]) {
      const now = performance.now()
      setState((prev) => {
        const durations = { ...prev.durations }
        for (const stage of stages) {
          const start = startTimes.current[stage]
          if (start != null) durations[stage] = now - start
        }
        return { ...prev, durations }
      })
    }

    async function run() {
      let currentStage: Stage = 'refine'
      try {
        // ── 1. LLM 다듬기 ──────────────────────────────
        currentStage = 'refine'
        markRunning('refine')
        set(setState, stageStatus({ refine: 'running' }))
        setMsg('refine', 'API 요청 전송...')
        const llmResult = await refineMemo(userText, config, keys)
        setMsg('refine', `완료 (${llmResult.refinedText.length}자)`)
        set(setState, { ...stageStatus({ refine: 'done' }), llmResult })
        markDone('refine')

        // ── 2. TTS / 이미지 / 오디오 병렬 ──────────────
        currentStage = 'tts'
        markRunning('tts', 'image', 'audio')
        set(setState, stageStatus({ tts: 'running', image: 'running', audio: 'running' }))
        setMsg('tts', '음성 합성 요청...')
        setMsg('image', '이미지 생성 요청...')
        setMsg('audio', `키워드: ${llmResult.audioKeywords.join(', ')}`)

        const [ttsSettled, imgSettled, ambSettled] = await Promise.allSettled([
          generateTTS(llmResult.refinedText, config, keys).then((r) => {
            setMsg('tts', `오디오 수신 완료 (${r.duration.toFixed(1)}s)`)
            return r
          }),
          generateImage(llmResult.imagePrompt, config, keys, (msg) => setMsg('image', msg)),
          fetchAmbientAudio(llmResult.audioKeywords, config, keys, (msg) => setMsg('audio', msg)),
        ])

        if (ttsSettled.status === 'rejected') throw new Error(`TTS: ${ttsSettled.reason}`)
        if (imgSettled.status === 'rejected') throw new Error(`Image: ${imgSettled.reason}`)

        const ttsData = ttsSettled.value
        const imgBlob = imgSettled.value
        const ambBlob = ambSettled.status === 'fulfilled' ? ambSettled.value : null

        set(setState, {
          ...stageStatus({ tts: 'done', image: 'done', audio: ambBlob ? 'done' : 'error' }),
          ttsBlob: ttsData.blob,
          ttsDuration: ttsData.duration,
          imageBlob: imgBlob,
          ambientBlob: ambBlob ?? undefined,
        })
        if (!ambBlob) setMsg('audio', '오디오 없음 (건너뜀)')
        markDone('tts', 'image', 'audio')

        // ── 3. img → vid ──────────────────────────────
        currentStage = 'imgToVid'
        markRunning('imgToVid')
        set(setState, stageStatus({ imgToVid: 'running' }))
        setMsg('imgToVid', '비디오 생성 요청...')
        const videoBlob = await generateVideo(
          imgBlob, llmResult.imagePrompt, config, keys,
          (msg) => setMsg('imgToVid', msg)
        )
        setMsg('imgToVid', '완료')
        set(setState, { ...stageStatus({ imgToVid: 'done' }), videoBlob })
        markDone('imgToVid')

        // ── 4. ffmpeg 합성 ────────────────────────────
        currentStage = 'compose'
        markRunning('compose')
        set(setState, stageStatus({ compose: 'running' }))
        setMsg('compose', 'ffmpeg.wasm 로드 중...')
        const finalBlob = await composeVideo(
          videoBlob, ttsData.blob, ambBlob, ttsData.duration,
          onProgress,
          (msg) => setMsg('compose', msg)
        )
        setMsg('compose', '완료')
        set(setState, { ...stageStatus({ compose: 'done' }), finalBlob })
        markDone('compose')
      } catch (e: any) {
        const msg = e?.message ?? String(e)
        set(setState, { [currentStage]: 'error' as StageStatus, error: msg })
        setMsg(currentStage, `오류: ${msg}`)
        markDone(currentStage)
      }
    }

    run()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        {STAGES.map((s) => (
          <StageCard key={s} stage={s} status={state[s]} message={state.messages[s]} durationMs={state.durations[s]} />
        ))}
      </div>
      {state.compose === 'running' && composeProgress > 0 && (
        <div className="flex flex-col gap-1">
          <div className="h-1 bg-border rounded-full overflow-hidden">
            <div className="h-full bg-gold rounded-full transition-[width] duration-300 ease-out" style={{ width: `${composeProgress}%` }} />
          </div>
          <span className="block text-[11px] text-text-dim text-right">{composeProgress}%</span>
        </div>
      )}
      {state.error && (
        <p className="text-error text-[13px] py-2.5 px-3.5 bg-error/10 border border-error/30 rounded">오류: {state.error}</p>
      )}
    </div>
  )
}
