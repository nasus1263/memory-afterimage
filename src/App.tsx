import { useState, useCallback, useEffect, useMemo } from 'react'
import type { ApiKeys, ModelConfig, PipelineState } from './types'
import { loadKeys, saveKeys, loadConfig, saveConfig } from './store/settings'
import { isDebugMode } from './services/debug'
import { Settings } from './components/Settings'
import { Pipeline } from './components/Pipeline'
import { VoiceInput } from './components/VoiceInput'
import { Memories } from './components/Memories'
import { saveMemory } from './services/memories'

const IDLE_PIPELINE: PipelineState = {
  refine: 'idle', tts: 'idle', image: 'idle',
  audio: 'idle', imgToVid: 'idle', compose: 'idle',
  messages: {},
  durations: {},
}

function useRoute() {
  const [path, setPath] = useState(() => window.location.pathname)

  useEffect(() => {
    const onPopState = () => setPath(window.location.pathname)
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const navigate = useCallback((to: string) => {
    window.history.pushState({}, '', to)
    setPath(to)
  }, [])

  return { path, navigate }
}

export default function App() {
  const { path, navigate } = useRoute()
  const [keys, setKeys] = useState<ApiKeys>(loadKeys)
  const [config, setConfig] = useState<ModelConfig>(loadConfig)
  const [inputMode, setInputMode] = useState<'voice' | 'text'>('voice')
  const [userText, setUserText] = useState('')
  const [pipelineState, setPipelineState] = useState<PipelineState>(IDLE_PIPELINE)
  const [composeProgress, setComposeProgress] = useState(0)
  const debugActive = isDebugMode()

  useEffect(() => {
    const visited = localStorage.getItem('memory_visited')
    if (!visited) {
      localStorage.setItem('memory_visited', '1')
      navigate('/settings')
    }
  }, [navigate])

  useEffect(() => {
    if (path === '/process' && !userText.trim()) navigate('/')
  }, [path, userText, navigate])

  useEffect(() => {
    if (pipelineState.finalBlob) {
      saveMemory({ text: userText, video: pipelineState.finalBlob, createdAt: Date.now() })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pipelineState.finalBlob])

  function handleKeys(k: ApiKeys) { setKeys(k); saveKeys(k) }
  function handleConfig(c: ModelConfig) { setConfig(c); saveConfig(c) }

  const handleProgress = useCallback((p: number) => setComposeProgress(p), [])

  function startProcess(text: string) {
    setUserText(text)
    setComposeProgress(0)
    setPipelineState(IDLE_PIPELINE)
    navigate('/process')
  }

  function handleSubmit() {
    if (!userText.trim()) return
    startProcess(userText)
  }

  function handleReset() {
    setUserText('')
    setInputMode('voice')
    setPipelineState(IDLE_PIPELINE)
    setComposeProgress(0)
    navigate('/')
  }

  const finalBlob = pipelineState.finalBlob
  const finalUrl = useMemo(() => (finalBlob ? URL.createObjectURL(finalBlob) : null), [finalBlob])
  useEffect(() => () => { if (finalUrl) URL.revokeObjectURL(finalUrl) }, [finalUrl])

  return (
    <div className="max-w-[860px] mx-auto px-5">
      {debugActive && (
        <div className="bg-running/10 border-b border-running/30 text-running text-xs tracking-wide text-center py-1.5 px-5">
          🛠 디버그 모드 — 이미지·동영상 API 미호출 (더미 파일)
        </div>
      )}
      <header className="flex items-center justify-between flex-wrap gap-3 py-8 pb-5 border-b border-border">
        <button className="bg-transparent border-none p-0 cursor-pointer text-left" onClick={() => navigate('/')}>
          <h1 className="text-2xl md:text-3xl font-bold tracking-wide text-gold">기억의 잔상</h1>
          <p className="text-text-dim text-xs mt-1">말하면 되살아나는 내 여행의 기억</p>
        </button>
        <div className="flex items-center gap-2">
          <button
            className={`bg-transparent border rounded px-3.5 py-1.5 text-sm transition-colors ${
              path === '/memories'
                ? 'border-gold-dim text-gold'
                : 'border-border text-text-dim hover:border-gold-dim hover:text-gold'
            }`}
            onClick={() => navigate(path === '/memories' ? '/' : '/memories')}
          >
            보관함
          </button>
          <button
            className={`bg-transparent border rounded px-3.5 py-1.5 text-sm transition-colors ${
              debugActive
                ? 'border-running text-running'
                : 'border-border text-text-dim hover:border-gold-dim hover:text-gold'
            }`}
            onClick={() => navigate(path === '/settings' ? '/' : '/settings')}
          >
            {path === '/settings' ? '✕ 닫기' : '⚙ 설정'}
          </button>
        </div>
      </header>

      {path === '/settings' && (
        <div className="bg-surface border border-border rounded-md my-3 p-5">
          <Settings keys={keys} config={config} onKeys={handleKeys} onConfig={handleConfig} />
        </div>
      )}

      {path === '/memories' && <Memories />}

      {path === '/process' && (
        <main className="py-8">
          <div className="flex flex-col gap-5">
            <div className="bg-surface border border-border rounded-md py-3.5 px-4">
              <span className="block text-[11px] tracking-wider uppercase text-text-dim mb-2">입력한 기억</span>
              <p className="text-text-dim text-[13px]">{userText}</p>
            </div>

            {pipelineState.llmResult && (
              <div className="bg-surface border border-border rounded-md py-3.5 px-4">
                <span className="block text-[11px] tracking-wider uppercase text-text-dim mb-2">다듬어진 나레이션</span>
                <p className="text-text text-sm leading-loose">{pipelineState.llmResult.refinedText}</p>
              </div>
            )}

            {!finalUrl && !pipelineState.error && (
              <div className="flex flex-col items-center gap-3.5 py-5 text-center">
                <div
                  className="w-18 h-18 rounded-full blur-md animate-bleed bg-[length:200%_200%]"
                  style={{ backgroundImage: 'radial-gradient(circle at 30% 30%, var(--color-gold), var(--color-running), var(--color-gold-dim))' }}
                />
                <p className="text-gold text-[15px] font-medium">당신의 기억을 그리는 중입니다...</p>
              </div>
            )}

            <Pipeline
              userText={userText}
              keys={keys}
              config={config}
              state={pipelineState}
              setState={setPipelineState}
              onProgress={handleProgress}
              composeProgress={composeProgress}
            />

            {finalUrl && (
              <div className="flex flex-col gap-4">
                <video
                  className="w-full rounded-md bg-black max-h-[480px]"
                  src={finalUrl}
                  controls
                  autoPlay
                  loop
                />
                <div className="flex gap-3 items-center flex-wrap">
                  <a
                    className="bg-gold-dim text-bg no-underline py-2.5 px-6 rounded text-sm font-bold transition-colors hover:bg-gold"
                    href={finalUrl}
                    download="기억의_잔상.mp4"
                  >
                    ↓ 다운로드 (MP4)
                  </a>
                  <button
                    className="bg-transparent border border-border text-text-dim py-2.5 px-5 rounded text-sm transition-colors hover:border-gold-dim hover:text-text"
                    onClick={handleReset}
                  >
                    새 기억 입력
                  </button>
                </div>
              </div>
            )}

            {pipelineState.error && !finalUrl && (
              <button
                className="bg-transparent border border-border text-text-dim py-2.5 px-5 rounded text-sm transition-colors hover:border-gold-dim hover:text-text self-start"
                onClick={handleReset}
              >
                다시 시도
              </button>
            )}
          </div>
        </main>
      )}

      {path === '/' && (
        <main className="py-8">
          {inputMode === 'voice' ? (
            <>
              <VoiceInput onComplete={startProcess} />
              <button
                className="block mx-auto mt-4 bg-transparent border-none text-text-dim text-[13px] underline cursor-pointer hover:text-gold"
                onClick={() => setInputMode('text')}
              >
                또는 직접 텍스트 입력
              </button>
            </>
          ) : (
            <div className="max-w-[640px] mx-auto">
              <label className="block text-base text-gold mb-3.5 font-medium">여행의 기억을 들려주세요</label>
              <textarea
                className="w-full bg-surface border border-border text-text p-4 rounded-md text-sm leading-loose resize-y transition-colors focus:outline-none focus:border-gold-dim placeholder:text-text-dim"
                placeholder={
                  '인상 깊었던 여행의 한 장면과 그때의 감정을 자유롭게 적어주세요.\n예: 노을 지던 다낭 바다, 친구들과 들떠 있던 저녁...'
                }
                value={userText}
                onChange={(e) => setUserText(e.target.value)}
                rows={6}
              />
              <button
                className="mt-4 bg-gold-dim text-bg border-none py-3 px-7 rounded text-[15px] font-bold cursor-pointer transition-colors hover:bg-gold disabled:bg-border disabled:text-text-dim disabled:cursor-not-allowed"
                onClick={handleSubmit}
                disabled={!userText.trim()}
              >
                기억 되살리기
              </button>
              <button
                className="block mx-auto mt-4 bg-transparent border-none text-text-dim text-[13px] underline cursor-pointer hover:text-gold"
                onClick={() => setInputMode('voice')}
              >
                또는 음성으로 입력
              </button>
            </div>
          )}
        </main>
      )}
    </div>
  )
}
