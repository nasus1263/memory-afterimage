import { useEffect, useRef } from 'react'
import type { ApiKeys, AspectRatio, ModelConfig, PipelineState, StageStatus } from '../types'
import { refineMemo, generateImagePrompts } from '../services/llm'
import { generateTTS } from '../services/tts'
import { generateImages } from '../services/image'
import { fetchAmbientAudioWithRetry } from '../services/audio'
import { composeVideo, computeImageCount } from '../services/composer'
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
  secondsPerImage: number
  userImages: Blob[]
  showCaptions: boolean
  captionBgColor: string
  captionTextColor: string
  aspectRatio: AspectRatio
}

// 사용자 입력 이미지 우선, 생성 이미지와 교차 배치. 한쪽이 먼저 소진되면 남은 쪽을 그대로 이어붙임.
function interleaveImages(userBlobs: Blob[], generatedBlobs: Blob[]): Blob[] {
  const result: Blob[] = []
  const max = Math.max(userBlobs.length, generatedBlobs.length)
  for (let i = 0; i < max; i++) {
    if (i < userBlobs.length) result.push(userBlobs[i])
    if (i < generatedBlobs.length) result.push(generatedBlobs[i])
  }
  return result
}

const STAGES = ['refine', 'tts', 'image', 'audio', 'compose'] as const
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

export function Pipeline({
  userText, keys, config, state, setState, onProgress, composeProgress,
  secondsPerImage, userImages, showCaptions, captionBgColor, captionTextColor, aspectRatio,
}: Props) {
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
          if (durations[stage] != null) continue
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

        // ── 2. TTS / 오디오 병렬 (이미지 개수는 TTS 길이에 의존) ──
        currentStage = 'tts'
        markRunning('tts', 'audio')
        set(setState, stageStatus({ tts: 'running', audio: 'running' }))
        setMsg('tts', '음성 합성 요청...')
        setMsg('audio', `키워드: ${llmResult.audioKeyword}`)

        const ambientPromise = fetchAmbientAudioWithRetry(userText, llmResult.audioKeyword, config, keys, (msg) => setMsg('audio', msg))
          .finally(() => markDone('audio'))
        const ambBlobSafe = ambientPromise.then((v) => v, () => null)

        const ttsData = await generateTTS(llmResult.refinedText, config, keys)
          .then((r) => {
            setMsg('tts', `오디오 수신 완료 (${r.duration.toFixed(1)}s)`)
            return r
          }).finally(() => markDone('tts'))
        set(setState, { ...stageStatus({ tts: 'done' }), ttsBlob: ttsData.blob, ttsDuration: ttsData.duration, ttsAlignment: ttsData.alignment })

        // ── 3. 이미지 N장 생성 (사용자 입력 이미지가 있으면 부족분만 생성) ──
        currentStage = 'image'
        const imageCount = computeImageCount(ttsData.duration, secondsPerImage)
        const aiCount = Math.max(0, imageCount - userImages.length)
        markRunning('image')
        set(setState, stageStatus({ image: 'running' }))
        let imageBlobs: Blob[]
        if (aiCount === 0) {
          setMsg('image', `사용자 입력 이미지 사용 (${userImages.length}장)`)
          imageBlobs = userImages
        } else {
          setMsg('image', `이미지 ${aiCount}장 병렬 생성 중...`)
          const imagePrompts = await generateImagePrompts(llmResult.imagePrompt, aiCount, config, keys)
          set(setState, { imageMessages: new Array(aiCount).fill('대기 중...') })
          const generatedBlobs = await generateImages(imagePrompts, config, keys, (i, msg) => {
            setState((prev) => {
              const next = [...(prev.imageMessages ?? [])]
              next[i] = msg
              return { ...prev, imageMessages: next }
            })
          })
          imageBlobs = interleaveImages(userImages, generatedBlobs)
        }
        markDone('image')
        set(setState, { ...stageStatus({ image: 'done' }), imageBlobs })

        currentStage = 'audio'
        const ambBlob = await ambBlobSafe
        set(setState, { ...stageStatus({ audio: ambBlob ? 'done' : 'error' }), ambientBlob: ambBlob ?? undefined })
        if (!ambBlob) setMsg('audio', '오디오 없음 (건너뜀)')

        // ── 4. ffmpeg 합성 ────────────────────────────
        currentStage = 'compose'
        markRunning('compose')
        set(setState, stageStatus({ compose: 'running' }))
        setMsg('compose', 'ffmpeg.wasm 로드 중...')
        const finalBlob = await composeVideo(
          imageBlobs, ttsData.blob, ambBlob, ttsData.duration,
          onProgress,
          (msg) => setMsg('compose', msg),
          showCaptions ? { text: llmResult.refinedText, bgColor: captionBgColor, textColor: captionTextColor } : null,
          aspectRatio,
          ttsData.alignment
        )
        setMsg('compose', '완료')
        set(setState, { ...stageStatus({ compose: 'done' }), finalBlob })
        markDone('compose')
      } catch (e: any) {
        const msg = e?.message ?? String(e)
        console.error(`[Pipeline] ${currentStage} 단계 오류`, e)
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
          <StageCard
            key={s}
            stage={s}
            status={state[s]}
            message={state.messages[s]}
            durationMs={state.durations[s]}
            subitems={s === 'image' ? state.imageMessages : undefined}
          />
        ))}
      </div>
      {state.compose === 'running' && composeProgress > 0 && (
        <div className="flex flex-col gap-1">
          <div className="h-1 bg-border rounded-full overflow-hidden">
            <div className="h-full bg-gold rounded-full transition-[width] duration-300 ease-out" style={{ width: `${composeProgress}%` }} />
          </div>
          <span className="block text-base text-text-dim text-right">{composeProgress}%</span>
        </div>
      )}
      {state.error && (
        <p className="notice error">오류: {state.error}</p>
      )}
    </div>
  )
}
