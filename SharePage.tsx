'use client'
import { useState } from 'react'
import { useStore } from '@/lib/store'
import { useToast } from '@/components/Toast'
import Modal from '@/components/Modal'
import type { WhiskyLog } from '@/types'

type NotionStatus = 'idle' | 'working' | 'ok' | 'err'

async function callAI(action: string, payload: object): Promise<string> {
  const res = await fetch('/api/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, payload }),
  })
  const json = await res.json() as { text?: string; error?: string }
  if (!res.ok) throw new Error(json.error || 'AI failed')
  return json.text || ''
}

export default function SharePage() {
  const { currentLog, collection, updateCurrentLog, notionDbId, notionToken, setNotionDbId, setNotionToken } = useStore()
  const { showToast } = useToast()

  const [modal, setModal] = useState({ open: false, title: '', text: '', loading: false, action: '', payload: {} as object })
  const [notionStatus, setNotionStatus] = useState<NotionStatus>('idle')
  const [notionError, setNotionError] = useState('')
  const [dbIdInput, setDbIdInput] = useState(notionDbId)
  const [tokenInput, setTokenInput] = useState(notionToken)

  const openModal = async (title: string, action: string, payload: object) => {
    setModal({ open: true, title, text: '', loading: true, action, payload })
    try {
      const text = await callAI(action, payload)
      setModal((p) => ({ ...p, text, loading: false }))
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'AI 오류', 'err')
      setModal((p) => ({ ...p, open: false }))
    }
  }

  const regenerate = async () => {
    setModal((p) => ({ ...p, loading: true, text: '' }))
    try {
      const text = await callAI(modal.action, modal.payload)
      setModal((p) => ({ ...p, text, loading: false }))
    } catch {
      showToast('재생성 실패', 'err')
      setModal((p) => ({ ...p, loading: false }))
    }
  }

  const saveCard = async () => {
    try {
      const hc = (await import('html2canvas')).default
      const el = document.getElementById('shareCard')
      if (!el) return
      const canvas = await hc(el, { backgroundColor: '#141414', scale: 2 })
      const link = document.createElement('a')
      link.download = `dram-${currentLog.brand || 'card'}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
      showToast('이미지 저장됨', 'ok')
    } catch {
      showToast('이미지 저장 실패', 'err')
    }
  }

  const archiveNotion = async () => {
    const token = notionToken || process.env.NEXT_PUBLIC_NOTION_TOKEN
    if (!notionDbId || !token) {
      showToast('DB ID와 Token을 입력해주세요', 'err')
      return
    }
    setNotionStatus('working')
    setNotionError('')
    try {
      const res = await fetch('/api/notion-archive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ log: currentLog as WhiskyLog, notionDbId, notionToken: token }),
      })
      if (!res.ok) {
        const err = await res.json() as { error?: string }
        const msg = err.error || 'Notion 오류'
        setNotionError(
          res.status === 401
            ? '401: Integration이 DB에 연결되지 않았습니다. DB → ··· → Connect to → Integration 선택'
            : res.status === 400
            ? '400: DB ID를 확인해주세요. 32자리 hex ID인지 확인'
            : msg
        )
        setNotionStatus('err')
        return
      }
      setNotionStatus('ok')
      showToast('Notion에 저장됨!', 'ok')
    } catch (e: unknown) {
      setNotionError(e instanceof Error ? e.message : 'Notion 오류')
      setNotionStatus('err')
    }
  }

  const statusDot = (status: NotionStatus) => {
    const colors: Record<NotionStatus, string> = { idle: 'var(--tx3)', working: 'var(--gold)', ok: '#7ecf7e', err: '#cf7e7e' }
    return (
      <span style={{
        display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
        background: colors[status], marginRight: '0.5rem',
        animation: status === 'working' ? 'spin 1s linear infinite' : undefined,
        border: status === 'working' ? '1px solid transparent' : undefined,
      }} />
    )
  }

  const logForAI = { ...currentLog }

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '2rem 1.5rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', alignItems: 'start' }}>

        {/* LEFT — Share Card */}
        <div>
          <div id="shareCard" style={{
            background: '#141414', border: '1px solid rgba(201,168,76,0.35)',
            padding: '2rem', minHeight: 400,
          }}>
            <p className="mono" style={{ fontSize: '0.55rem', color: 'var(--gold)', letterSpacing: '0.15em', marginBottom: '1.5rem' }}>
              Tasting Note · DRAM
            </p>
            <p className="mono" style={{ fontSize: '0.65rem', color: 'var(--tx2)', letterSpacing: '0.12em', marginBottom: '0.35rem', textTransform: 'lowercase' }}>
              {currentLog.region || ''}
            </p>
            <p className="display" style={{ fontSize: '1.8rem', color: 'var(--tx)', lineHeight: 1.2, marginBottom: '0.35rem' }}>
              {currentLog.brand || '—'} {currentLog.age || ''}
            </p>
            <p className="mono" style={{ fontSize: '0.65rem', color: 'var(--tx2)', marginBottom: '1.5rem' }}>
              {[(currentLog.casks || []).join(' · '), currentLog.abv].filter(Boolean).join(' / ')}
            </p>

            <div style={{ height: 1, background: 'rgba(201,168,76,0.3)', marginBottom: '1.25rem' }} />

            {currentLog.nose && (
              <div style={{ marginBottom: '0.75rem' }}>
                <p className="mono" style={{ fontSize: '0.55rem', color: 'var(--gold)', letterSpacing: '0.1em', marginBottom: '0.2rem' }}>NOSE</p>
                <p style={{ fontSize: '0.8rem', color: 'var(--tx2)', fontStyle: 'italic', lineHeight: 1.6 }}>{currentLog.nose}</p>
              </div>
            )}
            {currentLog.palate && (
              <div style={{ marginBottom: '0.75rem' }}>
                <p className="mono" style={{ fontSize: '0.55rem', color: 'var(--gold)', letterSpacing: '0.1em', marginBottom: '0.2rem' }}>PALATE</p>
                <p style={{ fontSize: '0.8rem', color: 'var(--tx2)', fontStyle: 'italic', lineHeight: 1.6 }}>{currentLog.palate}</p>
              </div>
            )}
            {currentLog.finish && (
              <div style={{ marginBottom: '1.25rem' }}>
                <p className="mono" style={{ fontSize: '0.55rem', color: 'var(--gold)', letterSpacing: '0.1em', marginBottom: '0.2rem' }}>FINISH</p>
                <p style={{ fontSize: '0.8rem', color: 'var(--tx2)', fontStyle: 'italic', lineHeight: 1.6 }}>{currentLog.finish}</p>
              </div>
            )}

            <div style={{ height: 1, background: 'rgba(201,168,76,0.3)', marginBottom: '1.25rem' }} />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <p className="display" style={{ fontSize: '2.5rem', color: 'var(--gold)' }}>
                ★ {(currentLog.score ?? 4.0).toFixed(1)}
              </p>
              <p className="display" style={{ fontSize: '1rem', color: 'var(--tx3)', letterSpacing: '0.15em' }}>DRAM</p>
            </div>
          </div>
        </div>

        {/* RIGHT — Controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>

          {/* Export */}
          <div style={{ border: '1px solid var(--bd)', background: 'var(--c2)', marginBottom: '1px' }}>
            <div style={{ padding: '0.6rem 1rem', borderBottom: '1px solid var(--bd)' }}>
              <p className="mono" style={{ fontSize: '0.65rem', color: 'var(--tx2)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Export &amp; Post</p>
            </div>
            <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <button className="btn-outline-gold" style={{ width: '100%', justifyContent: 'center' }}
                onClick={() => openModal('📝 Blog Post', 'gen_blog_post', logForAI)}>
                📝 Blog Post 생성
              </button>
              <button className="btn-outline-gold" style={{ width: '100%', justifyContent: 'center' }}
                onClick={() => openModal('📸 Instagram Post', 'gen_insta_post', logForAI)}>
                📸 Instagram Post 생성
              </button>
              <button className="btn-ghost" style={{ width: '100%', justifyContent: 'center' }} onClick={saveCard}>
                🖼 카드 이미지 저장
              </button>
            </div>
          </div>

          {/* Notion Archive */}
          <div style={{ border: '1px solid var(--bd)', background: 'var(--c2)' }}>
            <div style={{ padding: '0.6rem 1rem', borderBottom: '1px solid var(--bd)', display: 'flex', alignItems: 'center' }}>
              {statusDot(notionStatus)}
              <p className="mono" style={{ fontSize: '0.65rem', color: 'var(--tx2)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Notion Archive</p>
            </div>
            <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {/* DB ID */}
              <div>
                <p className="mono" style={{ fontSize: '0.6rem', color: 'var(--tx3)', marginBottom: '0.35rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Notion DB ID</p>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input type="text" value={dbIdInput} onChange={(e) => setDbIdInput(e.target.value)}
                    placeholder="32자리 DB ID" style={{ border: '1px solid var(--bd)', padding: '0.4rem 0.6rem', flex: 1 }} />
                  <button className="btn-ghost" style={{ whiteSpace: 'nowrap', fontSize: '0.7rem' }}
                    onClick={() => { setNotionDbId(dbIdInput); showToast('DB ID 저장됨', 'ok') }}>
                    저장
                  </button>
                </div>
              </div>
              {/* Token */}
              <div>
                <p className="mono" style={{ fontSize: '0.6rem', color: 'var(--tx3)', marginBottom: '0.35rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Integration Token</p>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input type="password" value={tokenInput} onChange={(e) => setTokenInput(e.target.value)}
                    placeholder="secret_..." style={{ border: '1px solid var(--bd)', padding: '0.4rem 0.6rem', flex: 1 }} />
                  <button className="btn-ghost" style={{ whiteSpace: 'nowrap', fontSize: '0.7rem' }}
                    onClick={() => { setNotionToken(tokenInput); showToast('Token 저장됨', 'ok') }}>
                    저장
                  </button>
                </div>
              </div>

              <button className="btn-gold" style={{ width: '100%', justifyContent: 'center' }}
                disabled={notionStatus === 'working'} onClick={archiveNotion}>
                {notionStatus === 'working' ? <span className="spinner" style={{ borderTopColor: '#000' }} /> : null}
                📓 Notion에 아카이빙
              </button>

              {notionStatus === 'ok' && (
                <div className="fade-up" style={{ border: '1px solid rgba(80,160,80,0.4)', background: 'rgba(80,160,80,0.08)', padding: '0.6rem 0.8rem' }}>
                  <p className="mono" style={{ fontSize: '0.7rem', color: '#7ecf7e', marginBottom: '0.4rem' }}>✓ 저장됨</p>
                  <a href={`https://notion.so/${notionDbId.replace(/-/g, '')}`} target="_blank" rel="noopener noreferrer"
                    className="mono" style={{ fontSize: '0.68rem', color: 'var(--gold)', textDecoration: 'none' }}>
                    🔗 Notion DB 열기 →
                  </a>
                </div>
              )}

              {notionStatus === 'err' && notionError && (
                <div style={{ border: '1px solid rgba(160,60,60,0.4)', background: 'rgba(160,60,60,0.08)', padding: '0.6rem 0.8rem' }}>
                  <p className="mono" style={{ fontSize: '0.68rem', color: '#cf7e7e', lineHeight: 1.5 }}>{notionError}</p>
                </div>
              )}

              {/* Setup Guide */}
              <div style={{ borderTop: '1px solid var(--bd)', paddingTop: '0.75rem' }}>
                <p className="mono" style={{ fontSize: '0.6rem', color: 'var(--tx3)', marginBottom: '0.5rem', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  Notion 설정 가이드
                </p>
                {[
                  'notion.so → Settings → My connections → + New integration → Internal 타입으로 생성',
                  'Secret (token) 복사 → Integration Token에 입력',
                  '아카이빙할 DB 페이지 → ··· → Connect to → 생성한 Integration 선택',
                  'DB URL에서 32자리 ID 복사: notion.so/username/[이32자리가ID]?v=...',
                  'DB 속성: Name(Title) / Distillery / Region / Age / ABV / Cask / Score(Number) / Color / Nose / Palate / Finish / Comment / Date',
                ].map((step, i) => (
                  <div key={i} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.35rem' }}>
                    <span className="mono" style={{ fontSize: '0.6rem', color: 'var(--gold)', flexShrink: 0 }}>{i+1}.</span>
                    <p style={{ fontSize: '0.68rem', color: 'var(--tx2)', lineHeight: 1.5 }}>{step}</p>
                  </div>
                ))}
              </div>

              {/* Share guide */}
              <div style={{ borderTop: '1px solid var(--bd)', paddingTop: '0.75rem' }}>
                <p className="mono" style={{ fontSize: '0.6rem', color: 'var(--tx3)', marginBottom: '0.3rem', letterSpacing: '0.08em', textTransform: 'uppercase' }}>📡 공유 방법</p>
                <p style={{ fontSize: '0.68rem', color: 'var(--tx2)', lineHeight: 1.5 }}>
                  Notion DB → Share → Publish to web → 링크 공유
                </p>
              </div>
            </div>
          </div>

          {/* Collection quick select */}
          {collection.length > 0 && (
            <div style={{ border: '1px solid var(--bd)', background: 'var(--c2)', marginTop: '1px' }}>
              <div style={{ padding: '0.6rem 1rem', borderBottom: '1px solid var(--bd)' }}>
                <p className="mono" style={{ fontSize: '0.65rem', color: 'var(--tx2)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  Recent Drams
                </p>
              </div>
              <div style={{ padding: '0.5rem' }}>
                {collection.slice(0, 5).map((log) => (
                  <button key={log.id} onClick={() => updateCurrentLog({ ...log })}
                    style={{
                      width: '100%', background: 'transparent', border: 'none', cursor: 'pointer',
                      padding: '0.5rem 0.75rem', textAlign: 'left', display: 'flex',
                      justifyContent: 'space-between', alignItems: 'center', transition: 'background 0.15s',
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--c3)' }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--tx)' }}>{log.brand || '—'} {log.age || ''}</span>
                    <span className="mono" style={{ fontSize: '0.65rem', color: 'var(--gold)' }}>★{log.score?.toFixed(1)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* AI Output Modal */}
      <Modal open={modal.open} onClose={() => setModal((p) => ({ ...p, open: false }))}
        title={modal.title}
        actions={
          <>
            <button className="btn-ghost" style={{ fontSize: '0.72rem' }} onClick={regenerate} disabled={modal.loading}>↺ 다시 생성</button>
            <button className="btn-ghost" style={{ fontSize: '0.72rem' }}
              onClick={async () => {
                try { await navigator.clipboard.writeText(modal.text); showToast('복사됨', 'ok') }
                catch { showToast('복사 실패', 'err') }
              }}
              disabled={modal.loading || !modal.text}>
              📋 복사
            </button>
            <button className="btn-ghost" style={{ fontSize: '0.72rem' }} onClick={() => setModal((p) => ({ ...p, open: false }))}>닫기</button>
          </>
        }>
        {modal.loading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem 0' }}>
            <span className="spinner" />
            <span className="mono" style={{ fontSize: '0.72rem', color: 'var(--gold)' }}>Gemini 생성 중...</span>
          </div>
        ) : (
          <textarea rows={10} value={modal.text}
            onChange={(e) => setModal((p) => ({ ...p, text: e.target.value }))}
            style={{ border: '1px solid var(--bd)', padding: '0.75rem', lineHeight: 1.7, width: '100%' }} />
        )}
      </Modal>
    </div>
  )
}
