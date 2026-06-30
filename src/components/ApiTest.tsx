import { useState } from 'react'
import type { ApiKeys, ModelConfig } from '../types'
import { refineMemo } from '../services/llm'
import { generateTTS } from '../services/tts'
import { generateImage } from '../services/image'
import { fetchAmbientAudio } from '../services/audio'
import { generateVideo } from '../services/imgToVid'
import { composeVideo } from '../services/composer'
import {
  getDummyImage, getDummyVideo, getDummyAudio,
  DUMMY_TEXT, DUMMY_TTS_TEXT, DUMMY_IMAGE_PROMPT, DUMMY_AUDIO_KEYWORDS,
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
    <div className={`test-row test-${state.status}`}>
      <div className="test-row-left">
        <span className="test-icon">{STATUS_ICON[state.status]}</span>
        <span className="test-label">{label}</span>
        {state.msg && <span className="test-msg">{state.msg}</span>}
      </div>
      <button
        className="test-btn"
        onClick={onRun}
        disabled={state.status === 'running'}
      >
        {state.status === 'running' ? '실행 중...' : '테스트'}
      </button>
      {state.text && (
        <pre className="test-result-text">{state.text}</pre>
      )}
      {state.url && state.mime?.startsWith('image') && (
        <img className="test-result-media" src={state.url} alt="test result" />
      )}
      {state.url && state.mime?.startsWith('audio') && (
        <audio className="test-result-media" src={state.url} controls />
      )}
      {state.url && state.mime?.startsWith('video') && (
        <video className="test-result-media" src={state.url} controls loop />
      )}
    </div>
  )
}

export function ApiTest({ keys, config }: Props) {
  const [llm, setLlm] = useState<StageState>(INIT)
  const [tts, setTts] = useState<StageState>(INIT)
  const [image, setImage] = useState<StageState>(INIT)
  const [audio, setAudio] = useState<StageState>(INIT)
  const [video, setVideo] = useState<StageState>(INIT)
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
    <div className="api-test">
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
            setMsg(`키워드: ${DUMMY_AUDIO_KEYWORDS.join(', ')}`)
            return fetchAmbientAudio(DUMMY_AUDIO_KEYWORDS, config, keys, setMsg)
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
        label="img→vid (더미 이미지 입력)"
        state={video}
        onRun={() =>
          run(setVideo, async (setMsg) => {
            setMsg('더미 이미지 생성...')
            const imgBlob = await getDummyImage()
            setMsg('비디오 생성 요청...')
            return generateVideo(imgBlob, DUMMY_IMAGE_PROMPT, config, keys, setMsg)
          }, (blob, set) => {
            set({
              status: 'done',
              msg: `완료 (${(blob.size / 1024).toFixed(0)} KB)`,
              url: blobUrl(blob),
              mime: blob.type || 'video/mp4',
            })
          })
        }
      />

      <TestRow
        label="최종 합성 (더미 비디오·오디오)"
        state={compose}
        onRun={() =>
          run(setCompose, async (setMsg) => {
            setMsg('더미 소스 생성...')
            const [vidBlob] = await Promise.all([getDummyVideo()])
            const ttsBlob = getDummyAudio(5)
            setMsg('ffmpeg 합성...')
            return composeVideo(vidBlob, ttsBlob, null, 5, undefined, setMsg)
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
