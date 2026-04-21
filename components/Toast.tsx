'use client'
import { createContext, useContext, useState, useCallback, ReactNode } from 'react'

type ToastType = 'default' | 'ok' | 'err'
interface ToastItem { id: number; message: string; type: ToastType }
interface ToastCtx { showToast: (msg: string, type?: ToastType) => void }

const ToastContext = createContext<ToastCtx>({ showToast: () => {} })

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const showToast = useCallback((message: string, type: ToastType = 'default') => {
    const id = Date.now()
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500)
  }, [])

  const colorMap = {
    default: { bg: 'var(--gp)', border: 'var(--bd2)', color: 'var(--gold)' },
    ok: { bg: 'rgba(80,160,80,0.12)', border: 'rgba(80,160,80,0.4)', color: '#7ecf7e' },
    err: { bg: 'rgba(160,60,60,0.12)', border: 'rgba(160,60,60,0.4)', color: '#cf7e7e' },
  }

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div style={{
        position: 'fixed', bottom: '1.5rem', right: '1.5rem', zIndex: 9999,
        display: 'flex', flexDirection: 'column', gap: '0.5rem',
      }}>
        {toasts.map((t) => {
          const c = colorMap[t.type]
          return (
            <div key={t.id} className="fade-up mono" style={{
              padding: '0.6rem 1rem',
              background: c.bg,
              border: `1px solid ${c.border}`,
              color: c.color,
              fontSize: '0.75rem',
              maxWidth: '320px',
              lineHeight: 1.4,
            }}>
              {t.message}
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() { return useContext(ToastContext) }
