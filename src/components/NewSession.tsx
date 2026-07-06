import { useRef, useState } from 'react'
import type { AspectRatio, SessionImage } from '../types'
import { AdvancedSettings } from './AdvancedSettings'

interface Props {
  aspectRatio: AspectRatio
  images: SessionImage[]
  showCaptions: boolean
  captionBgColor: string
  captionTextColor: string
  secondsPerImage: number
  onAspectRatioChange: (r: AspectRatio) => void
  onAddImages: (files: FileList) => void
  onRemoveImage: (id: string) => void
  onShowCaptionsChange: (v: boolean) => void
  onCaptionBgColorChange: (v: string) => void
  onCaptionTextColorChange: (v: string) => void
  onSecondsPerImageChange: (v: number) => void
  onStart: () => void
}

export function NewSession({
  aspectRatio,
  images,
  showCaptions,
  captionBgColor,
  captionTextColor,
  secondsPerImage,
  onAspectRatioChange,
  onAddImages,
  onRemoveImage,
  onShowCaptionsChange,
  onCaptionBgColorChange,
  onCaptionTextColorChange,
  onSecondsPerImageChange,
  onStart,
}: Props) {
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

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

      <AdvancedSettings
        aspectRatio={aspectRatio}
        images={images}
        showCaptions={showCaptions}
        captionBgColor={captionBgColor}
        captionTextColor={captionTextColor}
        secondsPerImage={secondsPerImage}
        onAspectRatioChange={onAspectRatioChange}
        onShowCaptionsChange={onShowCaptionsChange}
        onCaptionBgColorChange={onCaptionBgColorChange}
        onCaptionTextColorChange={onCaptionTextColorChange}
        onSecondsPerImageChange={onSecondsPerImageChange}
      />

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
