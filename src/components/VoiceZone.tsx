interface Props {
  active?: boolean
  interactive: boolean
  onToggle?: () => void
  disabled?: boolean
  title: string
  subtitle?: React.ReactNode
}

export function VoiceZone({ active, interactive, onToggle, disabled, title, subtitle }: Props) {
  return (
    <div className="voice-zone">
      <div className="mic-wrap">
        <span className="ring one" />
        <span className="ring two" />
        <span className="ring three" />
        <button
          className={`mic-button${active ? ' recording' : ''}`}
          aria-label={active ? '녹음 중' : '녹음 시작'}
          onClick={interactive ? onToggle : undefined}
          disabled={!interactive || disabled}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 14a4 4 0 0 0 4-4V6a4 4 0 0 0-8 0v4a4 4 0 0 0 4 4Z" />
            <path d="M19 10a7 7 0 0 1-14 0" />
            <path d="M12 17v4" />
            <path d="M8 21h8" />
          </svg>
        </button>
      </div>
      <h2>{title}</h2>
      {subtitle && <p>{subtitle}</p>}
    </div>
  )
}
