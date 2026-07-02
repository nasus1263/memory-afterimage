import { useState } from 'react'
import type { ApiKeys, ModelConfig } from '../types'
import { refineMemo } from '../services/llm'
import { generateTTS } from '../services/tts'
import { generateImage } from '../services/image'
import { fetchAmbientAudio } from '../services/audio'
import { composeVideo, computeImageCount } from '../services/composer'
import {
  getDummyImage, getDummyAudio,
  DUMMY_TEXT, DUMMY_TTS_TEXT, DUMMY_IMAGE_PROMPT, DUMMY_AUDIO_KEYWORD,
} from '../services/debug'

interface Props {
  keys: ApiKeys
  config: ModelConfig
}

type TestStatus = 'idle' | 'running' | 'done' | 'error'

interface StageState {
  status: TestStatus
  msg: string
  url?: string
  mime?: string
  text?: string
}

const INIT: StageState = { status: 'idle', msg: '' }

const STATUS_ICON: Record<TestStatus, string> = {
  idle: '○', running: '◌', done: '●', error: '✕',
}

const STATUS_STYLE: Record<TestStatus, string> = {
  idle: 'border-border opacity-60',
  running: 'border-running',
  done: 'border-success',
  error: 'border-error text-error',
}

function TestRow({
  label,
  state,
  onRun,
}: {
  label: string
  state: StageState
  onRun: () => void
}) {
  return (
    <div className={`border rounded py-2.5 px-3 flex flex-col gap-1.5 text-sm ${STATUS_STYLE[state.status]}`}>
      <div className="flex items-center gap-2.5 flex-wrap">
        <span className={`w-4 text-center shrink-0 ${state.status === 'running' ? 'inline-block animate-spin' : ''}`}>
          {STATUS_ICON[state.status]}
        </span>
        <span className="font-medium">{label}</span>
        {state.msg && <span className="text-[11px] text-text-dim ml-1">{state.msg}</span>}
      </div>
      <button
        className="ml-auto bg-transparent border border-gold-dim text-gold-dim rounded-sm py-1 px-3 text-xs whitespace-nowrap cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed enabled:hover:border-gold enabled:hover:text-gold"
        onClick={onRun}
        disabled={state.status === 'running'}
      >
        {state.status === 'running' ? '실행 중...' : '테스트'}
      </button>
      {state.text && (
        <pre className="text-[11px] text-text-dim bg-white/[0.04] rounded-sm p-2 overflow-x-auto whitespace-pre-wrap break-all m-0 max-h-40 overflow-y-auto">{state.text}</pre>
      )}
      {state.url && state.mime?.startsWith('image') && (
        <img className="w-full max-h-[200px] rounded-sm object-contain bg-black" src={state.url} alt="test result" />
      )}
      {state.url && state.mime?.startsWith('audio') && (
        <audio className="w-full max-h-[200px] rounded-sm" src={state.url} controls />
      )}
      {state.url && state.mime?.startsWith('video') && (
        <video className="w-full max-h-[200px] rounded-sm object-contain bg-black" src={state.url} controls loop />
      )}
    </div>
  )
}

export function ApiTest({ keys, config }: Props) {
  const [llm, setLlm] = useState<StageState>(INIT)
  const [tts, setTts] = useState<StageState>(INIT)
  const [image, setImage] = useState<StageState>(INIT)
  const [audio, setAudio] = useState<StageState>(INIT)
  const [compose, setCompose] = useState<StageState>(INIT)

  async function run<T>(
    set: React.Dispatch<React.SetStateAction<StageState>>,
    task: (setMsg: (m: string) => void) => Promise<T>,
    onDone: (result: T, set: React.Dispatch<React.SetStateAction<StageState>>) => void
  ) {
    set({ status: 'running', msg: '시작...' })
    const setMsg = (msg: string) => set((p) => ({ ...p, msg }))
    try {
      const result = await task(setMsg)
      onDone(result, set)
    } catch (e: any) {
      set({ status: 'error', msg: e?.message ?? String(e) })
    }
  }

  function blobUrl(blob: Blob): string {
    return URL.createObjectURL(blob)
  }

  return (
    <div className="flex flex-col gap-2">
      <TestRow
        label="LLM — 본문 다듬기"
        state={llm}
        onRun={() =>
          run(setLlm, async (setMsg) => {
            setMsg(`"${DUMMY_TEXT}" 전송...`)
            return refineMemo(DUMMY_TEXT, config, keys)
          }, (result, set) => {
            set({
              status: 'done',
              msg: '완료',
              text: JSON.stringify(result, null, 2),
            })
          })
        }
      />

      <TestRow
        label="TTS — 음성 합성"
        state={tts}
        onRun={() =>
          run(setTts, async (setMsg) => {
            setMsg('음성 합성 요청...')
            return generateTTS(DUMMY_TTS_TEXT, config, keys)
          }, (result, set) => {
            set({
              status: 'done',
              msg: `완료 (${result.duration.toFixed(1)}s)`,
              url: blobUrl(result.blob),
              mime: result.blob.type || 'audio/mpeg',
            })
          })
        }
      />

      <TestRow
        label="이미지 생성"
        state={image}
        onRun={() =>
          run(setImage, async (setMsg) => {
            return generateImage(DUMMY_IMAGE_PROMPT, config, keys, setMsg)
          }, (blob, set) => {
            set({
              status: 'done',
              msg: `완료 (${(blob.size / 1024).toFixed(0)} KB)`,
              url: blobUrl(blob),
              mime: 'image/png',
            })
          })
        }
      />

      <TestRow
        label="오디오 검색"
        state={audio}
        onRun={() =>
          run(setAudio, async (setMsg) => {
            setMsg(`키워드: ${DUMMY_AUDIO_KEYWORD}`)
            return fetchAmbientAudio(DUMMY_AUDIO_KEYWORD, config, keys, setMsg)
          }, (blob, set) => {
            if (!blob) {
              set({ status: 'error', msg: 'API 키 없음 또는 결과 없음' })
              return
            }
            set({
              status: 'done',
              msg: `완료 (${(blob.size / 1024).toFixed(0)} KB)`,
              url: blobUrl(blob),
              mime: blob.type || 'audio/mpeg',
            })
          })
        }
      />

      <TestRow
        label="최종 합성 (더미 이미지·오디오)"
        state={compose}
        onRun={() =>
          run(setCompose, async (setMsg) => {
            setMsg('더미 소스 생성...')
            const imageCount = computeImageCount(5)
            const imgBlobs = await Promise.all(Array.from({ length: imageCount }, () => getDummyImage()))
            const ttsBlob = getDummyAudio(5)
            setMsg('ffmpeg 합성...')
            return composeVideo(imgBlobs, ttsBlob, null, 5, undefined, setMsg)
          }, (blob, set) => {
            set({
              status: 'done',
              msg: `완료 (${(blob.size / 1024).toFixed(0)} KB)`,
              url: blobUrl(blob),
              mime: 'video/mp4',
            })
          })
        }
      />
    </div>
  )
}
