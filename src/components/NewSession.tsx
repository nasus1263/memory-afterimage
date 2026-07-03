import { useRef, useState } from 'react'
import type { AspectRatio, SessionImage } from '../types'

const RATIOS: { value: AspectRatio; label: string }[] = [
  { value: '16:9', label: '16:9 가로' },
  { value: '9:16', label: '9:16 세로' },
  { value: '1:1', label: '1:1 정방형' },
]

interface Props {
  aspectRatio: AspectRatio
  images: SessionImage[]
  onAspectRatioChange: (r: AspectRatio) => void
  onAddImages: (files: FileList) => void
  onRemoveImage: (id: string) => void
  onStart: () => void
}

export function NewSession({ aspectRatio, images, onAspectRatioChange, onAddImages, onRemoveImage, onStart }: Props) {
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
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="session-field">
        <span className="mini-label">참고 이미지 업로드</span>
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

      <button type="button" className="session-start-button" onClick={onStart}>
        세션 시작
      </button>
    </section>
  )
}
