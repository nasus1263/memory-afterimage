import { useState, useCallback, useEffect } from 'react'
import type { ApiKeys, ModelConfig, PipelineState } from './types'
import { loadKeys, saveKeys, loadConfig, saveConfig } from './store/settings'
import { isDebugMode } from './services/debug'
import { Settings } from './components/Settings'
import { Pipeline } from './components/Pipeline'
import { VoiceInput } from './components/VoiceInput'

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
  const finalUrl = finalBlob ? URL.createObjectURL(finalBlob) : null

  return (
    <div className="app">
      {debugActive && (
        <div className="debug-banner">
          🛠 디버그 모드 — 이미지·동영상 API 미호출 (더미 파일)
        </div>
      )}
      <header className="app-header">
        <button className="header-title header-title-btn" onClick={() => navigate('/')}>
          <h1>기억의 잔상</h1>
          <p className="subtitle">말하면 되살아나는 내 여행의 기억</p>
        </button>
        <button
          className={`settings-btn${debugActive ? ' settings-btn--debug' : ''}`}
          onClick={() => navigate(path === '/settings' ? '/' : '/settings')}
        >
          {path === '/settings' ? '✕ 닫기' : '⚙ 설정'}
        </button>
      </header>

      {path === '/settings' && (
        <div className="settings-panel">
          <Settings keys={keys} config={config} onKeys={handleKeys} onConfig={handleConfig} />
        </div>
      )}

      {path === '/process' && (
        <main className="app-main">
          <div className="running-section">
            <div className="user-text-preview">
              <span className="preview-label">입력한 기억</span>
              <p>{userText}</p>
            </div>

            {pipelineState.llmResult && (
              <div className="refined-text">
                <span className="preview-label">다듬어진 나레이션</span>
                <p>{pipelineState.llmResult.refinedText}</p>
              </div>
            )}

            {!finalUrl && !pipelineState.error && (
              <div className="loading-banner">
                <div className="bleed-anim" />
                <p>당신의 기억을 그리는 중입니다...</p>
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
              <div className="result-section">
                <video
                  className="result-video"
                  src={finalUrl}
                  controls
                  autoPlay
                  loop
                />
                <div className="result-actions">
                  <a className="download-btn" href={finalUrl} download="기억의_잔상.mp4">
                    ↓ 다운로드 (MP4)
                  </a>
                  <button className="reset-btn" onClick={handleReset}>
                    새 기억 입력
                  </button>
                </div>
              </div>
            )}

            {pipelineState.error && !finalUrl && (
              <button className="reset-btn" onClick={handleReset}>다시 시도</button>
            )}
          </div>
        </main>
      )}

      {path === '/' && (
        <main className="app-main">
          {inputMode === 'voice' ? (
            <>
              <VoiceInput onComplete={startProcess} />
              <button className="mode-toggle" onClick={() => setInputMode('text')}>
                또는 직접 텍스트 입력
              </button>
            </>
          ) : (
            <div className="input-section">
              <label className="input-label">여행의 기억을 들려주세요</label>
              <textarea
                className="memory-input"
                placeholder={
                  '인상 깊었던 여행의 한 장면과 그때의 감정을 자유롭게 적어주세요.\n예: 노을 지던 다낭 바다, 친구들과 들떠 있던 저녁...'
                }
                value={userText}
                onChange={(e) => setUserText(e.target.value)}
                rows={6}
              />
              <button
                className="submit-btn"
                onClick={handleSubmit}
                disabled={!userText.trim()}
              >
                기억 되살리기
              </button>
              <button className="mode-toggle" onClick={() => setInputMode('voice')}>
                또는 음성으로 입력
              </button>
            </div>
          )}
        </main>
      )}
    </div>
  )
}
