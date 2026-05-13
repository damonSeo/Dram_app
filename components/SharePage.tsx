'use client'
import { useState } from 'react'
import { useStore } from '@/lib/store'
import { useToast } from '@/components/Toast'
import Modal from '@/components/Modal'

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
  const { currentLog, collection, updateCurrentLog, removeFromCollection, setActiveTab, currentUserId, loadLog } = useStore()
  const { showToast } = useToast()

  const [modal, setModal] = useState({ open: false, title: '', text: '', loading: false, action: '', payload: {} as object })
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // 편집/삭제 권한: 본인 기록이거나 레거시 anonymous 기록
  const canEdit =
    !currentLog.user_id ||
    currentLog.user_id === 'anonymous' ||
    (currentUserId && currentLog.user_id === currentUserId)

  const handleEdit = () => {
    // 현재 로그를 그대로 들고 Tasting 탭으로 이동 → 거기서 수정 후 컬렉션에 저장
    loadLog({ ...currentLog })
    setActiveTab('tasting')
    showToast('수정 모드로 전환됨', 'ok')
  }

  const handleDelete = async () => {
    if (!currentLog.id) return
    if (!confirmDelete) {
      setConfirmDelete(true)
      setTimeout(() => setConfirmDelete(false), 3000)
      return
    }
    setDeleting(true)
    try {
      const res = await fetch('/api/whisky-logs', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: currentLog.id }),
      })
      if (!res.ok) throw new Error('삭제 실패')
      removeFromCollection(currentLog.id as string)
      showToast('삭제됨', 'ok')
      setActiveTab('collection')
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : '삭제 실패', 'err')
    } finally {
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

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

      // canvas -> Blob
      const blob: Blob | null = await new Promise((resolve) =>
        canvas.toBlob((b) => resolve(b), 'image/png')
      )
      if (!blob) throw new Error('이미지 변환 실패')

      const fileName = `dram-${(currentLog.brand || 'card').replace(/[^a-zA-Z0-9가-힣]/g, '_')}.png`
      const file = new File([blob], fileName, { type: 'image/png' })

      // 모바일: Web Share API (사진첩/앨범에 저장 가능)
      const nav = navigator as Navigator & { canShare?: (data: { files?: File[] }) => boolean }
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
      if (isMobile && nav.canShare && nav.canShare({ files: [file] }) && navigator.share) {
        try {
          await navigator.share({
            files: [file],
            title: `DRAM · ${currentLog.brand || ''}`,
            text: '시스템 메뉴에서 "이미지 저장"을 선택해 사진첩에 저장하세요.',
          })
          showToast('공유 완료 · 사진첩에 저장하세요', 'ok')
          return
        } catch (err) {
          // 사용자가 취소한 경우엔 실패로 처리하지 않음
          const dom = err as DOMException
          if (dom?.name === 'AbortError') return
          // 그 외 오류는 다운로드 폴백으로 이어짐
        }
      }

      // 데스크톱 / 비지원 브라우저: 다운로드 폴백
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.download = fileName
      link.href = url
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      showToast('이미지 저장됨', 'ok')
    } catch {
      showToast('이미지 저장 실패', 'err')
    }
  }

  const logForAI = { ...currentLog }

  return (
    <div className="m-page" style={{ maxWidth: 1000, margin: '0 auto', padding: '2rem 1.5rem' }}>
      <div className="m-share-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', alignItems: 'start' }}>

        {/* LEFT — Share Card */}
        <div>
          <div id="shareCard" style={{
            background: '#141414', border: '1px solid rgba(201,168,76,0.35)',
            padding: '2rem', minHeight: 400,
          }}>
            <p className="mono" style={{ fontSize: '0.55rem', color: 'var(--gold)', letterSpacing: '0.15em', marginBottom: '1.5rem' }}>
              Tasting Note · OAK THE RECORD
            </p>

            {/* 업로드한 라벨 사진 */}
            {currentLog.image_url && (
              <div style={{
                marginBottom: '1.25rem',
                width: '100%',
                aspectRatio: '4 / 3',
                background: '#0c0c0c',
                border: '1px solid rgba(201,168,76,0.25)',
                position: 'relative',
                overflow: 'hidden',
              }}>
                <img
                  src={currentLog.image_url}
                  alt="라벨"
                  crossOrigin="anonymous"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                    display: 'block',
                  }}
                />
              </div>
            )}

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
                <p className="mono" style={{ fontSize: '0.55rem', color: 'var(--gold)', letterSpacing: '0.1em', marginBottom: '0.2rem' }}>향</p>
                <p style={{ fontSize: '0.8rem', color: 'var(--tx2)', fontStyle: 'italic', lineHeight: 1.6 }}>{currentLog.nose}</p>
              </div>
            )}
            {currentLog.palate && (
              <div style={{ marginBottom: '0.75rem' }}>
                <p className="mono" style={{ fontSize: '0.55rem', color: 'var(--gold)', letterSpacing: '0.1em', marginBottom: '0.2rem' }}>맛</p>
                <p style={{ fontSize: '0.8rem', color: 'var(--tx2)', fontStyle: 'italic', lineHeight: 1.6 }}>{currentLog.palate}</p>
              </div>
            )}
            {currentLog.finish && (
              <div style={{ marginBottom: '1.25rem' }}>
                <p className="mono" style={{ fontSize: '0.55rem', color: 'var(--gold)', letterSpacing: '0.1em', marginBottom: '0.2rem' }}>여운</p>
                <p style={{ fontSize: '0.8rem', color: 'var(--tx2)', fontStyle: 'italic', lineHeight: 1.6 }}>{currentLog.finish}</p>
              </div>
            )}

            {/* 자유 코멘트 */}
            {currentLog.comment && (
              <div style={{ marginBottom: '1.25rem', padding: '0.75rem 0.9rem', background: 'rgba(201,168,76,0.05)', borderLeft: '2px solid var(--gold)' }}>
                <p className="mono" style={{ fontSize: '0.55rem', color: 'var(--gold)', letterSpacing: '0.1em', marginBottom: '0.3rem', textTransform: 'uppercase' }}>한 줄 코멘트</p>
                <p style={{ fontSize: '0.82rem', color: 'var(--tx)', lineHeight: 1.75, whiteSpace: 'pre-wrap' }}>{currentLog.comment}</p>
              </div>
            )}

            <div style={{ height: 1, background: 'rgba(201,168,76,0.3)', marginBottom: '1.25rem' }} />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <div>
                <p className="display" style={{ fontSize: '2.5rem', color: 'var(--gold)', lineHeight: 1 }}>
                  {Math.round((currentLog.score ?? 70) <= 10 ? (currentLog.score ?? 70) * 10 : (currentLog.score ?? 70))}
                  <span style={{ fontSize: '0.9rem', color: 'var(--tx3)' }}> / 100</span>
                </p>
                {currentLog.would_rebuy === 'yes' && (
                  <p className="mono" style={{ fontSize: '0.7rem', color: 'var(--gd)', marginTop: '0.3rem', letterSpacing: '0.06em' }}>
                    🍾 다시 사고 싶은 한 병
                  </p>
                )}
              </div>
              <p className="display" style={{ fontSize: '1rem', color: 'var(--tx3)', letterSpacing: '0.15em' }}>OAK · THE RECORD</p>
            </div>
          </div>
        </div>

        {/* RIGHT — Controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>

          {/* Manage — 수정 / 삭제 */}
          {currentLog.id && canEdit && (
            <div style={{ border: '1px solid var(--bd)', background: 'var(--c2)', marginBottom: '1px' }}>
              <div style={{ padding: '0.6rem 1rem', borderBottom: '1px solid var(--bd)' }}>
                <p className="mono" style={{ fontSize: '0.65rem', color: 'var(--tx2)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  Manage
                </p>
              </div>
              <div style={{ padding: '1rem', display: 'flex', gap: '0.5rem' }}>
                <button className="btn-outline-gold" style={{ flex: 1, justifyContent: 'center' }}
                  onClick={handleEdit}>
                  ✎ 수정하기
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  style={{
                    flex: confirmDelete ? 1.4 : 1,
                    background: confirmDelete ? '#cf7e7e' : 'transparent',
                    border: `1px solid ${confirmDelete ? '#cf7e7e' : '#cf7e7e'}`,
                    color: confirmDelete ? '#fff' : '#cf7e7e',
                    padding: '0.5rem 0.85rem',
                    cursor: deleting ? 'wait' : 'pointer',
                    fontSize: '0.72rem',
                    fontFamily: 'var(--mono)',
                    transition: 'all 0.15s',
                  }}>
                  {deleting ? <span className="spinner" style={{ borderTopColor: '#cf7e7e' }} /> :
                   confirmDelete ? '🗑 정말 삭제?' : '🗑 삭제'}
                </button>
              </div>
            </div>
          )}

          {/* Export */}
          <div style={{ border: '1px solid var(--bd)', background: 'var(--c2)' }}>
            <div style={{ padding: '0.6rem 1rem', borderBottom: '1px solid var(--bd)' }}>
              <p className="mono" style={{ fontSize: '0.65rem', color: 'var(--tx2)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Export &amp; Post</p>
            </div>
            <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <button className="btn-outline-gold" style={{ width: '100%', justifyContent: 'center' }}
                onClick={() => openModal('📝 블로그 포스트', 'gen_blog_post', logForAI)}>
                📝 블로그 포스트 생성
              </button>
              <button className="btn-outline-gold" style={{ width: '100%', justifyContent: 'center' }}
                onClick={() => openModal('📸 인스타그램 포스트', 'gen_insta_post', logForAI)}>
                📸 인스타그램 포스트 생성
              </button>
              <button className="btn-ghost" style={{ width: '100%', justifyContent: 'center' }} onClick={saveCard}>
                🖼 카드 이미지 저장 · 사진첩
              </button>
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
                    <span className="mono" style={{ fontSize: '0.65rem', color: 'var(--gold)' }}>{Math.round((log.score ?? 0) <= 10 ? (log.score ?? 0) * 10 : (log.score ?? 0))}/100</span>
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
            <span className="mono" style={{ fontSize: '0.72rem', color: 'var(--gold)' }}>AI 생성 중...</span>
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
