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
  secondsPerImage: number
  onAspectRatioChange: (r: AspectRatio) => void
  onShowCaptionsChange: (v: boolean) => void
  onCaptionBgColorChange: (v: string) => void
  onCaptionTextColorChange: (v: string) => void
  onSecondsPerImageChange: (v: number) => void
}

export function AdvancedSettings({
  aspectRatio,
  images,
  showCaptions,
  captionBgColor,
  captionTextColor,
  secondsPerImage,
  onAspectRatioChange,
  onShowCaptionsChange,
  onCaptionBgColorChange,
  onCaptionTextColorChange,
  onSecondsPerImageChange,
}: Props) {
  const previewDims = PREVIEW_DIMS[aspectRatio]

  return (
    <details className="advanced-settings">
      <summary className="advanced-settings-summary">고급 설정</summary>

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

      <div className="session-field">
        <span className="mini-label">이미지 표시 간격 (초)</span>
        <input
          type="number"
          min={1}
          step={1}
          value={secondsPerImage}
          onChange={(e) => onSecondsPerImageChange(Math.max(1, Number(e.target.value) || 1))}
          className="seconds-per-image-input"
          aria-label="이미지 한 장당 표시할 초"
        />
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
    </details>
  )
}
