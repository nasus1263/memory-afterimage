import { useState, useCallback } from 'react'
import type { ApiKeys, ModelConfig, PipelineState } from './types'
import { loadKeys, saveKeys, loadConfig, saveConfig } from './store/settings'
import { Settings } from './components/Settings'
import { Pipeline } from './components/Pipeline'

const IDLE_PIPELINE: PipelineState = {
  refine: 'idle', tts: 'idle', image: 'idle',
  audio: 'idle', imgToVid: 'idle', compose: 'idle',
}

export default function App() {
  const [keys, setKeys] = useState<ApiKeys>(loadKeys)
  const [config, setConfig] = useState<ModelConfig>(loadConfig)
  const [showSettings, setShowSettings] = useState(false)
  const [userText, setUserText] = useState('')
  const [running, setRunning] = useState(false)
  const [pipelineState, setPipelineState] = useState<PipelineState>(IDLE_PIPELINE)
  const [composeProgress, setComposeProgress] = useState(0)

  function handleKeys(k: ApiKeys) { setKeys(k); saveKeys(k) }
  function handleConfig(c: ModelConfig) { setConfig(c); saveConfig(c) }

  const handleProgress = useCallback((p: number) => setComposeProgress(p), [])

  function handleSubmit() {
    if (!userText.trim()) return
    setRunning(true)
    setComposeProgress(0)
    setPipelineState(IDLE_PIPELINE)
  }

  function handleReset() {
    setRunning(false)
    setPipelineState(IDLE_PIPELINE)
    setComposeProgress(0)
  }

  const finalBlob = pipelineState.finalBlob
  const finalUrl = finalBlob ? URL.createObjectURL(finalBlob) : null

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-title">
          <h1>기억의 잔상</h1>
          <p className="subtitle">말하면 되살아나는 내 여행의 기억</p>
        </div>
        <button className="settings-btn" onClick={() => setShowSettings((s) => !s)}>
          {showSettings ? '✕ 닫기' : '⚙ 설정'}
        </button>
      </header>

      {showSettings && (
        <div className="settings-panel">
          <Settings keys={keys} config={config} onKeys={handleKeys} onConfig={handleConfig} />
        </div>
      )}

      <main className="app-main">
        {!running ? (
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
          </div>
        ) : (
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
        )}
      </main>
    </div>
  )
}
