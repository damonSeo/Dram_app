'use client'
import { useEffect, ReactNode } from 'react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  subtitle?: string
  children: ReactNode
  actions?: ReactNode
}

export default function Modal({ open, onClose, title, subtitle, children, actions }: ModalProps) {
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.75)', display: 'flex',
        alignItems: 'center', justifyContent: 'center', padding: '1.5rem',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="fade-up"
        style={{
          background: 'var(--c2)', border: '1px solid var(--bd2)',
          width: '100%', maxWidth: '580px', maxHeight: '82vh',
          display: 'flex', flexDirection: 'column',
        }}
      >
        {(title || subtitle) && (
          <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--bd)', flexShrink: 0 }}>
            {title && (
              <p className="mono" style={{ fontSize: '0.75rem', color: 'var(--gold)', letterSpacing: '0.08em' }}>
                {title}
              </p>
            )}
            {subtitle && (
              <p style={{ fontSize: '0.8rem', color: 'var(--tx2)', marginTop: '0.25rem' }}>
                {subtitle}
              </p>
            )}
          </div>
        )}
        <div style={{ padding: '1.25rem', overflowY: 'auto', flex: 1 }}>{children}</div>
        {actions && (
          <div style={{
            padding: '0.75rem 1.25rem', borderTop: '1px solid var(--bd)',
            display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', flexShrink: 0,
          }}>
            {actions}
          </div>
        )}
      </div>
    </div>
  )
}
