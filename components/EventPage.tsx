'use client'
import { useEffect, useRef, useState } from 'react'
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

function CreateEventModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const { showToast } = useToast()
  const [title, setTitle] = useState('')
  const [eventDate, setEventDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 7)
    return d.toISOString().slice(0, 10)
  })
  const [description, setDescription] = useState('')
  const [bottles, setBottles] = useState<EventBottle[]>([{ name: '', distillery: '', age: '', region: '', abv: '', bottler: 'OB' }])
  const [saving, setSaving] = useState(false)

  const updateBottle = (i: number, patch: Partial<EventBottle>) =>
    setBottles(prev => prev.map((b, ix) => (ix === i ? { ...b, ...patch } : b)))
  const addBottle = () => setBottles(prev => [...prev, { name: '', distillery: '', age: '', region: '', abv: '', bottler: 'OB' }])
  const removeBottle = (i: number) => setBottles(prev => prev.filter((_, ix) => ix !== i))

  const submit = async () => {
    if (!title.trim()) { showToast('제목을 입력해주세요', 'err'); return }
    if (!eventDate) { showToast('날짜를 선택해주세요', 'err'); return }
    const validBottles = bottles
      .map(b => ({ ...b, name: b.name.trim(), distillery: b.distillery?.trim(), age: b.age?.trim(), region: b.region?.trim(), abv: b.abv?.trim(), bottler: b.bottler?.trim() || 'OB' }))
      .filter(b => b.name)
    if (validBottles.length === 0) { showToast('보틀을 1개 이상 추가해주세요', 'err'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), event_date: eventDate, description: description.trim(), featured_bottles: validBottles }),
      })
      const json = await res.json() as { data?: TastingEvent; error?: string }
      if (!res.ok || !json.data) {
        const msg = json.error || `생성 실패 (${res.status})`
        if (msg.toLowerCase().includes('row-level') || msg.includes('로그인')) {
          throw new Error('로그인이 필요합니다. 로그인 후 다시 시도해주세요.')
        }
        throw new Error(msg)
      }
      showToast('시음회 등록됨', 'ok')
      onCreated(json.data.id)
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : '생성 실패', 'err')
    } finally {
      setSaving(false)
    }
  }

  const inp: React.CSSProperties = { width: '100%', padding: '0.55rem 0.7rem', background: 'var(--c3)', border: '1px solid var(--bd2)', color: 'var(--tx)', fontSize: '0.82rem', boxSizing: 'border-box', fontFamily: 'var(--mono)' }
  const label: React.CSSProperties = { fontSize: '0.58rem', color: 'var(--tx3)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.25rem', display: 'block', fontFamily: 'var(--mono)' }

  return (
    <div onClick={() => !saving && onClose()}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.78)', zIndex: 1500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: 'var(--c2)', border: '1px solid var(--gold)', maxWidth: 620, width: '100%', maxHeight: '88vh', overflowY: 'auto' }}>
        {/* 헤더 */}
        <div style={{ padding: '0.85rem 1.1rem', borderBottom: '1px solid var(--bd)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', position: 'sticky', top: 0, background: 'var(--c2)', zIndex: 1 }}>
          <p className="mono" style={{ fontSize: '0.65rem', color: 'var(--gold)', letterSpacing: '0.15em', textTransform: 'uppercase' }}>+ 새 시음회 만들기</p>
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
        <div style={{ padding: '0.85rem 1.1rem', borderTop: '1px solid var(--bd)', display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', flexWrap: 'wrap', position: 'sticky', bottom: 0, background: 'var(--c2)' }} className="m-confirm-actions">
          <button className="btn-ghost" onClick={onClose} disabled={saving} style={{ fontSize: '0.72rem' }}>취소</button>
          <button className="btn-gold" onClick={submit} disabled={saving} style={{ fontSize: '0.72rem' }}>
            {saving ? <span className="spinner" style={{ borderTopColor: '#000' }} /> : null}
            시음회 등록
          </button>
        </div>
      </div>
    </div>
  )
}

export default function EventPage() {
  const { activeEventId, openEvent, setActiveTab, resetCurrentLog, updateCurrentLog, setScanMode } = useStore()
  const { showToast } = useToast()
  const [list, setList] = useState<TastingEvent[]>([])
  const [createOpen, setCreateOpen] = useState(false)
  const [listRefreshNonce, setListRefreshNonce] = useState(0)
  const [detail, setDetail] = useState<EventDetail | null>(null)
  const [loading, setLoading] = useState(true)


  // 리스트
  useEffect(() => {
    if (activeEventId) return
    setLoading(true)
    fetch('/api/events')
      .then(r => r.json())
      .then((j: { data?: TastingEvent[] }) => setList(j.data || []))
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
        <h1 className="display" style={{ fontSize: '1.8rem', color: 'var(--tx)', marginBottom: '0.3rem', lineHeight: 1.25 }}>{ev.title}</h1>
        <p className="mono" style={{ fontSize: '0.7rem', color: 'var(--gold)', marginBottom: '0.5rem' }}>{fmtDate(ev.event_date)}</p>
        {ev.description && <p style={{ fontSize: '0.82rem', color: 'var(--tx2)', lineHeight: 1.7 }}>{ev.description}</p>}
      </div>

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
                  {bottleLogs.map(l => (
                    <div key={l.id} style={{ background: 'var(--c2)', padding: '0.75rem 1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.6rem', marginBottom: '0.3rem' }}>
                        <span className="mono" style={{ fontSize: '0.62rem', color: 'var(--gold)' }}>@{l.author_nickname}</span>
                        <span className="display" style={{ fontSize: '1rem', color: 'var(--gold)' }}>{toHundred(l.score)}<span style={{ fontSize: '0.55rem', color: 'var(--tx3)' }}>/100</span></span>
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
                  ))}
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

    </div>
  )
}
