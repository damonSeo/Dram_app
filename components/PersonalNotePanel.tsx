'use client'
import { useEffect, useState } from 'react'
import { useStore } from '@/lib/store'
import { useToast } from '@/components/Toast'
import EmojiKeySelector from '@/components/EmojiKeySelector'
import { findEmojiForLabel } from '@/lib/tastingEmojis'
import type { WhiskyLog, PersonalNote } from '@/types'

interface Props {
  log: WhiskyLog
  onClose: () => void
  onEdit?: (log: WhiskyLog) => void
  onDelete?: (log: WhiskyLog) => Promise<void> | void
}

export default function PersonalNotePanel({ log, onClose, onEdit, onDelete }: Props) {
  const { currentUserId } = useStore()
  const { showToast } = useToast()
  const [notes, setNotes] = useState<PersonalNote[]>([])
  const [loading, setLoading] = useState(true)
  const [content, setContent] = useState('')
  const [keys, setKeys] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // 본인 기록이거나 레거시 anonymous 기록이면 수정/삭제 가능
  const canEdit =
    !log.user_id || log.user_id === 'anonymous' ||
    (currentUserId && log.user_id === currentUserId)
  const isOwnLog = canEdit
  const myNote = notes.find((n) => n.user_id === currentUserId)
  const otherNotes = notes.filter((n) => n.user_id !== currentUserId)

  const handleEditClick = () => {
    if (onEdit) onEdit(log)
    onClose()
  }

  const handleDeleteClick = async () => {
    if (!confirmDel) {
      setConfirmDel(true)
      setTimeout(() => setConfirmDel(false), 3000)
      return
    }
    setDeleting(true)
    try {
      if (onDelete) await onDelete(log)
      onClose()
    } catch {
      setDeleting(false)
      setConfirmDel(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/personal-notes?log_id=${log.id}`)
        const json = await res.json() as { data?: PersonalNote[] }
        if (!cancelled) {
          const list = json.data || []
          setNotes(list)
          // 내 노트가 있으면 폼에 미리 채움
          const mine = list.find((n) => n.user_id === currentUserId)
          if (mine) {
            setContent(mine.content || '')
            setKeys(mine.selected_keys || [])
          }
        }
      } catch {
        if (!cancelled) showToast('노트 불러오기 실패', 'err')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [log.id, currentUserId, showToast])

  const save = async () => {
    if (!currentUserId) { showToast('로그인이 필요합니다', 'err'); return }
    if (!content.trim() && keys.length === 0) { showToast('내용 또는 키워드를 추가해주세요', 'err'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/personal-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ log_id: log.id, content, selected_keys: keys }),
      })
      const json = await res.json() as { data?: PersonalNote; error?: string }
      if (!res.ok) throw new Error(json.error || '저장 실패')
      // refresh
      const r = await fetch(`/api/personal-notes?log_id=${log.id}`)
      const j = await r.json() as { data?: PersonalNote[] }
      setNotes(j.data || [])
      showToast('개인 노트 저장됨', 'ok')
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : '저장 실패', 'err')
    } finally {
      setSaving(false)
    }
  }

  const removeMyNote = async () => {
    if (!myNote) return
    if (!confirm('내 개인 노트를 삭제할까요?')) return
    try {
      const res = await fetch('/api/personal-notes', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: myNote.id }),
      })
      if (!res.ok) throw new Error('삭제 실패')
      setNotes((prev) => prev.filter((n) => n.id !== myNote.id))
      setContent(''); setKeys([])
      showToast('삭제됨', 'ok')
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : '삭제 실패', 'err')
    }
  }

  return (
    <div onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.78)', zIndex: 1500, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '1rem', overflowY: 'auto' }}>
      <div onClick={(e) => e.stopPropagation()}
        className="m-modal-panel"
        style={{ background: 'var(--c2)', border: '1px solid var(--gold)', maxWidth: 680, width: '100%', marginTop: '4vh', marginBottom: '4vh' }}>
        {/* Header — 타이틀 + 우상단 수정/삭제/닫기 */}
        <div style={{ padding: '0.7rem 1rem 0.7rem 1.25rem', borderBottom: '1px solid var(--bd)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: 'var(--c2)', zIndex: 1, gap: '0.5rem' }}>
          <p className="mono" style={{ fontSize: '0.65rem', color: 'var(--gold)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            📝 개인 노트
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            {canEdit && onEdit && (
              <button
                onClick={handleEditClick}
                title="수정"
                className="mono"
                style={{
                  background: 'transparent',
                  border: '1px solid var(--bd2)',
                  color: 'var(--gold)',
                  padding: '0.3rem 0.6rem',
                  cursor: 'pointer',
                  fontSize: '0.68rem',
                  letterSpacing: '0.05em',
                  display: 'flex', alignItems: 'center', gap: '0.25rem',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--gold)'; (e.currentTarget as HTMLButtonElement).style.color = '#fff' }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--gold)' }}
              >
                ✎ 수정
              </button>
            )}
            {canEdit && onDelete && (
              <button
                onClick={handleDeleteClick}
                disabled={deleting}
                title={confirmDel ? '한 번 더 눌러 삭제' : '삭제'}
                className="mono"
                style={{
                  background: confirmDel ? '#cf7e7e' : 'transparent',
                  border: '1px solid #cf7e7e',
                  color: confirmDel ? '#fff' : '#cf7e7e',
                  padding: '0.3rem 0.6rem',
                  cursor: deleting ? 'wait' : 'pointer',
                  fontSize: '0.68rem',
                  letterSpacing: '0.05em',
                  display: 'flex', alignItems: 'center', gap: '0.25rem',
                  transition: 'all 0.15s',
                }}
              >
                {deleting ? <span className="spinner" style={{ borderTopColor: '#cf7e7e' }} /> : confirmDel ? '🗑 정말?' : '🗑 삭제'}
              </button>
            )}
            <button onClick={onClose}
              title="닫기"
              style={{ background: 'none', border: 'none', color: 'var(--tx3)', cursor: 'pointer', fontSize: '1rem', padding: '0.2rem 0.4rem', marginLeft: '0.2rem' }}>
              ✕
            </button>
          </div>
        </div>

        {/* 원본 위스키 정보 */}
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--bd)', background: 'var(--c3)' }}>
          <p className="mono" style={{ fontSize: '0.58rem', color: 'var(--tx3)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
            {log.region || '—'} {log.spirit_type && log.spirit_type !== 'whisky' && `· ${log.spirit_type}`}
          </p>
          <p className="display" style={{ fontSize: '1.4rem', color: 'var(--tx)', lineHeight: 1.2, marginBottom: '0.25rem' }}>
            {log.brand || '—'}
          </p>
          <p className="mono" style={{ fontSize: '0.65rem', color: 'var(--tx2)' }}>
            {[log.age, log.abv].filter(Boolean).join(' · ')} · ★ {log.score?.toFixed(1) || '—'}
          </p>
          {(isOwnLog) && (
            <p className="mono" style={{ fontSize: '0.6rem', color: 'var(--gold)', marginTop: '0.4rem' }}>
              ◈ 내 기록
            </p>
          )}
        </div>

        {/* 다른 사람들의 개인 노트 (있으면) */}
        {!loading && otherNotes.length > 0 && (
          <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--bd)' }}>
            <p className="mono" style={{ fontSize: '0.6rem', color: 'var(--tx3)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
              💬 다른 사람들의 노트 ({otherNotes.length})
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {otherNotes.map((n) => (
                <div key={n.id} style={{ padding: '0.6rem 0.8rem', background: 'var(--c3)', border: '1px solid var(--bd)' }}>
                  <p className="mono" style={{ fontSize: '0.62rem', color: 'var(--gold)', marginBottom: '0.35rem' }}>
                    @ {n.author_nickname || '익명'}
                  </p>
                  {n.selected_keys && n.selected_keys.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginBottom: '0.4rem' }}>
                      {n.selected_keys.map((k, i) => {
                        const e = findEmojiForLabel(k, 'palate')
                        return (
                          <span key={`${k}-${i}`} className="mono" style={{ fontSize: '0.62rem', color: 'var(--tx)', padding: '0.15rem 0.4rem', background: 'var(--c2)', border: '1px solid var(--bd2)' }}>
                            {e && <span style={{ marginRight: 3 }}>{e}</span>}{k}
                          </span>
                        )
                      })}
                    </div>
                  )}
                  {n.content && <p style={{ fontSize: '0.78rem', color: 'var(--tx)', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{n.content}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 내 개인 노트 작성 */}
        <div style={{ padding: '1rem 1.25rem' }}>
          {!currentUserId ? (
            <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
              <p style={{ fontSize: '0.85rem', color: 'var(--tx2)', marginBottom: '0.75rem' }}>
                개인 노트를 작성하려면 로그인이 필요합니다.
              </p>
              <p className="mono" style={{ fontSize: '0.65rem', color: 'var(--tx3)' }}>
                상단 우측의 카카오 로그인 버튼을 눌러주세요.
              </p>
            </div>
          ) : (
            <>
              <p className="mono" style={{ fontSize: '0.6rem', color: 'var(--gold)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                ✎ 내 노트 {myNote && '(이미 저장됨 — 수정 가능)'}
              </p>

              <div style={{ marginBottom: '0.75rem' }}>
                <p className="mono" style={{ fontSize: '0.6rem', color: 'var(--tx3)', marginBottom: '0.4rem', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  키워드 선택 (선택한 순서대로 저장됨)
                </p>
                <EmojiKeySelector selected={keys} onChange={setKeys} />
              </div>

              <div style={{ marginBottom: '0.75rem' }}>
                <p className="mono" style={{ fontSize: '0.6rem', color: 'var(--tx3)', marginBottom: '0.4rem', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  자유 메모 (선택)
                </p>
                <textarea rows={3} value={content} onChange={(e) => setContent(e.target.value)}
                  placeholder="이 위스키에 대한 개인 감상을 자유롭게..."
                  style={{ border: '1px solid var(--bd)', padding: '0.5rem 0.7rem', background: 'var(--c3)', color: 'var(--tx)', lineHeight: 1.6, fontSize: '0.85rem' }} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
                {myNote ? (
                  <button onClick={removeMyNote} disabled={saving}
                    style={{ background: 'transparent', border: '1px solid #cf7e7e', color: '#cf7e7e', padding: '0.4rem 0.85rem', cursor: 'pointer', fontSize: '0.7rem', fontFamily: 'var(--mono)' }}>
                    🗑 내 노트 삭제
                  </button>
                ) : <span />}
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className="btn-ghost" onClick={onClose} disabled={saving} style={{ fontSize: '0.72rem' }}>취소</button>
                  <button className="btn-gold" onClick={save} disabled={saving} style={{ fontSize: '0.72rem' }}>
                    {saving ? <span className="spinner" style={{ borderTopColor: '#000' }} /> : null}
                    {myNote ? '수정 저장' : '노트 저장'}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
