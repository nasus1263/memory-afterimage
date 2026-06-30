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

  useEffect(() => {
    if (ran.current) return
    ran.current = true

    const setMsg = makeSetMsg(setState)

    async function run() {
      try {
        // ── 1. LLM 다듬기 ──────────────────────────────
        set(setState, stageStatus({ refine: 'running' }))
        setMsg('refine', 'API 요청 전송...')
        const llmResult = await refineMemo(userText, config, keys)
        setMsg('refine', `완료 (${llmResult.refinedText.length}자)`)
        set(setState, { ...stageStatus({ refine: 'done' }), llmResult })

        // ── 2. TTS / 이미지 / 오디오 병렬 ──────────────
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

        // ── 3. img → vid ──────────────────────────────
        set(setState, stageStatus({ imgToVid: 'running' }))
        setMsg('imgToVid', '비디오 생성 요청...')
        const videoBlob = await generateVideo(
          imgBlob, llmResult.imagePrompt, config, keys,
          (msg) => setMsg('imgToVid', msg)
        )
        setMsg('imgToVid', '완료')
        set(setState, { ...stageStatus({ imgToVid: 'done' }), videoBlob })

        // ── 4. ffmpeg 합성 ────────────────────────────
        set(setState, stageStatus({ compose: 'running' }))
        setMsg('compose', 'ffmpeg.wasm 로드 중...')
        const finalBlob = await composeVideo(
          videoBlob, ttsData.blob, ambBlob, ttsData.duration,
          onProgress,
          (msg) => setMsg('compose', msg)
        )
        setMsg('compose', '완료')
        set(setState, { ...stageStatus({ compose: 'done' }), finalBlob })
      } catch (e: any) {
        const msg = e?.message ?? String(e)
        const failStage = (
          ['refine', 'tts', 'image', 'imgToVid', 'compose'] as Stage[]
        ).find((s) => msg.toLowerCase().startsWith(s.toLowerCase())) ?? 'compose'
        set(setState, { [failStage]: 'error' as StageStatus, error: msg })
      }
    }

    run()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="pipeline">
      <div className="stages">
        {STAGES.map((s) => (
          <StageCard key={s} stage={s} status={state[s]} message={state.messages[s]} />
        ))}
      </div>
      {state.compose === 'running' && composeProgress > 0 && (
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${composeProgress}%` }} />
          <span className="progress-label">{composeProgress}%</span>
        </div>
      )}
      {state.error && (
        <p className="error-msg">오류: {state.error}</p>
      )}
    </div>
  )
}
