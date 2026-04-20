'use client'
import { createContext, useContext, useState, useCallback, ReactNode } from 'react'

type ToastType = 'default' | 'ok' | 'err'
interface ToastItem { id: number; message: string; type: ToastType }

const ToastContext = createContext<{
  showToast: (message: string, type?: ToastType) => void
}>({ showToast: () => {} })

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const showToast = useCallback((message: string, type: ToastType = 'default') => {
    const id = Date.now()
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000)
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div style={{ position: 'fixed', bottom: '1.5rem', right: '1.5rem', zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {toasts.map((t) => (
          <div key={t.id} className="fade-up mono" style={{
            padding: '0.6rem 1rem',
            background: t.type === 'ok' ? 'rgba(80,160,80,0.15)' : t.type === 'err' ? 'rgba(160,60,60,0.15)' : 'var(--gp)',
            border: `1px solid ${t.type === 'ok' ? 'rgba(80,160,80,0.4)' : t.type === 'err' ? 'rgba(160,60,60,0.4)' : 'var(--bd2)'}`,
            color: t.type === 'ok' ? '#7ecf7e' : t.type === 'err' ? '#cf7e7e' : 'var(--gold)',
            fontSize: '0.75rem',
            maxWidth: '320px',
          }}>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() { return useContext(ToastContext) }

export default function Toast() { return null }
