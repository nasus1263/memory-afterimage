// 라우트 배경에 표시하는 거대한 반투명 심볼 마크. 사용자가 현재 페이지 성격을 직관적으로 알 수 있도록.
// strokeWidth/className을 넘기면 nav 아이콘 등 작은 크기로도 재사용 가능.

interface MarkProps {
  children: React.ReactNode
  strokeWidth?: number
  className?: string
}

function Mark({ children, strokeWidth = 0.7, className }: MarkProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  )
}

type MarkComponentProps = Omit<MarkProps, 'children'>

export function NewMark(props: MarkComponentProps) {
  return (
    <Mark {...props}>
      <path d="M12 4v16M4 12h16" />
    </Mark>
  )
}

export function InputMark(props: MarkComponentProps) {
  return (
    <Mark {...props}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" />
    </Mark>
  )
}

export function ChatMark(props: MarkComponentProps) {
  return (
    <Mark {...props}>
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </Mark>
  )
}

export function ProcessMark(props: MarkComponentProps) {
  return (
    <Mark {...props}>
      <path d="M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2z" />
    </Mark>
  )
}

export function SettingsMark(props: MarkComponentProps) {
  const teeth = [0, 45, 90, 135, 180, 225, 270, 315]
  return (
    <Mark {...props}>
      <circle cx="12" cy="12" r="3.2" />
      <circle cx="12" cy="12" r="7.5" />
      {teeth.map((deg) => (
        <line key={deg} x1="12" y1="2.3" x2="12" y2="4.3" transform={`rotate(${deg} 12 12)`} />
      ))}
    </Mark>
  )
}

export function MemoriesMark(props: MarkComponentProps) {
  return (
    <Mark {...props}>
      <path d="M3 7l2-3h14l2 3" />
      <rect x="3" y="7" width="18" height="13" rx="1.5" />
      <path d="M9 11h6" />
    </Mark>
  )
}
