'use client'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { compressImageToDataUrl } from '@/lib/imageUtils'
import { useStore } from '@/lib/store'
import { useToast } from '@/components/Toast'
import { toHundred } from '@/lib/scoreFormat'
import type { TastingEvent, WhiskyLog, EventBottle } from '@/types'

interface EventDetail {
  event: TastingEvent
  logs: Array<WhiskyLog & { author_nickname?: string }>
}

const fmtDate = (s: string) => {
  try {
    const d = new Date(s)
    return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })
  } catch { return s }
}
const daysUntil = (s: string) => {
  const t = new Date(s + 'T00:00:00').getTime() - Date.now()
  return Math.ceil(t / (1000 * 60 * 60 * 24))
}

function BottleThumb({ bottle, uploading, onUpload, onRemove }: {
  bottle: EventBottle
  uploading: boolean
  onUpload: (file: File) => void
  onRemove: () => void
}) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        title={bottle.image_url ? '사진 변경' : '사진 업로드'}
        style={{
          width: 64, height: 80, padding: 0, cursor: uploading ? 'wait' : 'pointer',
          background: '#0e0c0b', border: `1px solid ${bottle.image_url ? 'var(--gold)' : 'var(--bd2)'}`,
          display: 'block', overflow: 'hidden', position: 'relative',
        }}>
        {bottle.image_url ? (
          <img src={bottle.image_url} alt={bottle.name}
            style={{ width: '100%', height: '100%', objectFit: 'contain', objectPosition: 'center', display: 'block' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
            <span style={{ fontSize: '1.3rem' }}>🥃</span>
            <span className="mono" style={{ fontSize: '0.45rem', color: 'var(--tx3)', letterSpacing: '0.05em' }}>📷 추가</span>
          </div>
        )}
        {uploading && (
          <span style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span className="spinner" />
          </span>
        )}
      </button>
      {bottle.image_url && !uploading && (
        <button
          type="button"
          onClick={onRemove}
          title="사진 제거"
          style={{ position: 'absolute', top: -8, right: -8, width: 20, height: 20, borderRadius: '50%', background: 'var(--c2)', border: '1px solid var(--bd2)', color: 'var(--tx2)', cursor: 'pointer', fontSize: '0.7rem', lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          ✕
        </button>
      )}
      <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }}
        onChange={e => {
          const f = e.target.files?.[0]
          if (f) onUpload(f)
          // 같은 파일 다시 선택 가능하게
          e.target.value = ''
        }} />
    </div>
  )
}

function CreateEventModal({ onClose, onCreated, editEvent }: { onClose: () => void; onCreated: (id: string) => void; editEvent?: TastingEvent }) {
  const { showToast } = useToast()
  const isEdit = !!editEvent
  const [title, setTitle] = useState(editEvent?.title || '')
  const [eventDate, setEventDate] = useState(editEvent?.event_date || (() => {
    const d = new Date(); d.setDate(d.getDate() + 7)
    return d.toISOString().slice(0, 10)
  })())
  const [description, setDescription] = useState(editEvent?.description || '')
  const [bottles, setBottles] = useState<EventBottle[]>(
    editEvent && editEvent.featured_bottles.length > 0
      ? editEvent.featured_bottles.map(b => ({ ...b }))
      : [{ name: '', distillery: '', age: '', region: '', abv: '', bottler: 'OB' }]
  )
  const [saving, setSaving] = useState(false)

  const updateBottle = (i: number, patch: Partial<EventBottle>) =>
    setBottles(prev => prev.map((b, ix) => (ix === i ? { ...b, ...patch } : b)))
  const addBottle = () => setBottles(prev => [...prev, { name: '', distillery: '', age: '', region: '', abv: '', bottler: 'OB' }])
  const removeBottle = (i: number) => setBottles(prev => prev.filter((_, ix) => ix !== i))

  const submit = async () => {
    if (!title.trim()) { showToast('제목을 입력해주세요', 'err'); return }
    if (!eventDate) { showToast('날짜를 선택해주세요', 'err'); return }
    const validBottles = bottles
      // 기존 보틀의 이미지/검증 메타는 보존하면서 텍스트만 trim
      .map(b => ({ ...b, name: b.name.trim(), distillery: b.distillery?.trim(), age: b.age?.trim(), region: b.region?.trim(), abv: b.abv?.trim(), bottler: b.bottler?.trim() || 'OB' }))
      .filter(b => b.name)
    if (validBottles.length === 0) { showToast('보틀을 1개 이상 추가해주세요', 'err'); return }
    setSaving(true)
    try {
      const url = isEdit ? `/api/events/${editEvent!.id}` : '/api/events'
      const res = await fetch(url, {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), event_date: eventDate, description: description.trim(), featured_bottles: validBottles }),
      })
      const json = await res.json() as { data?: TastingEvent; error?: string }
      if (!res.ok || !json.data) {
        const msg = json.error || `${isEdit ? '수정' : '생성'} 실패 (${res.status})`
        if (msg.toLowerCase().includes('row-level') || msg.includes('로그인') || msg.includes('권한')) {
          throw new Error('호스트만 수정할 수 있어요. 호스트 계정으로 로그인했는지 확인해주세요.')
        }
        throw new Error(msg)
      }
      showToast(isEdit ? '시음회 수정됨' : '시음회 등록됨', 'ok')
      onCreated(json.data.id)
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : (isEdit ? '수정 실패' : '생성 실패'), 'err')
    } finally {
      setSaving(false)
    }
  }

  const inp: React.CSSProperties = { width: '100%', padding: '0.55rem 0.7rem', background: 'var(--c3)', border: '1px solid var(--bd2)', color: 'var(--tx)', fontSize: '0.82rem', boxSizing: 'border-box', fontFamily: 'var(--mono)' }
  const label: React.CSSProperties = { fontSize: '0.58rem', color: 'var(--tx3)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.25rem', display: 'block', fontFamily: 'var(--mono)' }

  if (typeof document === 'undefined') return null
  return createPortal(
    <div onClick={() => !saving && onClose()}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.78)', zIndex: 1500,
        overflowY: 'auto', WebkitOverflowScrolling: 'touch',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: 'max(1.25rem, env(safe-area-inset-top))',
        paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))',
        paddingLeft: '0.75rem', paddingRight: '0.75rem',
      }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: 'var(--c2)', border: '1px solid var(--gold)', maxWidth: 620, width: '100%', margin: 'auto 0' }}>
        {/* 헤더 */}
        <div style={{ padding: '0.85rem 1.1rem', borderBottom: '1px solid var(--bd)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', background: 'var(--c2)' }}>
          <p className="mono" style={{ fontSize: '0.65rem', color: 'var(--gold)', letterSpacing: '0.15em', textTransform: 'uppercase' }}>{isEdit ? '✎ 시음회 수정' : '+ 새 시음회 만들기'}</p>
          <button onClick={() => !saving && onClose()} style={{ background: 'none', border: 'none', color: 'var(--tx3)', cursor: 'pointer', fontSize: '1.1rem' }}>✕</button>
        </div>

        {/* 본문 */}
        <div style={{ padding: '1.1rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          <div>
            <span style={label}>제목 *</span>
            <input style={inp} type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="예: 6월 13일 시음회" autoFocus />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.6rem' }}>
            <div>
              <span style={label}>날짜 *</span>
              <input style={inp} type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} />
            </div>
          </div>
          <div>
            <span style={label}>설명 (선택)</span>
            <textarea rows={2} style={{ ...inp, resize: 'vertical', lineHeight: 1.6 }} value={description} onChange={e => setDescription(e.target.value)} placeholder="이번 시음회 컨셉·장소·참여자 안내 등" />
          </div>

          {/* 보틀 목록 */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span style={label}>시음 보틀 ({bottles.length})</span>
              <button onClick={addBottle} type="button" className="mono"
                style={{ background: 'transparent', border: '1px solid var(--gold)', color: 'var(--gold)', padding: '0.25rem 0.6rem', cursor: 'pointer', fontSize: '0.6rem', letterSpacing: '0.06em' }}>
                + 보틀 추가
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {bottles.map((b, i) => (
                <div key={i} style={{ padding: '0.6rem 0.7rem', background: 'var(--c3)', border: '1px solid var(--bd2)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                    <p className="mono" style={{ fontSize: '0.55rem', color: 'var(--gold)', letterSpacing: '0.08em' }}>BOTTLE {i + 1}</p>
                    {bottles.length > 1 && (
                      <button onClick={() => removeBottle(i)} type="button" className="mono"
                        style={{ background: 'none', border: 'none', color: '#cf7e7e', cursor: 'pointer', fontSize: '0.6rem' }}>✕ 제거</button>
                    )}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.45rem' }}>
                    <div>
                      <span style={{ ...label, fontSize: '0.5rem' }}>이름 *</span>
                      <input style={{ ...inp, fontSize: '0.72rem' }} type="text" value={b.name} onChange={e => updateBottle(i, { name: e.target.value })} placeholder="Glen Grant 18" />
                    </div>
                    <div>
                      <span style={{ ...label, fontSize: '0.5rem' }}>증류소</span>
                      <input style={{ ...inp, fontSize: '0.72rem' }} type="text" value={b.distillery || ''} onChange={e => updateBottle(i, { distillery: e.target.value })} placeholder="Glen Grant" />
                    </div>
                    <div>
                      <span style={{ ...label, fontSize: '0.5rem' }}>숙성</span>
                      <input style={{ ...inp, fontSize: '0.72rem' }} type="text" value={b.age || ''} onChange={e => updateBottle(i, { age: e.target.value })} placeholder="18yr" />
                    </div>
                    <div>
                      <span style={{ ...label, fontSize: '0.5rem' }}>지역</span>
                      <input style={{ ...inp, fontSize: '0.72rem' }} type="text" value={b.region || ''} onChange={e => updateBottle(i, { region: e.target.value })} placeholder="Speyside" />
                    </div>
                    <div>
                      <span style={{ ...label, fontSize: '0.5rem' }}>도수</span>
                      <input style={{ ...inp, fontSize: '0.72rem' }} type="text" value={b.abv || ''} onChange={e => updateBottle(i, { abv: e.target.value })} placeholder="43%" />
                    </div>
                    <div>
                      <span style={{ ...label, fontSize: '0.5rem' }}>보틀러</span>
                      <input style={{ ...inp, fontSize: '0.72rem' }} type="text" value={b.bottler || ''} onChange={e => updateBottle(i, { bottler: e.target.value })} placeholder="OB" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 액션 */}
        <div style={{ padding: '0.85rem 1.1rem', borderTop: '1px solid var(--bd)', display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', flexWrap: 'wrap', background: 'var(--c2)' }} className="m-confirm-actions">
          <button className="btn-ghost" onClick={onClose} disabled={saving} style={{ fontSize: '0.72rem' }}>취소</button>
          <button className="btn-gold" onClick={submit} disabled={saving} style={{ fontSize: '0.72rem' }}>
            {saving ? <span className="spinner" style={{ borderTopColor: '#000' }} /> : null}
            {isEdit ? '수정 저장' : '시음회 등록'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

export default function EventPage() {
  const { activeEventId, openEvent, setActiveTab, resetCurrentLog, updateCurrentLog, setScanMode, currentUserId, loadLog, removeFromCollection } = useStore()
  const [deletingLogId, setDeletingLogId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const editLog = (l: WhiskyLog) => {
    loadLog({ ...l })
    setActiveTab('tasting')
  }

  const deleteLog = async (l: WhiskyLog) => {
    if (confirmDeleteId !== l.id) {
      setConfirmDeleteId(l.id)
      // 자동 취소 3초 후
      setTimeout(() => setConfirmDeleteId(prev => (prev === l.id ? null : prev)), 3000)
      return
    }
    setDeletingLogId(l.id)
    try {
      const res = await fetch('/api/whisky-logs', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: l.id }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || `삭제 실패 (${res.status})`)
      }
      // 화면 + 컬렉션 모두 동기화
      setDetail(d => d ? { ...d, logs: d.logs.filter(x => x.id !== l.id) } : d)
      removeFromCollection(l.id)
      showToast('노트 삭제됨', 'ok')
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : '삭제 실패', 'err')
    } finally {
      setDeletingLogId(null)
      setConfirmDeleteId(null)
    }
  }
  const { showToast } = useToast()
  const [list, setList] = useState<TastingEvent[]>([])
  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [listRefreshNonce, setListRefreshNonce] = useState(0)
  const [detail, setDetail] = useState<EventDetail | null>(null)
  const [loading, setLoading] = useState(true)


  // 리스트
  useEffect(() => {
    if (activeEventId) return
    setLoading(true)
    fetch('/api/events')
      .then(r => r.json())
      .then((j: { data?: TastingEvent[] }) => {
        const today = new Date().toISOString().slice(0, 10)
        const sorted = (j.data || []).slice().sort((a, b) => {
          const aUp = a.event_date >= today, bUp = b.event_date >= today
          // 다가올 이벤트를 먼저, 그 안에서는 가까운 날짜순
          if (aUp && bUp) return a.event_date.localeCompare(b.event_date)
          // 둘 다 지난 것이면 최근(내림차순)
          if (!aUp && !bUp) return b.event_date.localeCompare(a.event_date)
          // 다가올 것이 지난 것보다 위
          return aUp ? -1 : 1
        })
        setList(sorted)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [activeEventId, listRefreshNonce])

  // 상세
  useEffect(() => {
    if (!activeEventId) return
    setLoading(true)
    fetch(`/api/events/${activeEventId}`)
      .then(r => r.json())
      .then((j: { data?: TastingEvent; logs?: EventDetail['logs']; error?: string }) => {
        if (j.data) setDetail({ event: j.data, logs: j.logs || [] })
        else if (j.error) showToast(j.error, 'err')
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [activeEventId, showToast])

  // 보틀 이미지 — 사용자가 직접 업로드 (자동 검색 없음)
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null)

  const persistBottles = async (updated: EventBottle[]) => {
    if (!detail) return
    setDetail(d => d ? { ...d, event: { ...d.event, featured_bottles: updated } } : d)
    const r = await fetch(`/api/events/${detail.event.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ featured_bottles: updated }),
    })
    if (!r.ok) {
      const j = await r.json().catch(() => ({}))
      throw new Error(j.error || `저장 실패 (${r.status})`)
    }
  }

  const uploadBottleImage = async (idx: number, file: File) => {
    if (!detail) return
    if (!file.type.startsWith('image/')) { showToast('이미지 파일만 업로드 가능', 'err'); return }
    setUploadingIdx(idx)
    try {
      // 600px·품질 0.78로 압축 → data URL (DB JSON에 그대로 저장)
      const dataUrl = await compressImageToDataUrl(file, 800, 0.8)
      const updated = [...detail.event.featured_bottles]
      updated[idx] = { ...updated[idx], image_url: dataUrl, image_source: 'uploaded', image_verified: true }
      await persistBottles(updated)
      showToast('사진 업데이트됨', 'ok')
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : '업로드 실패', 'err')
    } finally {
      setUploadingIdx(null)
    }
  }

  const removeBottleImage = async (idx: number) => {
    if (!detail) return
    if (!confirm('이 보틀 사진을 제거할까요?')) return
    setUploadingIdx(idx)
    try {
      const updated = [...detail.event.featured_bottles]
      updated[idx] = { ...updated[idx], image_url: undefined, image_source: undefined, image_verified: false }
      await persistBottles(updated)
      showToast('사진 제거됨', 'ok')
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : '제거 실패', 'err')
    } finally {
      setUploadingIdx(null)
    }
  }

  // 보틀별 노트 추가 → 빠른 노트 모드로 진입 (보틀 정보 시드 + 빠른 칩 선택)
  const addNoteForBottle = (b: EventBottle, index: number) => {
    if (!detail) return
    resetCurrentLog()
    updateCurrentLog({
      spirit_type: 'whisky',
      brand: b.distillery || b.name,
      region: b.region || '',
      age: b.age || '',
      abv: b.abv || '',
      bottler: b.bottler || 'OB',
      casks: [],
      date: detail.event.event_date,
      event_id: detail.event.id,
      event_bottle_index: index,
    })
    setScanMode('quick')
    setActiveTab('scan')
  }

  // ── 리스트 모드 ──
  if (!activeEventId) {
    return (
      <div className="m-page fade-up" style={{ maxWidth: 860, margin: '0 auto', padding: '2rem 1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 className="display" style={{ fontSize: '2rem', color: 'var(--tx)' }}>
              🍶 시음회
            </h1>
            <p className="mono" style={{ fontSize: '0.7rem', color: 'var(--tx3)', letterSpacing: '0.08em', marginTop: '0.5rem' }}>
              다가올 시음회 · 참여자 노트를 한 곳에 모으는 이벤트 공간
            </p>
          </div>
          <button
            onClick={() => setCreateOpen(true)}
            className="btn-gold"
            style={{ flexShrink: 0, fontSize: '0.75rem', padding: '0.55rem 0.95rem', justifyContent: 'center' }}>
            + 시음회 만들기
          </button>
        </div>
        <div style={{ height: '1rem' }} />

        {loading && <p className="mono" style={{ fontSize: '0.7rem', color: 'var(--tx3)' }}>불러오는 중...</p>}
        {!loading && list.length === 0 && (
          <p className="mono" style={{ fontSize: '0.75rem', color: 'var(--tx3)' }}>등록된 시음회가 없어요. <b style={{ color: 'var(--gold)' }}>+ 시음회 만들기</b> 로 첫 이벤트를 등록하세요.</p>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: 'var(--bd)' }}>
          {list.map(ev => {
            const d = daysUntil(ev.event_date)
            const status = d > 0 ? `D-${d}` : d === 0 ? 'TODAY' : '지난 이벤트'
            return (
              <button key={ev.id} onClick={() => openEvent(ev.id)}
                style={{ background: 'var(--c2)', border: 'none', cursor: 'pointer', padding: '1rem 1.1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', textAlign: 'left' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p className="display" style={{ fontSize: '1.05rem', color: 'var(--tx)', marginBottom: '0.2rem', lineHeight: 1.3 }}>{ev.title}</p>
                  <p className="mono" style={{ fontSize: '0.6rem', color: 'var(--tx3)' }}>{fmtDate(ev.event_date)} · {ev.featured_bottles.length}개 보틀</p>
                </div>
                <span className="mono" style={{ fontSize: '0.6rem', color: d >= 0 ? 'var(--gold)' : 'var(--tx3)', border: `1px solid ${d >= 0 ? 'var(--gold)' : 'var(--bd)'}`, padding: '0.2rem 0.55rem', flexShrink: 0 }}>
                  {status}
                </span>
              </button>
            )
          })}
        </div>

        {createOpen && (
          <CreateEventModal
            onClose={() => setCreateOpen(false)}
            onCreated={(newId) => {
              setCreateOpen(false)
              setListRefreshNonce(n => n + 1)
              openEvent(newId)
            }}
          />
        )}
      </div>
    )
  }

  // ── 상세 모드 ──
  if (loading || !detail) {
    return <div className="m-page" style={{ padding: '2rem', textAlign: 'center' }}>
      <p className="mono" style={{ fontSize: '0.7rem', color: 'var(--tx3)' }}>이벤트 불러오는 중...</p>
    </div>
  }
  const ev = detail.event
  const d = daysUntil(ev.event_date)
  // 결과 보드는 호스트(관리자)만 — host_user_id 매칭
  const isHost = !!currentUserId && ev.host_user_id === currentUserId

  // ── 결과 집계: 보틀별 평균·표준편차·참여수 ──
  const stats = ev.featured_bottles.map((b, i) => {
    const ls = detail.logs.filter(l => l.event_bottle_index === i)
    const scores = ls.map(l => toHundred(l.score))
    const n = scores.length
    const avg = n ? scores.reduce((s, v) => s + v, 0) / n : 0
    const variance = n > 1 ? scores.reduce((s, v) => s + (v - avg) ** 2, 0) / n : 0
    const stdev = Math.sqrt(variance)
    return { index: i, bottle: b, n, avg: Math.round(avg), stdev: Math.round(stdev * 10) / 10, scores }
  })
  const ranked = stats.filter(s => s.n > 0).sort((a, b) => b.avg - a.avg)
  const totalNotes = detail.logs.length
  const maxAvg = Math.max(1, ...ranked.map(s => s.avg))
  const winner = ranked[0]

  // 호불호: 표준편차 기준 — 8↑ 갈림, 4↓ 한목소리
  const divisiveness = (sd: number) => sd >= 8 ? { label: '호불호 갈림', color: '#cf7e7e' } : sd <= 4 ? { label: '한목소리', color: '#7ec59a' } : { label: '보통', color: 'var(--tx3)' }

  const shareResult = async () => {
    const lines = [`🥃 ${ev.title} — 시음 결과`, fmtDate(ev.event_date), '']
    ranked.forEach((s, idx) => {
      const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`
      lines.push(`${medal} ${s.bottle.name} — 평균 ${s.avg}/100 (${s.n}명${s.stdev >= 8 ? ', 호불호 갈림' : ''})`)
    })
    lines.push('', `참여 노트 ${totalNotes}개 · Oak The Record`)
    const text = lines.join('\n')
    try {
      if (navigator.share) {
        await navigator.share({ title: ev.title, text })
      } else {
        await navigator.clipboard.writeText(text)
        showToast('결과를 클립보드에 복사했어요', 'ok')
      }
    } catch { /* 사용자 취소 */ }
  }

  return (
    <div className="m-page fade-up" style={{ maxWidth: 920, margin: '0 auto', padding: '2rem 1.5rem' }}>
      {/* 뒤로 */}
      <button onClick={() => useStore.setState({ activeEventId: null })} className="mono"
        style={{ background: 'transparent', border: 'none', color: 'var(--tx3)', cursor: 'pointer', fontSize: '0.7rem', marginBottom: '1rem', padding: 0 }}>
        ← 시음회 목록
      </button>

      {/* 헤더 */}
      <div style={{ marginBottom: '2rem', paddingBottom: '1rem', borderBottom: '1px solid var(--bd)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
          <span className="mono" style={{ fontSize: '0.62rem', color: d >= 0 ? 'var(--gold)' : 'var(--tx3)', border: `1px solid ${d >= 0 ? 'var(--gold)' : 'var(--bd)'}`, padding: '0.2rem 0.55rem', letterSpacing: '0.08em' }}>
            {d > 0 ? `D-${d}` : d === 0 ? 'TODAY' : '지난 이벤트'}
          </span>
          <span className="mono" style={{ fontSize: '0.6rem', color: 'var(--tx3)' }}>호스트 · {ev.host_nickname}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem', flexWrap: 'wrap' }}>
          <h1 className="display" style={{ fontSize: '1.8rem', color: 'var(--tx)', marginBottom: '0.3rem', lineHeight: 1.25, flex: 1, minWidth: 0 }}>{ev.title}</h1>
          {isHost && (
            <button onClick={() => setEditOpen(true)} className="mono"
              style={{ flexShrink: 0, background: 'transparent', border: '1px solid var(--bd2)', color: 'var(--gold)', cursor: 'pointer', fontSize: '0.66rem', padding: '0.35rem 0.7rem', letterSpacing: '0.05em' }}>
              ✎ 시음회 수정
            </button>
          )}
        </div>
        <p className="mono" style={{ fontSize: '0.7rem', color: 'var(--gold)', marginBottom: '0.5rem' }}>{fmtDate(ev.event_date)}</p>
        {ev.description && <p style={{ fontSize: '0.82rem', color: 'var(--tx2)', lineHeight: 1.7 }}>{ev.description}</p>}
      </div>

      {/* ── 라이브 결과 보드 (호스트 전용, 노트 1개 이상) ── */}
      {isHost && ranked.length > 0 && (
        <div style={{ border: '1px solid var(--bd2)', background: 'var(--c2)', marginBottom: '1.5rem' }}>
          <div style={{ padding: '0.7rem 1rem', borderBottom: '1px solid var(--bd)', background: 'var(--c3)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <p className="mono" style={{ fontSize: '0.6rem', color: 'var(--gold)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
              📊 라이브 결과 · 노트 {totalNotes}개 <span style={{ color: 'var(--tx3)' }}>· 🔒 호스트 전용</span>
            </p>
            <button onClick={shareResult} className="mono"
              style={{ background: 'transparent', border: '1px solid var(--gold)', color: 'var(--gold)', cursor: 'pointer', fontSize: '0.6rem', padding: '0.25rem 0.6rem', letterSpacing: '0.05em' }}>
              ↗ 결과 공유
            </button>
          </div>

          {/* 우승 보틀 */}
          {winner && winner.n > 0 && (
            <div style={{ padding: '0.85rem 1rem', borderBottom: '1px solid var(--bd)', display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'rgba(198,107,61,0.06)' }}>
              <span style={{ fontSize: '1.6rem' }}>🥇</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p className="mono" style={{ fontSize: '0.52rem', color: 'var(--gold)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.15rem' }}>오늘의 우승 보틀</p>
                <p className="display" style={{ fontSize: '1.15rem', color: 'var(--tx)', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{winner.bottle.name}</p>
              </div>
              <span className="display" style={{ fontSize: '1.5rem', color: 'var(--gold)', flexShrink: 0 }}>{winner.avg}<span style={{ fontSize: '0.55rem', color: 'var(--tx3)' }}>/100</span></span>
            </div>
          )}

          {/* 순위 막대 그래프 */}
          <div style={{ padding: '0.85rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
            {ranked.map((s, idx) => {
              const div = divisiveness(s.stdev)
              const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}`
              return (
                <div key={s.index}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.5rem', marginBottom: '0.25rem', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.78rem', color: 'var(--tx)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <span style={{ marginRight: '0.35rem' }}>{medal}</span>{s.bottle.name}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', flexShrink: 0 }}>
                      <span className="mono" style={{ fontSize: '0.55rem', color: div.color }}>{s.n}명 · {div.label}</span>
                      <span className="display" style={{ fontSize: '0.95rem', color: 'var(--gold)' }}>{s.avg}</span>
                    </span>
                  </div>
                  <div style={{ height: 8, background: 'var(--c3)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${(s.avg / maxAvg) * 100}%`, background: idx === 0 ? 'var(--gold)' : 'rgba(198,107,61,0.5)', borderRadius: 4, transition: 'width 0.4s' }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 비호스트 — 결과는 호스트만 집계 안내 (노트가 있을 때) */}
      {!isHost && totalNotes > 0 && (
        <div style={{ border: '1px dashed var(--bd2)', background: 'var(--c3)', marginBottom: '1.5rem', padding: '0.85rem 1rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <span style={{ fontSize: '1.1rem' }}>🔒</span>
          <p className="mono" style={{ fontSize: '0.62rem', color: 'var(--tx3)', lineHeight: 1.7 }}>
            종합 결과(순위·우승·평균)는 <b style={{ color: 'var(--gold)' }}>호스트</b>만 볼 수 있어요.<br />
            본인 노트는 아래에서 자유롭게 작성·수정하세요.
          </p>
        </div>
      )}

      {/* 보틀별 카드 + 참여자 노트 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {ev.featured_bottles.map((b, i) => {
          const bottleLogs = detail.logs.filter(l => l.event_bottle_index === i)
          const avg = bottleLogs.length
            ? Math.round(bottleLogs.reduce((s, l) => s + toHundred(l.score), 0) / bottleLogs.length)
            : null
          return (
            <div key={i} style={{ border: '1px solid var(--bd2)', background: 'var(--c2)' }}>
              <div style={{ width: '100%', padding: '0.85rem 1rem', borderBottom: '1px solid var(--bd)', background: 'var(--c3)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.85rem', flexWrap: 'wrap' }}>
                {/* 보틀 썸네일 (사용자 업로드) */}
                <BottleThumb
                  bottle={b}
                  uploading={uploadingIdx === i}
                  onUpload={(file) => uploadBottleImage(i, file)}
                  onRemove={() => removeBottleImage(i)}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p className="mono" style={{ fontSize: '0.55rem', color: 'var(--gold)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.15rem' }}>
                    Bottle {i + 1}
                  </p>
                  <p className="display" style={{ fontSize: '1.15rem', color: 'var(--tx)', lineHeight: 1.25 }}>{b.name}</p>
                  <p className="mono" style={{ fontSize: '0.6rem', color: 'var(--tx3)', marginTop: '0.15rem' }}>
                    {[b.distillery, b.age, b.region].filter(Boolean).join(' · ')}
                  </p>
                </div>
                {avg !== null && (
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <p className="display" style={{ fontSize: '1.4rem', color: 'var(--gold)', lineHeight: 1 }}>{avg}</p>
                    <p className="mono" style={{ fontSize: '0.5rem', color: 'var(--tx3)' }}>avg · {bottleLogs.length}명</p>
                  </div>
                )}
              </div>

              {/* 참여자 노트들 */}
              {bottleLogs.length === 0 ? (
                <p className="mono" style={{ fontSize: '0.65rem', color: 'var(--tx3)', padding: '1rem', lineHeight: 1.6 }}>
                  아직 작성된 노트가 없어요. 첫 노트를 남겨주세요.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: 'var(--bd)' }}>
                  {bottleLogs.map(l => {
                    const isMine = !!currentUserId && l.user_id === currentUserId
                    const isConfirming = confirmDeleteId === l.id
                    const isDeleting = deletingLogId === l.id
                    return (
                    <div key={l.id} style={{ background: isMine ? 'rgba(198,107,61,0.05)' : 'var(--c2)', padding: '0.75rem 1rem', borderLeft: isMine ? '2px solid var(--gold)' : '2px solid transparent' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
                        <span className="mono" style={{ fontSize: '0.62rem', color: 'var(--gold)' }}>
                          @{l.author_nickname}{isMine && <span style={{ marginLeft: '0.3rem', fontSize: '0.55rem', color: 'var(--tx3)' }}>(나)</span>}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          {isMine && (
                            <div style={{ display: 'flex', gap: '0.25rem' }}>
                              <button onClick={() => editLog(l)} title="수정"
                                disabled={isDeleting}
                                style={{ background: 'transparent', border: '1px solid var(--bd2)', color: 'var(--gold)', cursor: 'pointer', fontSize: '0.65rem', padding: '0.2rem 0.45rem', lineHeight: 1, fontFamily: 'var(--mono)' }}>
                                ✎
                              </button>
                              <button onClick={() => deleteLog(l)} title={isConfirming ? '한 번 더 누르면 삭제' : '삭제'}
                                disabled={isDeleting}
                                style={{ background: isConfirming ? 'rgba(207,126,126,0.18)' : 'transparent', border: `1px solid ${isConfirming ? '#cf7e7e' : 'var(--bd2)'}`, color: isConfirming ? '#cf7e7e' : 'var(--tx3)', cursor: isDeleting ? 'wait' : 'pointer', fontSize: '0.65rem', padding: '0.2rem 0.45rem', lineHeight: 1, fontFamily: 'var(--mono)' }}>
                                {isDeleting ? '...' : isConfirming ? '한번 더' : '🗑'}
                              </button>
                            </div>
                          )}
                          <span className="display" style={{ fontSize: '1rem', color: 'var(--gold)' }}>{toHundred(l.score)}<span style={{ fontSize: '0.55rem', color: 'var(--tx3)' }}>/100</span></span>
                        </div>
                      </div>
                      {l.comment && <p style={{ fontSize: '0.75rem', color: 'var(--tx)', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>{l.comment}</p>}
                      {(l.nose || l.palate || l.finish) && (
                        <div style={{ marginTop: '0.4rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                          {l.nose && <p style={{ fontSize: '0.68rem', color: 'var(--tx2)', lineHeight: 1.55 }}><span style={{ color: 'var(--gold)' }}>🌸</span> {l.nose}</p>}
                          {l.palate && <p style={{ fontSize: '0.68rem', color: 'var(--tx2)', lineHeight: 1.55 }}><span style={{ color: 'var(--gold)' }}>🥃</span> {l.palate}</p>}
                          {l.finish && <p style={{ fontSize: '0.68rem', color: 'var(--tx2)', lineHeight: 1.55 }}><span style={{ color: 'var(--gold)' }}>✨</span> {l.finish}</p>}
                        </div>
                      )}
                    </div>
                  )})}
                </div>
              )}

              <div style={{ padding: '0.7rem 1rem', borderTop: '1px solid var(--bd)' }}>
                <button onClick={() => addNoteForBottle(b, i)} className="btn-outline-gold"
                  style={{ width: '100%', justifyContent: 'center', fontSize: '0.72rem' }}>
                  + 내 시음 노트 추가
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {editOpen && (
        <CreateEventModal
          editEvent={ev}
          onClose={() => setEditOpen(false)}
          onCreated={(id) => {
            setEditOpen(false)
            // 상세 새로고침
            fetch(`/api/events/${id}`)
              .then(r => r.json())
              .then((j: { data?: TastingEvent; logs?: EventDetail['logs'] }) => {
                if (j.data) setDetail({ event: j.data, logs: j.logs || [] })
              })
              .catch(() => {})
          }}
        />
      )}
    </div>
  )
}
