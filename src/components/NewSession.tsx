import { useRef, useState } from 'react'
import type { AspectRatio, SessionImage } from '../types'
import { YouTubeIcon, YouTubeShortsIcon, InstagramIcon, TikTokIcon } from './icons'
import sampleImg from '../assets/sample.jpg'

const RATIOS: { value: AspectRatio; label: string; icons: { Icon: typeof YouTubeIcon; name: string }[] }[] = [
  {
    value: '16:9',
    label: '16:9 가로',
    icons: [{ Icon: YouTubeIcon, name: 'YouTube' }],
  },
  {
    value: '9:16',
    label: '9:16 세로',
    icons: [
      { Icon: YouTubeShortsIcon, name: 'Shorts' },
      { Icon: InstagramIcon, name: 'Reels' },
      { Icon: TikTokIcon, name: 'TikTok' },
    ],
  },
  {
    value: '1:1',
    label: '1:1 정방형',
    icons: [{ Icon: InstagramIcon, name: 'Instagram' }],
  },
]

const PREVIEW_DIMS: Record<AspectRatio, { w: number; h: number }> = {
  '16:9': { w: 200, h: 113 },
  '9:16': { w: 113, h: 200 },
  '1:1': { w: 160, h: 160 },
}

interface Props {
  aspectRatio: AspectRatio
  images: SessionImage[]
  showCaptions: boolean
  captionBgColor: string
  captionTextColor: string
  onAspectRatioChange: (r: AspectRatio) => void
  onAddImages: (files: FileList) => void
  onRemoveImage: (id: string) => void
  onShowCaptionsChange: (v: boolean) => void
  onCaptionBgColorChange: (v: string) => void
  onCaptionTextColorChange: (v: string) => void
  onStart: () => void
}

export function NewSession({
  aspectRatio,
  images,
  showCaptions,
  captionBgColor,
  captionTextColor,
  onAspectRatioChange,
  onAddImages,
  onRemoveImage,
  onShowCaptionsChange,
  onCaptionBgColorChange,
  onCaptionTextColorChange,
  onStart,
}: Props) {
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const previewDims = PREVIEW_DIMS[aspectRatio]

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files.length) onAddImages(e.dataTransfer.files)
  }

  return (
    <section className="input-card" aria-label="새 세션 설정">
      <div className="input-title">
        <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 5v14" />
          <path d="M5 12h14" />
        </svg>
        새 세션 시작하기
      </div>

      <div className="session-field">
        <span className="mini-label">동영상 비율</span>
        <div className="ratio-options" role="radiogroup" aria-label="동영상 비율">
          {RATIOS.map((r) => (
            <button
              key={r.value}
              type="button"
              role="radio"
              aria-checked={aspectRatio === r.value}
              className={aspectRatio === r.value ? 'active' : ''}
              onClick={() => onAspectRatioChange(r.value)}
            >
              <span className="ratio-icon-row">
                {r.icons.map(({ Icon, name }) => (
                  <Icon key={name} className="ratio-icon" />
                ))}
              </span>
              {r.label}
            </button>
          ))}
        </div>

      </div>

      <div className="session-field">
        <span className="mini-label">자막</span>
        <label className="caption-toggle">
          <input
            type="checkbox"
            checked={showCaptions}
            onChange={(e) => onShowCaptionsChange(e.target.checked)}
          />
          자막 표시하기
        </label>

        {showCaptions && (
          <div className="caption-colors">
            <label className="caption-color-field">
              배경색
              <input
                type="color"
                value={captionBgColor}
                onChange={(e) => onCaptionBgColorChange(e.target.value)}
              />
            </label>
            <label className="caption-color-field">
              텍스트색
              <input
                type="color"
                value={captionTextColor}
                onChange={(e) => onCaptionTextColorChange(e.target.value)}
              />
            </label>
          </div>
        )}
      </div>

      <div className="ratio-preview-frame">
        <div className="ratio-preview-box" style={{ width: previewDims.w, height: previewDims.h }}>
          <img src={images[0]?.url ?? sampleImg} alt="" className="ratio-preview-image" />
          {showCaptions && (
            <span className="caption-chip" style={{ backgroundColor: captionBgColor, color: captionTextColor }}>
              기억하고 싶은 순간
            </span>
          )}
        </div>
      </div>

      <div className="session-field">
        <span className="mini-label">이미지 업로드 (선택)</span>
        <div
          className={`upload-dropzone${dragOver ? ' drag-over' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            onChange={(e) => { if (e.target.files?.length) onAddImages(e.target.files); e.target.value = '' }}
          />
          <p>이미지를 이 영역에 드래그하거나</p>
          <button type="button" className="ghost-link" onClick={() => fileInputRef.current?.click()}>
            파일 선택
          </button>
        </div>

        {images.length > 0 && (
          <div className="upload-thumbs">
            {images.map((img) => (
              <div className="upload-thumb" key={img.id}>
                <img src={img.url} alt="" />
                <button
                  type="button"
                  className="upload-thumb-remove"
                  aria-label="이미지 삭제"
                  onClick={() => onRemoveImage(img.id)}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <button type="button" className="primary-wide-button" onClick={onStart}>
        세션 시작
      </button>
    </section>
  )
}
