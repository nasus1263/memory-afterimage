import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import type { ApiKeys, AspectRatio, ModelConfig, PipelineState, SessionImage } from './types'
import { loadKeys, saveKeys, loadConfig, saveConfig } from './store/settings'
import { isAutoAnswerMode, isDummyImageMode } from './services/debug'
import { Settings } from './components/Settings'
import { Pipeline } from './components/Pipeline'
import { VoiceInput } from './components/VoiceInput'
import { Memories } from './components/Memories'
import { NewSession } from './components/NewSession'
import { Chat } from './components/Chat'
import { VoiceChat } from './components/VoiceChat'
import { saveMemory } from './services/memories'
import { SECONDS_PER_IMAGE } from './services/composer'
import { loadProgress, saveProgress, clearProgress, type SessionProgress } from './store/progress'
import { NewMark, InputMark, ChatMark, ProcessMark, SettingsMark, MemoriesMark } from './components/watermarks'
import { KakaoTalkIcon } from './components/icons'
import { useAlert } from './hooks/useAlert'

const ROUTE_WATERMARKS: Record<string, () => React.JSX.Element> = {
  '/new': NewMark,
  '/input': InputMark,
  '/chat': ChatMark,
  '/process': ProcessMark,
  '/settings': SettingsMark,
  '/memories': MemoriesMark,
}

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

  const navigate = useCallback((to: string, replace = false) => {
    if (replace) window.history.replaceState({}, '', BASE + to)
    else window.history.pushState({}, '', BASE + to)
    setPath(to)
  }, [])

  return { path, navigate }
}

export default function App() {
  const { path, navigate } = useRoute()
  const { showAlert } = useAlert()
  const [keys, setKeys] = useState<ApiKeys>(loadKeys)
  const [config, setConfig] = useState<ModelConfig>(loadConfig)
  const [inputMode, setInputMode] = useState<'voice' | 'text'>('voice')
  const [voiceListening, setVoiceListening] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const resultVideoRef = useRef<HTMLVideoElement>(null)
  const [userText, setUserText] = useState('')
  const [pipelineState, setPipelineState] = useState<PipelineState>(IDLE_PIPELINE)
  const [composeProgress, setComposeProgress] = useState(0)
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('16:9')
  const [sessionImages, setSessionImages] = useState<SessionImage[]>([])
  const [showCaptions, setShowCaptions] = useState(true)
  const [captionBgColor, setCaptionBgColor] = useState('#000000')
  const [captionTextColor, setCaptionTextColor] = useState('#ffffff')
  const [secondsPerImage, setSecondsPerImage] = useState(SECONDS_PER_IMAGE)
  const autoAnswerActive = isAutoAnswerMode()
  const dummyImageActive = isDummyImageMode()
  const debugActive = autoAnswerActive || dummyImageActive

  function applyProgress(p: SessionProgress) {
    setAspectRatio(p.aspectRatio)
    setShowCaptions(p.showCaptions)
    setCaptionBgColor(p.captionBgColor)
    setCaptionTextColor(p.captionTextColor)
    setSecondsPerImage(p.secondsPerImage)
    setUserText(p.userText)
  }

  function goHome(replace = false) {
    const progress = loadProgress()
    if (progress) {
      applyProgress(progress)
      navigate(progress.route, replace)
    } else {
      navigate('/input', replace)
    }
  }

  useEffect(() => {
    if (path !== '/') return
    goHome(true)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, navigate])

  useEffect(() => {
    const visited = localStorage.getItem('memory_visited')
    if (!visited) {
      localStorage.setItem('memory_visited', '1')
      navigate('/settings')
    }
  }, [navigate])

  useEffect(() => {
    if (path === '/chat' && !userText.trim()) navigate('/input')
  }, [path, userText, navigate])

  useEffect(() => {
    if (path === '/process' && !userText.trim()) navigate('/input')
  }, [path, userText, navigate])

  function addSessionImages(files: FileList) {
    const next = Array.from(files)
      .filter((f) => f.type.startsWith('image/'))
      .map((file) => ({ id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, file, url: URL.createObjectURL(file) }))
    if (next.length) setSessionImages((prev) => [...prev, ...next])
  }

  function removeSessionImage(id: string) {
    setSessionImages((prev) => {
      const target = prev.find((img) => img.id === id)
      if (target) URL.revokeObjectURL(target.url)
      return prev.filter((img) => img.id !== id)
    })
  }

  useEffect(() => {
    if (pipelineState.finalBlob) {
      console.log('[App] finalBlob 생성됨', { size: pipelineState.finalBlob.size, type: pipelineState.finalBlob.type })
      if (pipelineState.finalBlob.size === 0) {
        console.error('[App] finalBlob 크기가 0입니다 (compose 결과물이 비어있음)')
        showAlert('영상을 만드는 데 문제가 생겼어요. 처음부터 다시 시도해주세요.')
      }
      saveMemory({ text: userText, video: pipelineState.finalBlob, createdAt: Date.now() }).catch((e) => {
        console.error('[App] saveMemory 실패', e)
        showAlert('완성된 영상을 저장하지 못했어요. 다시 시도해주세요.')
      })
      clearProgress()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pipelineState.finalBlob])

  function handleKeys(k: ApiKeys) { setKeys(k); saveKeys(k) }
  function handleConfig(c: ModelConfig) { setConfig(c); saveConfig(c) }

  const handleProgress = useCallback((p: number) => setComposeProgress(p), [])

  function currentProgressBase() {
    return { aspectRatio, showCaptions, captionBgColor, captionTextColor, secondsPerImage }
  }

  function handleNewSessionStart() {
    saveProgress({ ...currentProgressBase(), route: '/input', userText: '' })
    navigate('/input')
  }

  function goToChat(text: string) {
    setUserText(text)
    saveProgress({ ...currentProgressBase(), route: '/chat', userText: text })
    navigate('/chat')
  }

  function handleSubmit() {
    if (!userText.trim()) return
    goToChat(userText)
  }

  function handleChatComplete(summary: string) {
    setUserText(summary)
    setComposeProgress(0)
    setPipelineState(IDLE_PIPELINE)
    saveProgress({ ...currentProgressBase(), route: '/process', userText: summary })
    navigate('/process')
  }

  function handleReset() {
    if (!window.confirm('지금까지 입력한 내용이 사라져요. 처음부터 다시 시작할까요?')) return
    clearProgress()
    setUserText('')
    setInputMode('voice')
    setVoiceListening(false)
    setShowPreview(false)
    setPipelineState(IDLE_PIPELINE)
    setComposeProgress(0)
    navigate('/input')
  }

  function handleMemoryNavClick() {
    const progress = loadProgress()
    if (progress) {
      applyProgress(progress)
      navigate(progress.route)
    } else {
      navigate('/new')
    }
  }

  const finalBlob = pipelineState.finalBlob
  const finalUrl = useMemo(() => (finalBlob ? URL.createObjectURL(finalBlob) : null), [finalBlob])
  useEffect(() => () => { if (finalUrl) URL.revokeObjectURL(finalUrl) }, [finalUrl])

  const WatermarkIcon = ROUTE_WATERMARKS[path]

  return (
    <>
      {WatermarkIcon && (
        <div className="route-watermark" aria-hidden="true">
          <WatermarkIcon />
        </div>
      )}

      {debugActive && (
        <div className="demo-badge" role="status">
          <span className="dot" />
          <span>
            디버그 모드 · {[autoAnswerActive && '답변 자동 생성', dummyImageActive && '더미 이미지'].filter(Boolean).join(' · ')}
          </span>
        </div>
      )}

      <header className="topbar">
        <div className="topbar-inner">
          <button className="brand" onClick={() => goHome()} aria-label="기억의 잔상 홈">
            <svg className="logo" viewBox="0 0 64 64" fill="none" aria-hidden="true">
              <path d="M10 47L27.5 24.5L38 38L44 30L56 47" stroke="#6F4631" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M21 24.5C21 16.5 27.5 10 35.5 10C41.1 10 46 13.2 48.4 17.9" stroke="#D28A38" strokeWidth="2.2" strokeLinecap="round" />
              <path d="M16 51H57" stroke="#6F4631" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
            <div>
              <h2 className="brand-title">Memory Canvas</h2>
              <div className="brand-subtitle">여행의 순간을, 하나의 장면으로</div>
            </div>
          </button>

          <nav className="nav" aria-label="주요 메뉴">
            <button className={['/', '/new', '/input', '/chat', '/process'].includes(path) ? 'active' : ''} onClick={handleMemoryNavClick}>
              <InputMark className="nav-icon" strokeWidth={1.8} />
              기억 남기기
            </button>
            <button className={path === '/memories' ? 'active' : ''} onClick={() => navigate(path === '/memories' ? '/new' : '/memories')}>
              <MemoriesMark className="nav-icon" strokeWidth={1.8} />
              보관함
            </button>
            <button className={path === '/settings' ? 'active' : ''} onClick={() => navigate('/settings')}>
              <SettingsMark className="nav-icon" strokeWidth={1.8} />
              설정
            </button>
          </nav>

          <div className="user-area" />
        </div>
      </header>

      <main>
        <section className="hero" aria-labelledby="hero-title">
          <h1 id="hero-title">여행의 순간을 하나의 장면으로 남기세요</h1>
          <p>기억하고 싶은 여행의 순간을 음성으로 들려주세요. AI가 당신의 감정을 담아 하나의 장면으로 그려드립니다.</p>
        </section>

        {['/chat', '/process'].includes(path) && !(path === '/process' && finalUrl) && (
          <button type="button" className="restart-button" onClick={handleReset}>
            처음부터 진행하기
          </button>
        )}

        {path === '/settings' && (
          <div className="pane my-3">
            <Settings keys={keys} config={config} onKeys={handleKeys} onConfig={handleConfig} />
          </div>
        )}

        {path === '/memories' && <Memories />}

        {path === '/process' && (
          <div className="flex flex-col gap-5 mt-9">
            {!finalUrl && (
              <details className="advanced-settings pane !p-5 !mt-0">
                <summary className="advanced-settings-summary">입력한 내용 확인하기</summary>
                <div className="flex flex-col gap-4 mt-4">
                  <div>
                    <span className="mini-label !mb-2">입력한 기억</span>
                    <p className="text-text-dim text-base">{userText}</p>
                  </div>
                  {pipelineState.llmResult && (
                    <div>
                      <span className="mini-label !mb-2">다듬어진 나레이션</span>
                      <p className="text-text text-base leading-loose">{pipelineState.llmResult.refinedText}</p>
                    </div>
                  )}
                </div>
              </details>
            )}

            {!finalUrl && !pipelineState.error && (
              <section className="input-card" aria-label="기억을 그리는 중" aria-live="polite">
                <p className="step-label">03 CREATING</p>
                <div className="memory-orb" aria-hidden="true">
                  <span className="loading-core" />
                </div>
                <h2 className="pane-title text-center">당신의 기억을<br />그리는 중입니다...</h2>
                <p className="loading-desc text-center">장소, 장면, 감정, 분위기를 분석해<br />하나의 장면으로 정리하고 있어요.</p>

                <div className="flex flex-col gap-3 w-full max-w-[480px] mx-auto mt-8">
                  <Pipeline
                    userText={userText}
                    keys={keys}
                    config={config}
                    state={pipelineState}
                    setState={setPipelineState}
                    onProgress={handleProgress}
                    composeProgress={composeProgress}
                    secondsPerImage={secondsPerImage}
                    userImages={sessionImages.map((img) => img.file)}
                    showCaptions={showCaptions}
                    captionBgColor={captionBgColor}
                    captionTextColor={captionTextColor}
                    aspectRatio={aspectRatio}
                  />
                </div>
              </section>
            )}

            {finalUrl && (
              <section className="input-card" aria-label="생성된 기억" aria-live="polite">
                <p className="step-label">04 RESULT</p>
                <h2 className="pane-title text-center mt-3">당신의 기억이<br />완성되었습니다</h2>
                <div className="result-image-window" aria-label="생성된 영상 미리보기">
                  <video
                    ref={resultVideoRef}
                    src={finalUrl}
                    controls
                    autoPlay
                    loop
                    onError={(e) => {
                      const err = (e.target as HTMLVideoElement).error
                      console.error('[App] 결과 영상 재생 오류', err)
                      showAlert('영상을 재생할 수 없어요. 다운로드해서 확인해보세요.')
                    }}
                  />
                  <button
                    className="fullscreen-image-button"
                    type="button"
                    aria-label="생성된 영상 전체화면 보기"
                    onClick={() => { resultVideoRef.current?.pause(); setShowPreview(true) }}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M14 4h6v6" />
                      <path d="M20 4l-7 7" />
                      <path d="M10 20H4v-6" />
                      <path d="M4 20l7-7" />
                    </svg>
                  </button>
                </div>
                <div className="result-action-row">
                  <a className="image-save-button" href={finalUrl} download="기억의_잔상.mp4">
                    ↓ 다운로드 (MP4)
                  </a>
                  <button
                    type="button"
                    className="kakao-share-button"
                    onClick={() => showAlert('카카오톡 공유 기능은 곧 추가될 예정이에요.', { tone: 'info' })}
                  >
                    <KakaoTalkIcon className="kakao-share-icon" />
                    카카오톡 공유
                  </button>
                  <button className="result-reset-button" onClick={handleReset}>
                    처음으로 돌아가기
                  </button>
                </div>
              </section>
            )}

            {finalUrl && showPreview && (
              <div className="image-preview-modal" onClick={(e) => { if (e.target === e.currentTarget) setShowPreview(false) }}>
                <button className="image-preview-close" type="button" aria-label="영상 크게 보기 닫기" onClick={() => setShowPreview(false)}>
                  ×
                </button>
                <div className="image-preview-frame" aria-label="생성된 영상 크게 보기">
                  <video
                    src={finalUrl}
                    controls
                    autoPlay
                    loop
                    onError={(e) => {
                      const err = (e.target as HTMLVideoElement).error
                      console.error('[App] 미리보기 영상 재생 오류', err)
                      showAlert('영상을 재생할 수 없어요. 다운로드해서 확인해보세요.')
                    }}
                  />
                </div>
              </div>
            )}

            {pipelineState.error && !finalUrl && (
              <button className="secondary-btn self-start" onClick={handleReset}>
                처음으로
              </button>
            )}
          </div>
        )}

        {path === '/new' && (
          <NewSession
            aspectRatio={aspectRatio}
            images={sessionImages}
            showCaptions={showCaptions}
            captionBgColor={captionBgColor}
            captionTextColor={captionTextColor}
            secondsPerImage={secondsPerImage}
            onAspectRatioChange={setAspectRatio}
            onAddImages={addSessionImages}
            onRemoveImage={removeSessionImage}
            onShowCaptionsChange={setShowCaptions}
            onCaptionBgColorChange={setCaptionBgColor}
            onCaptionTextColorChange={setCaptionTextColor}
            onSecondsPerImageChange={setSecondsPerImage}
            onStart={handleNewSessionStart}
          />
        )}

        {path === '/chat' && (
          inputMode === 'text' ? (
            <Chat userText={userText} keys={keys} config={config} onComplete={handleChatComplete} />
          ) : (
            <VoiceChat userText={userText} keys={keys} config={config} onComplete={handleChatComplete} />
          )
        )}

        {path === '/input' && (
          <section className="input-card" aria-label="기억 입력 영역">
            <button
              type="button"
              className="input-card-settings-button"
              aria-label="세션 설정으로 이동"
              onClick={() => navigate('/new')}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </button>

            {inputMode === 'voice' && (
              <div className="input-title">
                <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" />
                </svg>
                기억 입력하기
              </div>
            )}

            {inputMode === 'voice' ? (
              <>
                <VoiceInput apiKey={keys.elevenlabs} keys={keys} config={config} onComplete={goToChat} onListeningChange={setVoiceListening} />
                <div className="divider">또는</div>
                <button className="ghost-link mx-auto block" onClick={() => setInputMode('text')}>
                  텍스트로 입력하기
                </button>
              </>
            ) : (
              <>
                <div className="input-title">
                  <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" />
                  </svg>
                  기억 입력하기
                </div>
                <form
                  className="text-input"
                  onSubmit={(e) => { e.preventDefault(); handleSubmit() }}
                >
                  <textarea
                    className="memory-text-field"
                    maxLength={500}
                    placeholder="예: 노을 지던 다낭 바다에서 친구들과 천천히 걸었던 순간이 기억나요. 따뜻하고 자유로운 기분이었어요."
                    value={userText}
                    onChange={(e) => setUserText(e.target.value)}
                    rows={4}
                  />
                  <div className="text-input-foot">
                    <span className="counter">{userText.length} / 500</span>
                    <button className="text-submit-button" type="submit" disabled={!userText.trim()}>
                      시작하기
                    </button>
                  </div>
                </form>
                <button className="ghost-link mx-auto block mt-3" onClick={() => setInputMode('voice')}>
                  또는 음성으로 입력
                </button>
              </>
            )}
          </section>
        )}

        <footer className="foot">기억의 잔상 | Memory Afterimage · Listen · Remember · Scene</footer>
      </main>
    </>
  )
}
