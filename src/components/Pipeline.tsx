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

export function Pipeline({ userText, keys, config, state, setState, onProgress, composeProgress }: Props) {
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return
    ran.current = true

    async function run() {
      try {
        set(setState, stageStatus({ refine: 'running' }))
        const llmResult = await refineMemo(userText, config, keys)
        set(setState, { ...stageStatus({ refine: 'done' }), llmResult })

        set(setState, stageStatus({ tts: 'running', image: 'running', audio: 'running' }))
        const [ttsSettled, imgSettled, ambSettled] = await Promise.allSettled([
          generateTTS(llmResult.refinedText, config, keys),
          generateImage(llmResult.imagePrompt, config, keys),
          fetchAmbientAudio(llmResult.audioKeywords, config, keys),
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

        set(setState, stageStatus({ imgToVid: 'running' }))
        const videoBlob = await generateVideo(imgBlob, llmResult.imagePrompt, config, keys)
        set(setState, { ...stageStatus({ imgToVid: 'done' }), videoBlob })

        set(setState, stageStatus({ compose: 'running' }))
        const finalBlob = await composeVideo(videoBlob, ttsData.blob, ambBlob, ttsData.duration, onProgress)
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
          <StageCard key={s} stage={s} status={state[s]} />
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
