import { createContext, useContext, useState, type ReactNode } from 'react'

type AlertTone = 'error' | 'info'

interface AlertState {
  title: string
  message: string
  tone: AlertTone
}

interface AlertContextValue {
  showAlert: (message: string, opts?: { title?: string; tone?: AlertTone }) => void
}

const AlertContext = createContext<AlertContextValue | null>(null)

export function useAlert(): AlertContextValue {
  const ctx = useContext(AlertContext)
  if (!ctx) throw new Error('useAlert는 AlertProvider 내부에서만 사용할 수 있습니다')
  return ctx
}

function ErrorGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
    </svg>
  )
}

function InfoGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  )
}

export function AlertProvider({ children }: { children: ReactNode }) {
  const [alert, setAlert] = useState<AlertState | null>(null)

  function showAlert(message: string, opts?: { title?: string; tone?: AlertTone }) {
    const tone = opts?.tone ?? 'error'
    setAlert({ message, tone, title: opts?.title ?? (tone === 'info' ? '알려드려요' : '문제가 생겼어요') })
  }

  return (
    <AlertContext.Provider value={{ showAlert }}>
      {children}
      {alert && (
        <div className="retry-popup" role="alertdialog" aria-modal="true" aria-label={alert.title}>
          <div className="retry-popup-card">
            <div className="retry-popup-icon">
              {alert.tone === 'error' ? <ErrorGlyph /> : <InfoGlyph />}
            </div>
            <h3>{alert.title}</h3>
            <p>{alert.message}</p>
            <div className="retry-popup-actions">
              <button className="retry-record-button" type="button" onClick={() => setAlert(null)}>확인</button>
            </div>
          </div>
        </div>
      )}
    </AlertContext.Provider>
  )
}
