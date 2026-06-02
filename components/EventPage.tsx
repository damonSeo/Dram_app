'use client'
import { useEffect, useState } from 'react'
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

export default function EventPage() {
  const { activeEventId, openEvent, setActiveTab, resetCurrentLog, updateCurrentLog, setScanMode } = useStore()
  const { showToast } = useToast()
  const [list, setList] = useState<TastingEvent[]>([])
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
  }, [activeEventId])

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

  // 보틀 이미지 자동 검색 — 빠진 것만 한 번씩 가져와 PATCH로 캐싱
  useEffect(() => {
    if (!detail) return
    const ev = detail.event
    const missing = ev.featured_bottles
      .map((b, i) => ({ b, i }))
      .filter(x => !x.b.image_url)
    if (missing.length === 0) return
    let cancelled = false
    ;(async () => {
      const updated = [...ev.featured_bottles]
      let changed = false
      for (const { b, i } of missing) {
        const q = encodeURIComponent([b.distillery || b.name, b.age, b.region].filter(Boolean).join(' '))
        const params = new URLSearchParams()
        params.set('q', [b.distillery || b.name, b.age, b.region].filter(Boolean).join(' '))
        params.set('name', b.name || '')
        if (b.distillery) params.set('distillery', b.distillery)
        if (b.age) params.set('age', b.age)
        if (b.abv) params.set('abv', b.abv)
        try {
          const r = await fetch(`/api/bottle-image?${params.toString()}`)
          void q
          const j = await r.json() as { data?: {
            image_url: string; source: string; verified?: boolean
            confidence?: 'high'|'medium'|'low'; found_text?: string
          } | null }
          if (cancelled) return
          if (j.data?.image_url) {
            updated[i] = {
              ...updated[i],
              image_url: j.data.image_url,
              image_source: j.data.source,
              image_verified: !!j.data.verified,
              image_confidence: j.data.confidence,
              image_found_text: j.data.found_text,
            }
            changed = true
          }
        } catch { /* skip */ }
      }
      if (cancelled || !changed) return
      // 화면 즉시 반영
      setDetail(d => d ? { ...d, event: { ...d.event, featured_bottles: updated } } : d)
      // DB에 저장 (호스트 권한 있으면 통과, 없으면 조용히 실패)
      fetch(`/api/events/${ev.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ featured_bottles: updated }),
      }).catch(() => {})
    })()
    return () => { cancelled = true }
  }, [detail])

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
        <h1 className="display" style={{ fontSize: '2rem', color: 'var(--tx)', marginBottom: '0.5rem' }}>
          🍶 시음회
        </h1>
        <p className="mono" style={{ fontSize: '0.7rem', color: 'var(--tx3)', letterSpacing: '0.08em', marginBottom: '1.5rem' }}>
          다가올 시음회 · 참여자 노트를 한 곳에 모으는 이벤트 공간
        </p>

        {loading && <p className="mono" style={{ fontSize: '0.7rem', color: 'var(--tx3)' }}>불러오는 중...</p>}
        {!loading && list.length === 0 && (
          <p className="mono" style={{ fontSize: '0.75rem', color: 'var(--tx3)' }}>등록된 시음회가 없어요.</p>
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
                {/* 보틀 썸네일 — 라벨 검증 통과한 경우에만 표시 */}
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  {b.image_url && b.image_verified ? (
                    <>
                      <img src={b.image_url} alt={b.name}
                        style={{ width: 56, height: 72, objectFit: 'contain', objectPosition: 'center', background: '#0e0c0b', border: '1px solid var(--gold)', display: 'block' }}
                        onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
                      <span title={`라벨 검증 완료${b.image_found_text ? ' — ' + b.image_found_text : ''}`}
                        style={{ position: 'absolute', bottom: -4, right: -4, background: 'var(--gold)', color: '#000', fontSize: '0.6rem', fontWeight: 700, width: 16, height: 16, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>
                        ✓
                      </span>
                    </>
                  ) : (
                    <div title={b.image_url ? '검증되지 않은 후보는 표시하지 않아요' : '이미지를 찾는 중'}
                      style={{ width: 56, height: 72, background: 'var(--c2)', border: '1px solid var(--bd)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem' }}>🥃</div>
                  )}
                </div>
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
