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
  audio: 'idle', compose: 'idle',
  messages: {},
  durations: {},
}

// Vite's base (e.g. "/memory-afterimage/" on GitHub Pages, "/" in dev), without trailing slash.
const BASE = import.meta.env.BASE_URL.replace(/\/$/, '')

function stripBase(pathname: string) {
  if (BASE && pathname.startsWith(BASE)) return pathname.slice(BASE.length) || '/'
  return pathname
}

function useRoute() {
  const [path, setPath] = useState(() => stripBase(window.location.pathname))

  useEffect(() => {
    const onPopState = () => setPath(stripBase(window.location.pathname))
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const navigate = useCallback((to: string) => {
    window.history.pushState({}, '', BASE + to)
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
    <div className="max-w-[1000px] mx-auto px-5">
      {debugActive && (
        <div className="demo-badge" role="status">
          <span className="dot" />
          <span>디버그 모드 · 더미 파일 반환</span>
        </div>
      )}

      <header className="grid grid-cols-1 md:grid-cols-[1.15fr_0.85fr] gap-6 items-end py-10">
        <section>
          <button className="bg-transparent border-none p-0 cursor-pointer text-left" onClick={() => navigate('/')}>
            <p className="brand-kicker">Memory Afterimage</p>
            <h1 className="hero-title">기억의 잔상</h1>
          </button>
          <p className="hero-copy">당신의 여행 기억을 듣고,<br />하나의 장면으로 남겨드립니다.</p>
        </section>
        <aside className="album-strip hidden md:block" aria-label="현대적인 사진앨범 콘셉트 이미지" />
      </header>

      <nav className="stage-nav grid-cols-3 mb-8">
        <button className={`stage-pill ${path === '/' || path === '/process' ? 'active' : ''}`} onClick={() => navigate('/')}>
          기억 남기기
        </button>
        <button className={`stage-pill ${path === '/memories' ? 'active' : ''}`} onClick={() => navigate(path === '/memories' ? '/' : '/memories')}>
          보관함
        </button>
        <button className={`stage-pill ${path === '/settings' ? 'active' : ''}`} onClick={() => navigate('/settings')}>
          ⚙ 설정
        </button>
      </nav>

      {path === '/settings' && (
        <div className="pane my-3">
          <Settings keys={keys} config={config} onKeys={handleKeys} onConfig={handleConfig} />
        </div>
      )}

      {path === '/memories' && <Memories />}

      {path === '/process' && (
        <main className="py-4 pb-10">
          <div className="flex flex-col gap-5">
            <div className="pane !p-5">
              <span className="mini-label !mb-2 !text-[11px]">입력한 기억</span>
              <p className="text-text-dim text-[13px]">{userText}</p>
            </div>

            {pipelineState.llmResult && (
              <div className="pane !p-5">
                <span className="mini-label !mb-2 !text-[11px]">다듬어진 나레이션</span>
                <p className="text-text text-sm leading-loose">{pipelineState.llmResult.refinedText}</p>
              </div>
            )}

            {!finalUrl && !pipelineState.error && (
              <div className="pane center">
                <p className="mini-label">Generating</p>
                <h2 className="pane-title">당신의 기억을<br />그리는 중입니다...</h2>
                <div className="loader-orb" />
                <p className="pane-desc">장소, 장면, 감정, 분위기를 분석해<br />하나의 장면으로 정리하고 있어요.</p>
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
                <div className="big-photo">
                  <video
                    className="w-full max-h-[480px] block"
                    src={finalUrl}
                    controls
                    autoPlay
                    loop
                  />
                </div>
                <div className="action-row">
                  <a className="primary-btn" href={finalUrl} download="기억의_잔상.mp4">
                    ↓ 다운로드 (MP4)
                  </a>
                  <button className="secondary-btn" onClick={handleReset}>
                    새 기억 입력
                  </button>
                </div>
              </div>
            )}

            {pipelineState.error && !finalUrl && (
              <button className="secondary-btn self-start" onClick={handleReset}>
                처음으로
              </button>
            )}
          </div>
        </main>
      )}

      {path === '/' && (
        <main className="py-4 pb-10">
          <div className="pane center">
            <p className="mini-label">Waiting</p>
            <h2 className="pane-title">말하면 되살아나는<br />내 여행의 기억</h2>
            <p className="pane-desc">헤드폰을 끼고, 마이크 버튼을 눌러<br />여행의 한 장면을 들려주세요.</p>

            {inputMode === 'voice' ? (
              <>
                <VoiceInput onComplete={startProcess} />
                <button className="ghost-link" onClick={() => setInputMode('text')}>
                  텍스트로 입력하기
                </button>
              </>
            ) : (
              <div className="w-full max-w-[440px] mt-6 flex flex-col gap-3">
                <textarea
                  className="w-full min-h-[138px] resize-y border border-border rounded-[22px] bg-white/55 p-4.5 text-text leading-loose focus:outline-none"
                  placeholder={
                    '예: 노을 지던 다낭 바다에서 친구들과 천천히 걸었던 순간이 기억나요. 따뜻하고 자유로운 기분이었어요.'
                  }
                  value={userText}
                  onChange={(e) => setUserText(e.target.value)}
                  rows={6}
                />
                <button className="primary-btn" onClick={handleSubmit} disabled={!userText.trim()}>
                  이 기억으로 시작하기 →
                </button>
                <button className="ghost-link" onClick={() => setInputMode('voice')}>
                  또는 음성으로 입력
                </button>
              </div>
            )}
          </div>
        </main>
      )}

      <footer className="foot py-6">
        <span>기억의 잔상 | Memory Afterimage</span>
        <span>Listen · Remember · Scene</span>
      </footer>
    </div>
  )
}
