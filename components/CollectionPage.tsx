'use client'
import { useEffect, useRef, useState } from 'react'
import { useStore } from '@/lib/store'
import { useToast } from '@/components/Toast'
import { compressImageToDataUrl } from '@/lib/imageUtils'
import type { WhiskyLog, Profile } from '@/types'
import PersonalNotePanel from '@/components/PersonalNotePanel'
import { toHundred } from '@/lib/scoreFormat'

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

const REGIONS = ['Speyside','Islay','Highland','Lowland','Campbeltown','Island','Irish','Japanese','American','Taiwanese','Indian','Other']
const CASK_OPTIONS = [
  'Ex-Bourbon', 'Hogshead', 'Oloroso Sherry', 'Pedro Ximénez', 'Port', 'Rum',
  'Madeira', 'Sauternes', 'Virgin Oak', 'American Oak', 'European Oak', 'STR',
  'Wine', 'Mizunara', 'First Fill Bourbon', 'Refill Bourbon',
]

// ── Edit Modal (Manual + Notes 통합) ────────────────────────────────────────

interface EditModalProps {
  log: WhiskyLog
  onClose: () => void
}

function EditModal({ log, onClose }: EditModalProps) {
  const { upsertToCollection, removeFromCollection, setActiveTab, loadLog } = useStore()
  const { showToast } = useToast()
  const [form, setForm] = useState<WhiskyLog>({ ...log })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const photoRef = useRef<HTMLInputElement>(null)

  const upd = (fields: Partial<WhiskyLog>) => setForm((f) => ({ ...f, ...fields }))

  const toggleCask = (c: string) => {
    const next = form.casks.includes(c)
      ? form.casks.filter((x) => x !== c)
      : [...form.casks, c]
    upd({ casks: next })
  }

  const handlePhotoChange = async (f: File) => {
    try {
      const data = await compressImageToDataUrl(f, 800, 0.75)
      upd({ image_url: data })
    } catch {
      showToast('이미지 처리 실패', 'err')
    }
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
    loadLog({ ...form })
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
    <p className="mono" style={{ fontSize: '0.62rem', color: 'var(--gold)', letterSpacing: '0.12em', textTransform: 'uppercase', margin: '1.5rem 0 0.6rem', borderTop: '1px solid var(--bd)', paddingTop: '1rem' }}>
      ── {title}
    </p>
  )

  return (
    <div
      className="m-modal-overlay"
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'auto', padding: '2rem 1rem' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="m-modal-panel" style={{ background: 'var(--c2)', border: '1px solid var(--bd)', width: '100%', maxWidth: 720, position: 'relative' }}>

        {/* Header */}
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--bd)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: 'var(--c2)', zIndex: 1 }}>
          <div>
            <p className="display" style={{ fontSize: '1.3rem', color: 'var(--tx)' }}>{form.brand || '—'}</p>
            <p className="mono" style={{ fontSize: '0.62rem', color: 'var(--tx2)', marginTop: '0.2rem' }}>수정 모드 · Manual + Notes</p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button className="btn-ghost" style={{ fontSize: '0.7rem' }} onClick={goShare}>공유 카드 →</button>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--tx2)', fontSize: '1.2rem', cursor: 'pointer', lineHeight: 1 }}>✕</button>
          </div>
        </div>

        <div className="m-modal-body" style={{ padding: '0 1.25rem 1.5rem' }}>

          {/* 사진 */}
          {section('라벨 사진')}
          <input ref={photoRef} type="file" accept="image/*" style={{ display: 'none' }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePhotoChange(f) }} />
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
            {form.image_url ? (
              <img src={form.image_url} alt="label" style={{ width: 140, height: 140, objectFit: 'cover', border: '1px solid var(--bd)' }} />
            ) : (
              <div style={{ width: 140, height: 140, background: 'var(--c3)', border: '1px dashed var(--bd)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--tx3)', fontSize: '2rem' }}>📷</div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <button className="btn-outline-gold" style={{ fontSize: '0.7rem' }} onClick={() => photoRef.current?.click()}>
                {form.image_url ? '사진 변경' : '사진 추가'}
              </button>
              {form.image_url && (
                <button className="btn-ghost" style={{ fontSize: '0.7rem', color: '#cf7e7e' }} onClick={() => upd({ image_url: '' })}>제거</button>
              )}
            </div>
          </div>

          {/* 증류소 & 기본 정보 */}
          {section('증류소 & 기본 정보')}
          <div className="m-grid-collapse" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <span style={label}>증류소 (Brand)</span>
              <input style={inp} value={form.brand} onChange={(e) => upd({ brand: e.target.value })} />
            </div>
            <div>
              <span style={label}>지역 (Region)</span>
              <select style={inp} value={form.region || ''} onChange={(e) => upd({ region: e.target.value })}>
                <option value="">선택</option>
                {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <span style={label}>보틀러 (Bottler)</span>
              <select style={inp} value={form.bottler || 'OB'} onChange={(e) => upd({ bottler: e.target.value })}>
                <option value="OB">OB (Official)</option>
                <option value="IB">IB (Independent)</option>
              </select>
            </div>
            <div>
              <span style={label}>IB Name</span>
              <input style={inp} placeholder={form.bottler === 'IB' ? 'e.g. Gordon & MacPhail' : '(OB 선택 시 비활성)'}
                value={form.ib_name || ''} disabled={form.bottler !== 'IB'}
                onChange={(e) => upd({ ib_name: e.target.value })} />
            </div>
          </div>

          {/* 숙성 & 빈티지 */}
          {section('숙성 & 빈티지 & 도수')}
          <div className="m-grid-collapse" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
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
              <span style={label}>증류일 (Distilled)</span>
              <input style={inp} placeholder="e.g. Nov 1995" value={form.distilled_date || ''} onChange={(e) => upd({ distilled_date: e.target.value })} />
            </div>
            <div>
              <span style={label}>캐스크 번호</span>
              <input style={inp} placeholder="e.g. #1234" value={form.cask_no || ''} onChange={(e) => upd({ cask_no: e.target.value })} />
            </div>
            <div>
              <span style={label}>병 수 (Bottles)</span>
              <input style={inp} placeholder="e.g. 285" value={form.bottles || ''} onChange={(e) => upd({ bottles: e.target.value })} />
            </div>
            <div>
              <span style={label}>시음 날짜</span>
              <input style={inp} type="date" value={form.date || ''} onChange={(e) => upd({ date: e.target.value })} />
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
          <div className="m-grid-collapse" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
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
              <span style={label}>점수 (/ 100)</span>
              <p className="display" style={{ fontSize: '2rem', color: 'var(--gold)', lineHeight: 1, margin: '0.3rem 0' }}>
                {toHundred(form.score ?? 70)}
                <span style={{ fontSize: '0.8rem', color: 'var(--tx3)' }}> / 100</span>
              </p>
              <div style={{ display: 'flex', justifyContent: 'flex-start', gap: '0.3rem', marginBottom: '0.5rem' }}>
                {[1,2,3,4,5].map((s) => (
                  <button key={s} onClick={() => upd({ score: s * 20 })}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem',
                      color: toHundred(form.score ?? 70) >= s * 20 ? 'var(--gold)' : 'var(--tx3)' }}>★</button>
                ))}
              </div>
              <input type="range" min={0} max={100} step={1}
                value={toHundred(form.score ?? 70)}
                onChange={(e) => upd({ score: parseInt(e.target.value) })}
                style={{ width: '100%', accentColor: 'var(--gold)', marginBottom: '0.4rem' }} />
              <input type="number" min={0} max={100} step={1}
                value={toHundred(form.score ?? 70)}
                onChange={(e) => {
                  const v = parseInt(e.target.value)
                  if (!isNaN(v)) upd({ score: Math.max(0, Math.min(100, v)) })
                }}
                className="mono"
                style={{ ...inp, width: '5rem', textAlign: 'center' }} />
            </div>
          </div>

          {/* 테이스팅 노트 */}
          {section('테이스팅 노트')}
          {(['nose', 'palate', 'finish'] as const).map((field) => (
            <div key={field} style={{ marginBottom: '0.75rem' }}>
              <span style={label}>{field === 'nose' ? '향 (Nose)' : field === 'palate' ? '맛 (Palate)' : '여운 (Finish)'}</span>
              <textarea rows={3} style={{ ...inp, lineHeight: 1.6, resize: 'vertical' }}
                value={form[field] || ''}
                onChange={(e) => upd({ [field]: e.target.value } as Partial<WhiskyLog>)} />
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
              onClick={handleDelete} disabled={deleting}
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
  const { collection, loadLog, setActiveTab, removeFromCollection, archiveSubTab, setArchiveSubTab,
          archiveView, setArchiveView, currentUserId, currentProfile } = useStore()
  const { showToast } = useToast()
  const [editLog, setEditLog] = useState<WhiskyLog | null>(null)
  const [noteLog, setNoteLog] = useState<WhiskyLog | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [profiles, setProfiles] = useState<Pick<Profile, 'id' | 'nickname'>[]>([])
  type SubTab = 'whisky' | 'bourbon' | 'cognac' | 'cocktail'
  const [subTab, setSubTab] = useState<SubTab>(archiveSubTab)
  const handleSubTab = (t: SubTab) => { setSubTab(t); setArchiveSubTab(t) }

  // 사용자 프로필 목록 로드 (Archive 보기 전환용)
  useEffect(() => {
    fetch('/api/profile?list=1')
      .then((r) => r.json())
      .then((j: { data?: Pick<Profile, 'id'|'nickname'>[] }) => setProfiles(j.data || []))
      .catch(() => {})
  }, [])

  // archiveView에 따른 user_id 필터링 ('mine' = currentUserId, 'all' = 모두, 그 외 = 특정 user_id)
  const userFiltered = (() => {
    if (archiveView === 'all') return collection
    if (archiveView === 'mine') {
      if (!currentUserId) return collection.filter((l) => l.user_id === 'anonymous')
      return collection.filter((l) => l.user_id === currentUserId)
    }
    return collection.filter((l) => l.user_id === archiveView)
  })()

  // Filter by spirit_type per sub-tab
  const filteredLogs = (tab: SubTab): WhiskyLog[] => {
    if (tab === 'whisky')  return userFiltered.filter((l) => !l.spirit_type || l.spirit_type === 'whisky')
    if (tab === 'bourbon') return userFiltered.filter((l) => l.spirit_type === 'bourbon')
    if (tab === 'cognac')  return userFiltered.filter((l) => l.spirit_type === 'cognac')
    return userFiltered.filter((l) => l.spirit_type === 'cocktail')
  }
  const visibleLogs = filteredLogs(subTab)

  const isOwnLog = (log: WhiskyLog) => currentUserId && log.user_id === currentUserId

  const openShare = (log: WhiskyLog) => {
    loadLog({ ...log })
    setActiveTab('share')
  }

  const handleDelete = async (id: string) => {
    if (confirmId !== id) {
      setConfirmId(id)
      // auto-cancel confirm after 3s so it doesn't stick
      setTimeout(() => setConfirmId((cur) => (cur === id ? null : cur)), 3000)
      return
    }
    setDeletingId(id)
    try {
      const res = await fetch('/api/whisky-logs', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (!res.ok) throw new Error('삭제 실패')
      removeFromCollection(id)
      showToast('삭제됨', 'ok')
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : '삭제 실패', 'err')
    } finally {
      setDeletingId(null)
      setConfirmId(null)
    }
  }

  return (
    <div className="m-page" style={{ maxWidth: 1100, margin: '0 auto', padding: '2rem 1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '1rem', marginBottom: '1rem' }}>
        <h1 className="display" style={{ fontSize: '2rem', color: 'var(--tx)' }}>Archive</h1>
        <span className="mono" style={{ fontSize: '0.62rem', color: 'var(--tx3)', marginLeft: 'auto' }}>
          카드 → 상세 · 📝 → 개인 노트
        </span>
      </div>

      {/* User filter — 내 기록 / 전체 / 다른 사용자 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <button onClick={() => setArchiveView('all')} className="mono"
          style={{
            padding: '0.4rem 0.75rem', cursor: 'pointer', fontSize: '0.65rem',
            background: archiveView === 'all' ? 'var(--gold)' : 'var(--c2)',
            color: archiveView === 'all' ? '#000' : 'var(--tx2)',
            border: `1px solid ${archiveView === 'all' ? 'var(--gold)' : 'var(--bd)'}`,
            letterSpacing: '0.05em', fontWeight: archiveView === 'all' ? 600 : 400,
          }}>
          🌐 전체
        </button>
        <button onClick={() => setArchiveView('mine')} className="mono"
          disabled={!currentUserId}
          style={{
            padding: '0.4rem 0.75rem', cursor: currentUserId ? 'pointer' : 'not-allowed',
            fontSize: '0.65rem',
            background: archiveView === 'mine' ? 'var(--gold)' : 'var(--c2)',
            color: archiveView === 'mine' ? '#000' : currentUserId ? 'var(--tx2)' : 'var(--tx3)',
            border: `1px solid ${archiveView === 'mine' ? 'var(--gold)' : 'var(--bd)'}`,
            letterSpacing: '0.05em', opacity: currentUserId ? 1 : 0.5,
          }}>
          ◈ 내 기록 {currentProfile && `(${currentProfile.nickname})`}
        </button>
        {profiles.length > 0 && (
          <select
            value={archiveView !== 'all' && archiveView !== 'mine' ? archiveView : ''}
            onChange={(e) => { if (e.target.value) setArchiveView(e.target.value) }}
            style={{
              padding: '0.4rem 0.6rem', background: 'var(--c2)', color: 'var(--tx2)',
              border: '1px solid var(--bd)', fontSize: '0.65rem', fontFamily: 'var(--mono)', cursor: 'pointer',
            }}>
            <option value="">👥 다른 사용자 선택...</option>
            {profiles.filter((p) => p.id !== currentUserId).map((p) => (
              <option key={p.id} value={p.id}>{p.nickname}</option>
            ))}
          </select>
        )}
        {!currentUserId && (
          <span className="mono" style={{ fontSize: '0.6rem', color: 'var(--tx3)', marginLeft: 'auto' }}>
            로그인하면 내 기록만 따로 볼 수 있어요
          </span>
        )}
      </div>

      {/* Sub-tabs */}
      <div style={{ display: 'flex', gap: '1px', background: 'var(--bd)', marginBottom: '1.5rem' }}>
        {([
          { id: 'whisky',  label: `🥃 Whisky`,  count: filteredLogs('whisky').length },
          { id: 'bourbon', label: `🌽 Bourbon`,  count: filteredLogs('bourbon').length },
          { id: 'cognac',  label: `🍇 Cognac`,   count: filteredLogs('cognac').length },
          { id: 'cocktail',label: '🍸 Cocktail', count: 0 },
        ] as { id: SubTab; label: string; count: number }[]).map((t) => (
          <button key={t.id} onClick={() => handleSubTab(t.id)} className="mono" style={{
            flex: 1, padding: '0.55rem 0.25rem', border: 'none', cursor: 'pointer',
            background: subTab === t.id ? 'var(--gp)' : 'var(--c2)',
            color: subTab === t.id ? 'var(--gold)' : 'var(--tx2)',
            fontSize: '0.62rem', letterSpacing: '0.05em',
            borderBottom: subTab === t.id ? '1px solid var(--gold)' : '1px solid transparent',
          }}>
            {t.label}{t.count > 0 ? ` · ${t.count}` : ''}
          </button>
        ))}
      </div>

      {/* 빈 상태 */}
      {visibleLogs.length === 0 && (
        <div style={{ textAlign: 'center', padding: '3.5rem 0' }}>
          <p style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>
            {subTab === 'cocktail' ? '🍸' : subTab === 'bourbon' ? '🌽' : subTab === 'cognac' ? '🍇' : '🥃'}
          </p>
          <p style={{ color: 'var(--tx2)', fontStyle: 'italic', fontSize: '0.88rem' }}>
            아직 기록이 없습니다.
          </p>
          <p className="mono" style={{ fontSize: '0.7rem', color: 'var(--tx3)', marginTop: '0.5rem' }}>
            Input → Manual Input → {subTab === 'cocktail' ? '🍸 Cocktail' : subTab === 'bourbon' ? '🌽 Bourbon' : subTab === 'cognac' ? '🍇 Cognac' : '🥃 Whisky'} 에서 추가하세요
          </p>
          <button className="btn-outline-gold" style={{ marginTop: '1.25rem', justifyContent: 'center' }}
            onClick={() => setActiveTab('scan')}>
            + 새 기록 추가 →
          </button>
        </div>
      )}

      {/* 카드 그리드 — 공통 (Whisky / Bourbon / Cognac / Cocktail) */}
      {visibleLogs.length > 0 && (
        <div className="m-card-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: '1px', background: 'var(--bd)' }}>
          {visibleLogs.map((log) => (
            <div
              key={log.id}
              onClick={() => openShare(log)}
              style={{ background: 'var(--c2)', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', paddingBottom: '0.75rem' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'var(--c3)' }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'var(--c2)' }}
            >
              {/* 사진 또는 색상 바 */}
              {log.image_url ? (
                <div style={{ width: '100%', height: 120, background: `url(${log.image_url}) center/cover`, position: 'relative' }}>
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, background: COLOR_HEX[log.color] || 'var(--gold)' }} />
                </div>
              ) : (
                <div style={{ height: 3, background: COLOR_HEX[log.color] || 'var(--gold)' }} />
              )}

              <div style={{ padding: '0.75rem 0.9rem' }}>
                <p className="mono" style={{ fontSize: '0.6rem', color: 'var(--gold)', letterSpacing: '0.08em', marginBottom: '0.3rem', display:'flex', justifyContent:'space-between' }}>
                  <span>{log.region?.toLowerCase()}</span>
                  {log.spirit_type && log.spirit_type !== 'whisky' && (
                    <span style={{ color:'var(--tx3)', textTransform:'uppercase', letterSpacing:'0.06em' }}>{log.spirit_type === 'bourbon' ? '🌽' : '🍇'} {log.spirit_type}</span>
                  )}
                </p>
                <p className="display" style={{ fontSize: '1.2rem', lineHeight: 1.2, marginBottom: '0.25rem', color: 'var(--tx)' }}>
                  {log.brand || '—'}
                </p>
                {log.spirit_type === 'cocktail' ? (
                  /* 칵테일 카드 — method · glass */
                  <p className="mono" style={{ fontSize: '0.65rem', color: 'var(--tx2)', marginBottom: '0.5rem' }}>
                    {[log.cask_no, log.age].filter(Boolean).join(' · ') || '—'}
                  </p>
                ) : (
                  <p className="mono" style={{ fontSize: '0.65rem', color: 'var(--tx2)', marginBottom: '0.5rem' }}>
                    {[log.age, log.bottler === 'IB' ? (log.ib_name || 'IB') : 'OB'].filter(Boolean).join(' · ')}
                  </p>
                )}
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
                <span className="display" style={{ fontSize: '1.25rem', color: 'var(--gold)', display:'flex', alignItems:'baseline', gap:'0.25rem' }}>
                  {toHundred(log.score)}
                  <span style={{ fontSize: '0.6rem', color: 'var(--tx3)' }}>/100</span>
                  {log.would_rebuy === 'yes' && <span title="다시 살 의향" style={{ fontSize: '0.85rem', marginLeft: '0.3rem' }}>🍾</span>}
                  {log.would_rebuy === 'no' && <span title="재구매 안함" style={{ fontSize: '0.7rem', color: '#cf7e7e', marginLeft: '0.3rem' }}>✕</span>}
                </span>
                <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  {(log.casks || []).slice(0, 2).map((c) => (
                    <span key={c} className="mono" style={{ fontSize: '0.55rem', color: 'var(--tx3)', border: '1px solid var(--bd)', padding: '0.1rem 0.35rem' }}>
                      {c}
                    </span>
                  ))}
                </div>
              </div>

              {/* 액션 버튼들 — 카드 바디 클릭과 분리 */}
              <div style={{
                position: 'absolute', top: '0.5rem', right: '0.5rem',
                display: 'flex', gap: '0.3rem',
              }}>
                {/* 개인 노트 (모든 카드) */}
                <button
                  onClick={(e) => { e.stopPropagation(); setNoteLog(log) }}
                  title="개인 노트"
                  style={{
                    background: 'var(--icon-bg)', border: '1px solid var(--bd)',
                    color: 'var(--gold)', fontSize: '0.85rem',
                    width: 28, height: 28, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    backdropFilter: 'blur(4px)',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--gold)'; (e.currentTarget as HTMLButtonElement).style.color = '#000' }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--icon-bg)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--gold)' }}
                >
                  📝
                </button>
                {/* 수정 — 내 기록만 */}
                {isOwnLog(log) && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setEditLog(log) }}
                    title="수정"
                    style={{
                      background: 'var(--icon-bg)', border: '1px solid var(--bd)',
                      color: 'var(--gold)', fontSize: '0.85rem',
                      width: 28, height: 28, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      backdropFilter: 'blur(4px)',
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--gold)'; (e.currentTarget as HTMLButtonElement).style.color = '#000' }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--icon-bg)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--gold)' }}
                  >
                    ✎
                  </button>
                )}
                {/* 삭제 — 내 기록만 */}
                {isOwnLog(log) && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(log.id) }}
                    disabled={deletingId === log.id}
                    title={confirmId === log.id ? '한 번 더 눌러 삭제' : '삭제'}
                    style={{
                      background: confirmId === log.id ? '#cf7e7e' : 'var(--icon-bg)',
                      border: `1px solid ${confirmId === log.id ? '#cf7e7e' : 'var(--bd)'}`,
                      color: confirmId === log.id ? '#fff' : '#cf7e7e',
                      fontSize: '0.8rem',
                      minWidth: 28, height: 28, padding: confirmId === log.id ? '0 0.5rem' : 0,
                      cursor: deletingId === log.id ? 'wait' : 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      backdropFilter: 'blur(4px)',
                      fontFamily: 'var(--mono)',
                    }}
                  >
                    {deletingId === log.id ? '…' : confirmId === log.id ? '확인?' : '🗑'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {editLog && <EditModal log={editLog} onClose={() => setEditLog(null)} />}
      {noteLog && <PersonalNotePanel log={noteLog} onClose={() => setNoteLog(null)} />}
    </div>
  )
}
