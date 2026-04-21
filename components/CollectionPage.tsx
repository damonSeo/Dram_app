'use client'
import { useState } from 'react'
import { useStore } from '@/lib/store'
import { useToast } from '@/components/Toast'
import type { WhiskyLog } from '@/types'

const COLOR_HEX: Record<string, string> = {
  'Pale Straw': '#F5E6A3',
  'Light Gold': '#E8C84A',
  'Deep Gold': '#C9A84C',
  'Amber': '#A0622A',
  'Deep Amber': '#7A3E18',
  'Mahogany': '#4A1E0A',
}

const COLORS = [
  { name: 'Pale Straw', hex: '#F5F0DC' },
  { name: 'Light Gold', hex: '#E8CC7A' },
  { name: 'Deep Gold', hex: '#C9A84C' },
  { name: 'Amber', hex: '#A0693A' },
  { name: 'Deep Amber', hex: '#7A4820' },
  { name: 'Mahogany', hex: '#4A1E0A' },
]

const CASK_OPTIONS = [
  'Ex-Bourbon', 'Ex-Sherry', 'First Fill Bourbon', 'First Fill Sherry',
  'Refill Bourbon', 'Refill Sherry', 'Virgin Oak', 'Port', 'Madeira',
  'Rum', 'Wine', 'Hogshead', 'Butt', 'Quarter Cask', 'STR',
]

// ── Edit Modal ──────────────────────────────────────────────────────────────

interface EditModalProps {
  log: WhiskyLog
  onClose: () => void
}

function EditModal({ log, onClose }: EditModalProps) {
  const { upsertToCollection, removeFromCollection, setActiveTab, updateCurrentLog } = useStore()
  const { showToast } = useToast()
  const [form, setForm] = useState<WhiskyLog>({ ...log })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const upd = (fields: Partial<WhiskyLog>) => setForm((f) => ({ ...f, ...fields }))

  const toggleCask = (c: string) => {
    const next = form.casks.includes(c)
      ? form.casks.filter((x) => x !== c)
      : [...form.casks, c]
    upd({ casks: next })
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/whisky-logs', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const json = await res.json() as { data?: WhiskyLog; error?: string }
      if (!res.ok) throw new Error(json.error || '저장 실패')
      if (json.data) upsertToCollection(json.data)
      showToast('수정됨', 'ok')
      onClose()
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : '저장 실패', 'err')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirmDelete) { setConfirmDelete(true); return }
    setDeleting(true)
    try {
      const res = await fetch('/api/whisky-logs', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: form.id }),
      })
      if (!res.ok) throw new Error('삭제 실패')
      removeFromCollection(form.id)
      showToast('삭제됨', 'ok')
      onClose()
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : '삭제 실패', 'err')
    } finally {
      setDeleting(false)
    }
  }

  const goShare = () => {
    updateCurrentLog({ ...form })
    setActiveTab('share')
    onClose()
  }

  const inp: React.CSSProperties = {
    border: '1px solid var(--bd)',
    background: 'var(--c3)',
    color: 'var(--tx)',
    padding: '0.45rem 0.65rem',
    fontSize: '0.82rem',
    width: '100%',
    fontFamily: 'inherit',
  }

  const label: React.CSSProperties = {
    fontSize: '0.58rem',
    color: 'var(--tx3)',
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
    marginBottom: '0.3rem',
    display: 'block',
    fontFamily: 'var(--mono)',
  }

  const section = (title: string) => (
    <p className="mono" style={{ fontSize: '0.6rem', color: 'var(--gold)', letterSpacing: '0.12em', textTransform: 'uppercase', margin: '1.25rem 0 0.6rem' }}>
      ── {title}
    </p>
  )

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'auto', padding: '2rem 1rem' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background: 'var(--c2)', border: '1px solid var(--bd)', width: '100%', maxWidth: 680, position: 'relative' }}>

        {/* Header */}
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--bd)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: 'var(--c2)', zIndex: 1 }}>
          <div>
            <p className="display" style={{ fontSize: '1.3rem', color: 'var(--tx)' }}>{form.brand || '—'}</p>
            <p className="mono" style={{ fontSize: '0.62rem', color: 'var(--tx2)', marginTop: '0.2rem' }}>{form.region} {form.age}</p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button className="btn-ghost" style={{ fontSize: '0.7rem' }} onClick={goShare}>공유 카드 →</button>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--tx2)', fontSize: '1.2rem', cursor: 'pointer', lineHeight: 1 }}>✕</button>
          </div>
        </div>

        <div style={{ padding: '0 1.25rem 1.5rem' }}>

          {/* 기본 정보 */}
          {section('기본 정보')}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <span style={label}>증류소 (Brand)</span>
              <input style={inp} value={form.brand} onChange={(e) => upd({ brand: e.target.value })} />
            </div>
            <div>
              <span style={label}>지역 (Region)</span>
              <input style={inp} value={form.region || ''} onChange={(e) => upd({ region: e.target.value })} />
            </div>
            <div>
              <span style={label}>숙성 (Age)</span>
              <input style={inp} placeholder="e.g. 12yr" value={form.age || ''} onChange={(e) => upd({ age: e.target.value })} />
            </div>
            <div>
              <span style={label}>도수 (ABV)</span>
              <input style={inp} placeholder="e.g. 46%" value={form.abv || ''} onChange={(e) => upd({ abv: e.target.value })} />
            </div>
            <div>
              <span style={label}>빈티지 (Vintage)</span>
              <input style={inp} placeholder="e.g. 2008" value={form.vintage || ''} onChange={(e) => upd({ vintage: e.target.value })} />
            </div>
            <div>
              <span style={label}>병입연도 (Bottled)</span>
              <input style={inp} placeholder="e.g. 2023" value={form.bottled_date || ''} onChange={(e) => upd({ bottled_date: e.target.value })} />
            </div>
            <div>
              <span style={label}>캐스크 번호</span>
              <input style={inp} placeholder="e.g. 1234" value={form.cask_no || ''} onChange={(e) => upd({ cask_no: e.target.value })} />
            </div>
            <div>
              <span style={label}>시음 날짜</span>
              <input style={inp} type="date" value={form.date || ''} onChange={(e) => upd({ date: e.target.value })} />
            </div>
          </div>

          <div style={{ marginTop: '0.75rem' }}>
            <span style={label}>보틀러 (Bottler)</span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {(['OB', 'IB'] as const).map((b) => (
                <button key={b} onClick={() => upd({ bottler: b })}
                  className={form.bottler === b ? 'btn-gold' : 'btn-ghost'}
                  style={{ fontSize: '0.72rem', padding: '0.3rem 0.8rem' }}>
                  {b}
                </button>
              ))}
              {form.bottler === 'IB' && (
                <input style={{ ...inp, flex: 1 }} placeholder="IB 이름" value={form.ib_name || ''} onChange={(e) => upd({ ib_name: e.target.value })} />
              )}
            </div>
          </div>

          {/* 캐스크 */}
          {section('캐스크 타입')}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
            {CASK_OPTIONS.map((c) => (
              <button key={c} onClick={() => toggleCask(c)}
                style={{
                  fontSize: '0.68rem', padding: '0.25rem 0.65rem',
                  border: '1px solid var(--bd)', cursor: 'pointer',
                  background: form.casks.includes(c) ? 'var(--gold)' : 'transparent',
                  color: form.casks.includes(c) ? '#000' : 'var(--tx2)',
                  fontFamily: 'var(--mono)',
                }}>
                {c}
              </button>
            ))}
          </div>

          {/* 색상 & 점수 */}
          {section('색상 & 점수')}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <span style={label}>색상</span>
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                {COLORS.map((c) => (
                  <div key={c.name} onClick={() => upd({ color: c.name })} title={c.name}
                    style={{
                      width: 30, height: 30, background: c.hex, cursor: 'pointer',
                      border: form.color === c.name ? '2px solid var(--gold)' : '2px solid transparent',
                    }} />
                ))}
              </div>
              <p className="mono" style={{ fontSize: '0.62rem', color: 'var(--gold)', marginTop: '0.35rem' }}>{form.color}</p>
            </div>
            <div>
              <span style={label}>점수 (Score)</span>
              <p className="display" style={{ fontSize: '2rem', color: 'var(--gold)', lineHeight: 1, margin: '0.3rem 0' }}>
                ★ {(form.score ?? 4.0).toFixed(1)}
              </p>
              <input type="range" min={0} max={5} step={0.1}
                value={form.score ?? 4.0}
                onChange={(e) => upd({ score: parseFloat(e.target.value) })}
                style={{ width: '100%', accentColor: 'var(--gold)' }} />
            </div>
          </div>

          {/* 테이스팅 노트 */}
          {section('테이스팅 노트')}
          {(['nose', 'palate', 'finish'] as const).map((field) => (
            <div key={field} style={{ marginBottom: '0.75rem' }}>
              <span style={label}>{field === 'nose' ? '향 (Nose)' : field === 'palate' ? '맛 (Palate)' : '여운 (Finish)'}</span>
              <textarea rows={3} style={{ ...inp, lineHeight: 1.6, resize: 'vertical' }}
                value={form[field] || ''}
                onChange={(e) => upd({ [field]: e.target.value })} />
            </div>
          ))}
          <div>
            <span style={label}>총평 (Comment)</span>
            <textarea rows={3} style={{ ...inp, lineHeight: 1.6, resize: 'vertical' }}
              value={form.comment || ''}
              onChange={(e) => upd({ comment: e.target.value })} />
          </div>

          {/* Actions */}
          <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--bd)', paddingTop: '1.25rem', display: 'flex', gap: '0.75rem', justifyContent: 'space-between', alignItems: 'center' }}>
            <button
              onClick={handleDelete}
              disabled={deleting}
              style={{
                background: confirmDelete ? 'rgba(180,60,60,0.15)' : 'transparent',
                border: `1px solid ${confirmDelete ? '#cf7e7e' : 'var(--bd)'}`,
                color: confirmDelete ? '#cf7e7e' : 'var(--tx3)',
                padding: '0.5rem 1rem', cursor: 'pointer', fontSize: '0.72rem', fontFamily: 'var(--mono)',
              }}>
              {deleting ? '삭제 중...' : confirmDelete ? '정말 삭제하시겠어요?' : '🗑 삭제'}
            </button>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn-ghost" style={{ fontSize: '0.75rem' }} onClick={onClose}>취소</button>
              <button className="btn-gold" style={{ fontSize: '0.75rem' }} onClick={handleSave} disabled={saving}>
                {saving ? <span className="spinner" style={{ borderTopColor: '#000' }} /> : null}
                저장
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Collection Page ─────────────────────────────────────────────────────────

export default function CollectionPage() {
  const { collection } = useStore()
  const [editLog, setEditLog] = useState<WhiskyLog | null>(null)

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '2rem 1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--bd)', paddingBottom: '1rem' }}>
        <h1 className="display" style={{ fontSize: '2rem', color: 'var(--tx)' }}>Collection</h1>
        <span className="mono" style={{ fontSize: '0.72rem', color: 'var(--gold)' }}>{collection.length} Drams</span>
      </div>

      {collection.length === 0 ? (
        <p style={{ color: 'var(--tx2)', fontStyle: 'italic', textAlign: 'center', padding: '4rem 0' }}>
          컬렉션이 비어 있습니다. 라벨을 스캔해서 첫 번째 위스키를 추가해보세요.
        </p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: '1px', background: 'var(--bd)' }}>
          {collection.map((log) => (
            <div
              key={log.id}
              onClick={() => setEditLog(log)}
              style={{ background: 'var(--c2)', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', paddingBottom: '0.75rem' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'var(--c3)' }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'var(--c2)' }}
            >
              {/* 색상 바 */}
              <div style={{ height: 3, background: COLOR_HEX[log.color] || 'var(--gold)' }} />

              <div style={{ padding: '0.75rem 0.9rem' }}>
                <p className="mono" style={{ fontSize: '0.6rem', color: 'var(--gold)', letterSpacing: '0.08em', marginBottom: '0.3rem' }}>
                  {log.region?.toLowerCase()}
                </p>
                <p className="display" style={{ fontSize: '1.2rem', lineHeight: 1.2, marginBottom: '0.25rem', color: 'var(--tx)' }}>
                  {log.brand || '—'}
                </p>
                <p className="mono" style={{ fontSize: '0.65rem', color: 'var(--tx2)', marginBottom: '0.5rem' }}>
                  {[log.age, log.bottler === 'IB' ? (log.ib_name || 'IB') : 'OB'].filter(Boolean).join(' · ')}
                </p>
                {log.nose && (
                  <p style={{
                    fontSize: '0.75rem', color: 'var(--tx2)', lineHeight: 1.5,
                    overflow: 'hidden', display: '-webkit-box',
                    WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', marginBottom: '0.75rem',
                  }}>
                    {log.nose}
                  </p>
                )}
              </div>

              <div style={{ padding: '0 0.9rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="display" style={{ fontSize: '1.1rem', color: 'var(--gold)' }}>★ {log.score?.toFixed(1)}</span>
                <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  {(log.casks || []).slice(0, 2).map((c) => (
                    <span key={c} className="mono" style={{ fontSize: '0.55rem', color: 'var(--tx3)', border: '1px solid var(--bd)', padding: '0.1rem 0.35rem' }}>
                      {c}
                    </span>
                  ))}
                </div>
              </div>

              {/* 편집 힌트 */}
              <span style={{ position: 'absolute', top: '0.75rem', right: '0.75rem', color: 'var(--tx3)', fontSize: '0.75rem' }}>✎</span>
            </div>
          ))}
        </div>
      )}

      {editLog && <EditModal log={editLog} onClose={() => setEditLog(null)} />}
    </div>
  )
}
