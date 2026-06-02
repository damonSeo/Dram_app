'use client'
import { useEffect, useState } from 'react'
import { useStore } from '@/lib/store'
import { useToast } from '@/components/Toast'
import { toHundred } from '@/lib/scoreFormat'
import type { TastingEvent, WhiskyLog, EventBottle } from '@/types'
import type { BottleProfile } from '@/app/api/bottle-research/route'

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

  // 오피셜 정보 모달
  const [infoOpen, setInfoOpen] = useState(false)
  const [infoLoading, setInfoLoading] = useState(false)
  const [infoBottle, setInfoBottle] = useState<EventBottle | null>(null)
  const [infoProfile, setInfoProfile] = useState<BottleProfile | null>(null)
  const [infoStatus, setInfoStatus] = useState('')

  const openOfficialInfo = async (b: EventBottle) => {
    setInfoOpen(true)
    setInfoLoading(true)
    setInfoBottle(b)
    setInfoProfile(null)
    setInfoStatus('보틀 정보 조회 중...')
    try {
      const t1 = setTimeout(() => setInfoStatus('Whiskybase·전문 리뷰 사이트 검색...'), 2500)
      const t2 = setTimeout(() => setInfoStatus('AI가 종합 정리하는 중...'), 6000)
      const form = new FormData()
      form.append('ocr', JSON.stringify({
        brand: b.distillery || b.name,
        region: b.region || '',
        age: b.age || '',
        abv: b.abv || '',
        bottler: b.bottler || '',
        cask: '',
      }))
      form.append('lang', 'ko')
      const res = await fetch('/api/bottle-research', { method: 'POST', body: form })
      clearTimeout(t1); clearTimeout(t2)
      let json: { data?: BottleProfile; error?: string }
      try { json = await res.json() as { data?: BottleProfile; error?: string } }
      catch { throw new Error(res.status === 504 ? '조회 시간 초과 — 다시 시도해주세요' : `조회 실패 (${res.status})`) }
      if (!res.ok || !json.data) throw new Error(json.error || '오피셜 정보 조회 실패')
      setInfoProfile(json.data)
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : '조회 실패', 'err')
      setInfoOpen(false)
    } finally {
      setInfoLoading(false)
      setInfoStatus('')
    }
  }

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
        const expected = [b.distillery || b.name, b.age].filter(Boolean).join(' ')
        const q = encodeURIComponent([b.distillery || b.name, b.age, b.region].filter(Boolean).join(' '))
        const nm = encodeURIComponent(expected)
        try {
          const r = await fetch(`/api/bottle-image?q=${q}&name=${nm}`)
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
              <button onClick={() => openOfficialInfo(b)}
                style={{ width: '100%', padding: '0.85rem 1rem', borderBottom: '1px solid var(--bd)', background: 'var(--c3)', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.85rem', flexWrap: 'wrap', textAlign: 'left' }}
                title="오피셜 정보 보기">
                {/* 보틀 썸네일 + 검증 배지 */}
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  {b.image_url ? (
                    <img src={b.image_url} alt={b.name}
                      style={{ width: 56, height: 72, objectFit: 'contain', objectPosition: 'center', background: '#0e0c0b', border: `1px solid ${b.image_verified ? 'var(--gold)' : 'var(--bd)'}`, display: 'block' }}
                      onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
                  ) : (
                    <div style={{ width: 56, height: 72, background: 'var(--c2)', border: '1px solid var(--bd)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem' }}>🥃</div>
                  )}
                  {b.image_url && b.image_verified && (
                    <span title={`Gemini가 라벨에서 읽음: ${b.image_found_text || ''}`}
                      style={{ position: 'absolute', bottom: -4, right: -4, background: 'var(--gold)', color: '#000', fontSize: '0.6rem', fontWeight: 700, width: 16, height: 16, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>
                      ✓
                    </span>
                  )}
                  {b.image_url && b.image_confidence === 'low' && !b.image_verified && (
                    <span title="라벨 검증이 확실치 않습니다"
                      style={{ position: 'absolute', bottom: -4, right: -4, background: 'rgba(255,255,255,0.08)', color: 'var(--tx3)', fontSize: '0.55rem', padding: '0.05rem 0.3rem', border: '1px solid var(--bd)' }}>
                      ?
                    </span>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p className="mono" style={{ fontSize: '0.55rem', color: 'var(--gold)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.15rem' }}>
                    Bottle {i + 1} · 🔍 클릭하여 오피셜 정보
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
              </button>

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

      {/* ── 오피셜 정보 모달 ── */}
      {infoOpen && (
        <div onClick={() => !infoLoading && setInfoOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.78)', zIndex: 1500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: 'var(--c2)', border: '1px solid var(--gold)', maxWidth: 680, width: '100%', maxHeight: '88vh', overflowY: 'auto' }}>
            <div style={{ padding: '0.85rem 1.1rem', borderBottom: '1px solid var(--bd)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', position: 'sticky', top: 0, background: 'var(--c2)' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p className="mono" style={{ fontSize: '0.55rem', color: 'var(--gold)', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: '0.2rem' }}>🔍 오피셜 정보</p>
                <p className="mono" style={{ fontSize: '0.62rem', color: 'var(--tx3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{infoBottle?.name}</p>
              </div>
              <button onClick={() => !infoLoading && setInfoOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--tx3)', cursor: 'pointer', fontSize: '1.1rem', flexShrink: 0 }}>✕</button>
            </div>

            {infoLoading && (
              <div style={{ padding: '2.5rem 1.5rem', textAlign: 'center' }}>
                <span className="spinner" style={{ width: 22, height: 22, borderWidth: 3 }} />
                <p className="mono" style={{ fontSize: '0.65rem', color: 'var(--tx2)', marginTop: '0.85rem' }}>{infoStatus}</p>
              </div>
            )}

            {!infoLoading && infoProfile && (
              <div style={{ padding: '1rem 1.1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {/* 정식 이름 + 신뢰도 */}
                <div>
                  <div style={{ display: 'flex', gap: '0.35rem', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
                    <span className="mono" style={{ fontSize: '0.55rem', padding: '0.18rem 0.5rem', background: infoProfile.confidence === 'high' ? 'var(--gp)' : 'rgba(255,255,255,0.06)', color: infoProfile.confidence === 'high' ? 'var(--gold)' : 'var(--tx2)', border: `1px solid ${infoProfile.confidence === 'high' ? 'var(--gold)' : 'var(--bd2)'}`, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                      신뢰도 {infoProfile.confidence}
                    </span>
                    {infoProfile.rarity && (
                      <span className="mono" style={{ fontSize: '0.55rem', padding: '0.18rem 0.5rem', border: '1px solid var(--bd)', color: 'var(--tx3)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                        {infoProfile.rarity}
                      </span>
                    )}
                  </div>
                  <h2 className="display" style={{ fontSize: '1.35rem', color: 'var(--tx)', lineHeight: 1.25 }}>{infoProfile.identified_name}</h2>
                  {infoProfile.release_info && (
                    <p className="mono" style={{ fontSize: '0.6rem', color: 'var(--gold)', marginTop: '0.3rem' }}>{infoProfile.release_info}</p>
                  )}
                </div>

                {/* 스펙 */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '1px', background: 'var(--bd)' }}>
                  {([
                    ['Distillery', infoProfile.distillery],
                    ['Bottler', infoProfile.bottler],
                    ['Region', infoProfile.region],
                    ['Age', infoProfile.age],
                    ['Vintage', infoProfile.vintage],
                    ['ABV', infoProfile.abv],
                    ['Cask', infoProfile.cask],
                  ] as [string, string | null][]).filter(([, v]) => v).map(([k, v]) => (
                    <div key={k} style={{ background: 'var(--c2)', padding: '0.5rem 0.65rem' }}>
                      <p className="mono" style={{ fontSize: '0.5rem', color: 'var(--tx3)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.15rem' }}>{k}</p>
                      <p style={{ fontSize: '0.76rem', color: 'var(--tx)' }}>{v}</p>
                    </div>
                  ))}
                </div>

                {/* 가격 추정 */}
                {infoProfile.price_estimate && (
                  <div style={{ padding: '0.65rem 0.85rem', background: 'var(--c3)', border: '1px solid var(--bd)' }}>
                    <p className="mono" style={{ fontSize: '0.5rem', color: 'var(--gold)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.2rem' }}>💰 가격 추정</p>
                    <p style={{ fontSize: '0.78rem', color: 'var(--tx)' }}>{infoProfile.price_estimate}</p>
                  </div>
                )}

                {/* 개요 */}
                {infoProfile.description && (
                  <div>
                    <p className="mono" style={{ fontSize: '0.52rem', color: 'var(--tx3)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.4rem' }}>Overview</p>
                    <p style={{ fontSize: '0.78rem', color: 'var(--tx)', lineHeight: 1.7 }}>{infoProfile.description}</p>
                  </div>
                )}

                {/* 향·맛·여운 (참고) */}
                {infoProfile.flavor_profile && (
                  <div>
                    <p className="mono" style={{ fontSize: '0.52rem', color: 'var(--tx3)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.4rem' }}>Flavor Profile (참고)</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      {([['🌸 향', infoProfile.flavor_profile.nose], ['🥃 맛', infoProfile.flavor_profile.palate], ['✨ 여운', infoProfile.flavor_profile.finish]] as [string, string][])
                        .filter(([, v]) => v && v.trim()).map(([lbl, v]) => (
                          <div key={lbl} style={{ padding: '0.5rem 0.7rem', background: 'var(--c3)', borderLeft: '2px solid var(--gold)' }}>
                            <p className="mono" style={{ fontSize: '0.5rem', color: 'var(--gold)', marginBottom: '0.15rem' }}>{lbl}</p>
                            <p style={{ fontSize: '0.72rem', color: 'var(--tx2)', lineHeight: 1.6 }}>{v}</p>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Whiskybase 매칭 */}
                {infoProfile.whiskybase && infoProfile.whiskybase.status !== 'none' && (
                  <div style={{ padding: '0.55rem 0.75rem', background: infoProfile.whiskybase.status === 'exact' ? 'var(--gp)' : 'var(--c3)', border: `1px solid ${infoProfile.whiskybase.status === 'exact' ? 'var(--gold)' : 'var(--bd2)'}` }}>
                    <p className="mono" style={{ fontSize: '0.5rem', color: 'var(--gold)', marginBottom: '0.2rem' }}>
                      🗄 Whiskybase · {infoProfile.whiskybase.status === 'exact' ? '정확히 일치' : '유사 항목'}
                    </p>
                    {infoProfile.whiskybase.note && <p style={{ fontSize: '0.68rem', color: 'var(--tx2)', lineHeight: 1.55 }}>{infoProfile.whiskybase.note}</p>}
                    {infoProfile.whiskybase.link && (
                      <a href={infoProfile.whiskybase.link} target="_blank" rel="noopener noreferrer" className="mono"
                        style={{ fontSize: '0.6rem', color: 'var(--gold)', textDecoration: 'none', wordBreak: 'break-all', display: 'inline-block', marginTop: '0.25rem' }}>
                        {infoProfile.whiskybase.matched_name || 'Whiskybase에서 보기'} ↗
                      </a>
                    )}
                  </div>
                )}

                {/* 출처별 전문가 노트 */}
                {infoProfile.tasting_notes_found && infoProfile.tasting_notes_found.length > 0 && (
                  <div>
                    <p className="mono" style={{ fontSize: '0.52rem', color: 'var(--tx3)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.4rem' }}>📝 출처별 전문가 노트 ({infoProfile.tasting_notes_found.length})</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {infoProfile.tasting_notes_found.map((n, ni) => (
                        <div key={ni} style={{ padding: '0.55rem 0.7rem', background: 'var(--c3)', border: '1px solid var(--bd)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.4rem', marginBottom: '0.25rem', flexWrap: 'wrap' }}>
                            <span className="mono" style={{ fontSize: '0.52rem', color: 'var(--gold)' }}>
                              {n.link ? <a href={n.link} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--gold)', textDecoration: 'none' }}>{n.source} ↗</a> : n.source}
                            </span>
                            {n.rating && <span className="mono" style={{ fontSize: '0.52rem', color: 'var(--gold)', border: '1px solid var(--gold)', padding: '0.05rem 0.35rem' }}>★ {n.rating}</span>}
                          </div>
                          {n.nose && <p style={{ fontSize: '0.68rem', color: 'var(--tx2)', lineHeight: 1.55 }}><span style={{ color: 'var(--gold)' }}>향</span> {n.nose}</p>}
                          {n.palate && <p style={{ fontSize: '0.68rem', color: 'var(--tx2)', lineHeight: 1.55 }}><span style={{ color: 'var(--gold)' }}>맛</span> {n.palate}</p>}
                          {n.finish && <p style={{ fontSize: '0.68rem', color: 'var(--tx2)', lineHeight: 1.55 }}><span style={{ color: 'var(--gold)' }}>여운</span> {n.finish}</p>}
                          {n.overall && <p style={{ fontSize: '0.66rem', color: 'var(--tx3)', marginTop: '0.2rem', fontStyle: 'italic' }}>"{n.overall}"</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <p className="mono" style={{ fontSize: '0.55rem', color: 'var(--tx3)', lineHeight: 1.7, textAlign: 'center' }}>
                  ※ 자동 수집된 참고용 정보입니다. 라벨·공식 자료와 다를 수 있어요.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
