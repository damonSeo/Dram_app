'use client'
import { useState } from 'react'
import { useStore } from '@/lib/store'
import { useToast } from '@/components/Toast'
import Modal from '@/components/Modal'
import type { WhiskyLog, ExtractedKeys } from '@/types'

const COLORS = [
  { name: 'Pale Straw', hex: '#F5F0DC' },
  { name: 'Light Gold', hex: '#E8CC7A' },
  { name: 'Deep Gold', hex: '#C9A84C' },
  { name: 'Amber', hex: '#A0693A' },
  { name: 'Deep Amber', hex: '#7A4820' },
  { name: 'Mahogany', hex: '#4A1E0A' },
]

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

interface AiModal {
  open: boolean
  title: string
  text: string
  loading: boolean
  field?: 'nose' | 'palate' | 'finish'
  action?: string
  payload?: object
}

export default function TastingPage() {
  const { currentLog, collection, updateCurrentLog, upsertToCollection, resetCurrentLog, setActiveTab, setExtractedKeys, setDirty } = useStore()
  const { showToast } = useToast()

  const [aiModal, setAiModal] = useState<AiModal>({ open: false, title: '', text: '', loading: false })

  // Comments flow
  const [comment, setComment] = useState(currentLog.comment || '')
  const [step, setStep] = useState<1|2|3>(1)
  const [extractedKeys, setLocalExtractedKeys] = useState<ExtractedKeys>({ nose:[], palate:[], finish:[] })
  const [excludedKeys, setExcludedKeys] = useState<Set<string>>(new Set())
  const [instaText, setInstaText] = useState('')
  const [extracting, setExtracting] = useState(false)
  const [genInsta, setGenInsta] = useState(false)
  const [showBanner, setShowBanner] = useState(false)
  const [saving, setSaving] = useState(false)

  const aiPayload = () => ({
    brand: currentLog.brand, age: currentLog.age, abv: currentLog.abv,
    casks: currentLog.casks, region: currentLog.region,
  })

  const openAI = async (title: string, action: string, field: 'nose'|'palate'|'finish', payload: object) => {
    setAiModal({ open: true, title, text: '', loading: true, field, action, payload })
    try {
      const text = await callAI(action, payload)
      setAiModal((p) => ({ ...p, text, loading: false }))
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'AI 오류', 'err')
      setAiModal((p) => ({ ...p, open: false }))
    }
  }

  const applyAiResult = () => {
    if (aiModal.field) {
      updateCurrentLog({ [aiModal.field]: aiModal.text })
    }
    setAiModal((p) => ({ ...p, open: false }))
    showToast('적용됨', 'ok')
  }

  const regenerateAI = async () => {
    if (!aiModal.action || !aiModal.payload) return
    setAiModal((p) => ({ ...p, loading: true, text: '' }))
    try {
      const text = await callAI(aiModal.action, aiModal.payload)
      setAiModal((p) => ({ ...p, text, loading: false }))
    } catch {
      showToast('AI 재생성 실패', 'err')
      setAiModal((p) => ({ ...p, loading: false }))
    }
  }

  const handleExtractKeys = async () => {
    if (!comment.trim()) { showToast('코멘트를 입력해주세요', 'err'); return }
    setExtracting(true)
    try {
      const text = await callAI('extract_keys', { longText: comment, ...aiPayload() })
      const match = text.match(/\{[\s\S]*\}/)
      if (match) {
        const keys: ExtractedKeys = JSON.parse(match[0])
        setLocalExtractedKeys(keys)
        setExtractedKeys(keys)
        setExcludedKeys(new Set())
        setStep(2)
        showToast('키워드 추출 완료', 'ok')
      }
    } catch {
      showToast('키워드 추출 실패', 'err')
    } finally {
      setExtracting(false)
    }
  }

  const handleGenInsta = async () => {
    setGenInsta(true)
    try {
      const selNose = extractedKeys.nose.filter((k) => !excludedKeys.has(k)).join(', ')
      const selPalate = extractedKeys.palate.filter((k) => !excludedKeys.has(k)).join(', ')
      const selFinish = extractedKeys.finish.filter((k) => !excludedKeys.has(k)).join(', ')
      const text = await callAI('gen_insta_from_keys', {
        selectedNose: selNose, selectedPalate: selPalate, selectedFinish: selFinish,
        longText: comment, score: currentLog.score, ...aiPayload(),
      })
      setInstaText(text)
      setStep(3)
      setShowBanner(true)
    } catch {
      showToast('인스타 생성 실패', 'err')
    } finally {
      setGenInsta(false)
    }
  }

  const applyKeywordsAndSave = () => {
    const selNose = extractedKeys.nose.filter((k) => !excludedKeys.has(k))
    const selPalate = extractedKeys.palate.filter((k) => !excludedKeys.has(k))
    const selFinish = extractedKeys.finish.filter((k) => !excludedKeys.has(k))
    const newNose = [currentLog.nose, selNose.join(', ')].filter(Boolean).join(' / ')
    const newPalate = [currentLog.palate, selPalate.join(', ')].filter(Boolean).join(' / ')
    const newFinish = [currentLog.finish, selFinish.join(', ')].filter(Boolean).join(' / ')
    updateCurrentLog({ nose: newNose, palate: newPalate, finish: newFinish, comment, comment_insta: instaText })
    setShowBanner(false)
    showToast('키워드 적용 완료', 'ok')
  }

  const archiveDram = async () => {
    setSaving(true)
    try {
      const isUpdate = !!currentLog.id && collection.some((l) => l.id === currentLog.id)
      const logBase = {
        ...currentLog,
        brand: currentLog.brand || '',
        region: currentLog.region || '',
        bottler: currentLog.bottler || 'OB',
        color: currentLog.color || 'Deep Gold',
        score: currentLog.score ?? 7.0,
        casks: currentLog.casks || [],
        date: currentLog.date || new Date().toISOString().split('T')[0],
        comment,
        comment_insta: instaText || currentLog.comment_insta,
      }
      const body = isUpdate ? { id: currentLog.id, ...logBase } : logBase
      const res = await fetch('/api/whisky-logs', {
        method: isUpdate ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json() as { data?: WhiskyLog; error?: string }
      if (!res.ok) throw new Error(json.error || '저장 실패')
      if (json.data) upsertToCollection(json.data)
      resetCurrentLog() // 저장 후 새 노트 작성을 위해 리셋
      setActiveTab('collection')
      showToast('컬렉션에 저장됨 · 새 노트를 시작하려면 Scan 탭으로', 'ok')
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : '저장 실패', 'err')
    } finally {
      setSaving(false)
    }
  }

  const noteCard = (field: 'nose'|'palate'|'finish', label: string, fullWidth?: boolean) => (
    <div style={{
      border: '1px solid var(--bd)', background: 'var(--c2)',
      gridColumn: fullWidth ? '1 / -1' : undefined,
    }}>
      <div style={{
        padding: '0.6rem 1rem', borderBottom: '1px solid var(--bd)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <p className="mono" style={{ fontSize: '0.65rem', color: 'var(--tx2)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{label}</p>
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          <button className="btn-ghost" style={{ fontSize: '0.65rem', padding: '0.25rem 0.6rem' }}
            onClick={() => openAI(`◈ 요약 — ${label}`, 'compress_note', field, { field, raw: currentLog[field] || '' })}>
            ◈ 요약
          </button>
          <button className="btn-outline-gold" style={{ fontSize: '0.65rem', padding: '0.25rem 0.6rem' }}
            onClick={() => openAI(`✦ AI 확장 — ${label}`, 'expand_note', field, { field, raw: currentLog[field] || '', ...aiPayload() })}>
            ✦ AI 확장
          </button>
        </div>
      </div>
      <div style={{ padding: '0.75rem 1rem' }}>
        <textarea
          rows={3}
          value={currentLog[field] || ''}
          onChange={(e) => updateCurrentLog({ [field]: e.target.value })}
          placeholder={`${label} 노트를 입력하세요...`}
          style={{ lineHeight: 1.6 }}
        />
      </div>
    </div>
  )

  const toggleKey = (k: string) => {
    setExcludedKeys((prev) => {
      const next = new Set(prev)
      next.has(k) ? next.delete(k) : next.add(k)
      return next
    })
  }

  const meta = [currentLog.age, currentLog.bottler, currentLog.abv, currentLog.region].filter(Boolean).join(' · ')

  return (
    <div className="m-page" style={{ maxWidth: 860, margin: '0 auto', padding: '2rem 1.5rem' }}>
      {/* Header */}
      <div style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--bd)', paddingBottom: '1rem' }}>
        <h1 className="display" style={{ fontSize: '2rem', color: 'var(--tx)', lineHeight: 1.2 }}>
          {currentLog.brand || 'Unnamed Dram'}
        </h1>
        {meta && <p className="mono" style={{ fontSize: '0.7rem', color: 'var(--tx2)', marginTop: '0.4rem', letterSpacing: '0.05em' }}>{meta}</p>}
      </div>

      {/* 2-col grid */}
      <div className="m-grid-collapse" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1px', background: 'var(--bd)', marginBottom: '1px' }}>
        {/* Color card */}
        <div style={{ border: '1px solid var(--bd)', background: 'var(--c2)' }}>
          <div style={{ padding: '0.6rem 1rem', borderBottom: '1px solid var(--bd)' }}>
            <p className="mono" style={{ fontSize: '0.65rem', color: 'var(--tx2)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Color</p>
          </div>
          <div style={{ padding: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {COLORS.map((c) => (
              <div key={c.name} onClick={() => updateCurrentLog({ color: c.name })}
                title={c.name}
                style={{
                  width: 36, height: 36, background: c.hex, cursor: 'pointer', flexShrink: 0,
                  border: currentLog.color === c.name ? '2px solid var(--gold)' : '2px solid transparent',
                  transition: 'border 0.2s',
                }} />
            ))}
          </div>
          {currentLog.color && (
            <p className="mono" style={{ fontSize: '0.65rem', color: 'var(--gold)', padding: '0 1rem 0.75rem', letterSpacing: '0.06em' }}>
              {currentLog.color}
            </p>
          )}
        </div>

        {/* Score card — 10점 만점 */}
        <div style={{ border: '1px solid var(--bd)', background: 'var(--c2)' }}>
          <div style={{ padding: '0.6rem 1rem', borderBottom: '1px solid var(--bd)' }}>
            <p className="mono" style={{ fontSize: '0.65rem', color: 'var(--tx2)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Score · /10</p>
          </div>
          <div style={{ padding: '1rem', textAlign: 'center' }}>
            <p className="display" style={{ fontSize: '3rem', color: 'var(--gold)', lineHeight: 1 }}>
              {(currentLog.score ?? 7.0).toFixed(1)}
              <span style={{ fontSize: '1rem', color: 'var(--tx3)' }}> / 10</span>
            </p>
            <div style={{ margin: '0.75rem 0 0.5rem', display: 'flex', justifyContent: 'center', gap: '0.35rem' }}>
              {[1,2,3,4,5].map((s) => (
                <button key={s} onClick={() => updateCurrentLog({ score: s * 2 })}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.25rem',
                    color: (currentLog.score ?? 7) >= s * 2 ? 'var(--gold)' : 'var(--tx3)' }}>★</button>
              ))}
            </div>
            <input type="range" min={0} max={10} step={0.1}
              value={currentLog.score ?? 7.0}
              onChange={(e) => updateCurrentLog({ score: parseFloat(e.target.value) })}
              style={{ width: '100%', accentColor: 'var(--gold)' }} />
            <input type="number" min={0} max={10} step={0.1}
              value={(currentLog.score ?? 7.0).toFixed(1)}
              onChange={(e) => {
                const v = parseFloat(e.target.value)
                if (!isNaN(v)) updateCurrentLog({ score: Math.max(0, Math.min(10, v)) })
              }}
              className="mono"
              style={{ width: '5rem', marginTop: '0.5rem', textAlign: 'center', fontSize: '0.8rem',
                border: '1px solid var(--bd)', background: 'var(--c3)', color: 'var(--tx)', padding: '0.3rem' }} />
          </div>
        </div>

        {/* Nose */}
        {noteCard('nose', 'Nose')}
        {/* Palate */}
        {noteCard('palate', 'Palate')}
        {/* Finish – full width */}
        {noteCard('finish', 'Finish', true)}
      </div>

      {/* Comments 3-step */}
      <div style={{ border: '1px solid var(--bd)', background: 'var(--c2)', borderTop: '2px solid var(--gold)', marginBottom: '1.5rem' }}>
        <div style={{ padding: '0.6rem 1rem', borderBottom: '1px solid var(--bd)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p className="mono" style={{ fontSize: '0.65rem', color: 'var(--gold)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Comments</p>
          <span className="mono" style={{ fontSize: '0.6rem', color: 'var(--tx3)' }}>Step {step} / 3</span>
        </div>

        {/* Step 1 */}
        <div style={{ padding: '1rem', borderBottom: step > 1 ? '1px solid var(--bd)' : undefined }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <p className="mono" style={{ fontSize: '0.6rem', color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Step 1 — 자유 작성</p>
            <span className="mono" style={{ fontSize: '0.6rem', color: comment.length > 800 ? '#cf7e7e' : 'var(--tx3)' }}>
              {comment.length}자
            </span>
          </div>
          <textarea rows={5} value={comment} onChange={(e) => { setComment(e.target.value); setDirty(true) }}
            placeholder="시음 느낌을 자유롭게 적어주세요..." style={{ lineHeight: 1.7 }} />
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
            <button className="btn-ghost" style={{ fontSize: '0.7rem' }}
              onClick={() => {
                const auto = [
                  currentLog.nose ? `Nose: ${currentLog.nose}` : '',
                  currentLog.palate ? `Palate: ${currentLog.palate}` : '',
                  currentLog.finish ? `Finish: ${currentLog.finish}` : '',
                ].filter(Boolean).join('\n')
                setComment(auto)
              }}>
              ◈ 노트에서 불러오기
            </button>
            <button className="btn-outline-gold" style={{ fontSize: '0.7rem' }}
              disabled={extracting || !comment.trim()}
              onClick={handleExtractKeys}>
              {extracting ? <span className="spinner" /> : null}
              ✦ Step 2 : 키 추출 →
            </button>
          </div>
        </div>

        {/* Step 2 */}
        {step >= 2 && (
          <div style={{ padding: '1rem', borderBottom: step > 2 ? '1px solid var(--bd)' : undefined, opacity: step >= 2 ? 1 : 0.4 }}>
            <p className="mono" style={{ fontSize: '0.6rem', color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>
              Step 2 — 키워드 확인 (클릭으로 제외)
            </p>
            <div className="m-grid-3-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
              {(['nose','palate','finish'] as const).map((field) => (
                <div key={field}>
                  <p className="mono" style={{ fontSize: '0.6rem', color: 'var(--gold)', marginBottom: '0.4rem', textTransform: 'uppercase' }}>
                    {field === 'nose' ? 'Nose 향' : field === 'palate' ? 'Palate 맛' : 'Finish 여운'}
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                    {extractedKeys[field].map((k) => (
                      <span key={k} className={`key-tag${excludedKeys.has(k) ? ' excluded' : ''}`}
                        onClick={() => toggleKey(k)}>{k}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: '0.75rem' }}>
              <button className="btn-outline-gold" style={{ fontSize: '0.7rem' }}
                disabled={genInsta} onClick={handleGenInsta}>
                {genInsta ? <span className="spinner" /> : null}
                ✦ Step 3 : 인스타 요약 생성 →
              </button>
            </div>
          </div>
        )}

        {/* Step 3 */}
        {step >= 3 && (
          <div style={{ padding: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <p className="mono" style={{ fontSize: '0.6rem', color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Step 3 — Instagram 요약
              </p>
              <span className="mono" style={{ fontSize: '0.6rem', color: instaText.length > 300 ? '#cf7e7e' : 'var(--tx3)' }}>
                {instaText.length} / 300자
              </span>
            </div>
            <textarea rows={4} value={instaText} onChange={(e) => { setInstaText(e.target.value); setDirty(true) }}
              style={{ lineHeight: 1.7, border: '1px solid var(--bd)', padding: '0.5rem' }} />
            <button className="btn-ghost" style={{ fontSize: '0.7rem', marginTop: '0.5rem' }}
              onClick={async () => {
                try { await navigator.clipboard.writeText(instaText); showToast('복사됨', 'ok') }
                catch { showToast('복사 실패', 'err') }
              }}>
              📋 복사
            </button>
          </div>
        )}

        {/* Update Banner */}
        {showBanner && (
          <div className="fade-up" style={{ padding: '1rem', borderTop: '1px solid var(--bd)', background: 'var(--c3)' }}>
            <p className="mono" style={{ fontSize: '0.65rem', color: 'var(--gold)', marginBottom: '0.75rem' }}>
              ✦ 노트 업데이트 옵션
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button className="btn-gold" style={{ fontSize: '0.7rem' }} onClick={applyKeywordsAndSave}>
                ✦ 노트에 키워드 적용 &amp; 저장
              </button>
              <button className="btn-ghost" style={{ fontSize: '0.7rem' }}
                onClick={() => { updateCurrentLog({ comment, comment_insta: instaText }); setShowBanner(false); showToast('노트 업데이트됨', 'ok') }}>
                노트만 업데이트
              </button>
              <button className="btn-ghost" style={{ fontSize: '0.7rem' }} onClick={() => setShowBanner(false)}>
                무시
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Archive button */}
      <button className="btn-gold" style={{ width: '100%', justifyContent: 'center', fontSize: '0.8rem' }}
        onClick={archiveDram} disabled={saving}>
        {saving ? <span className="spinner" style={{ borderTopColor: '#000' }} /> : null}
        컬렉션에 저장 →
      </button>

      {/* AI Modal */}
      <Modal open={aiModal.open} onClose={() => setAiModal((p) => ({ ...p, open: false }))}
        title={aiModal.title}
        actions={
          <>
            <button className="btn-ghost" style={{ fontSize: '0.72rem' }} onClick={regenerateAI} disabled={aiModal.loading}>
              ↺ 재생성
            </button>
            <button className="btn-outline-gold" style={{ fontSize: '0.72rem' }} onClick={applyAiResult} disabled={aiModal.loading || !aiModal.text}>
              적용
            </button>
            <button className="btn-ghost" style={{ fontSize: '0.72rem' }} onClick={() => setAiModal((p) => ({ ...p, open: false }))}>
              닫기
            </button>
          </>
        }>
        {aiModal.loading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem 0' }}>
            <span className="spinner" />
            <span className="mono" style={{ fontSize: '0.72rem', color: 'var(--gold)' }}>AI 생성 중...</span>
          </div>
        ) : (
          <textarea rows={6} value={aiModal.text}
            onChange={(e) => setAiModal((p) => ({ ...p, text: e.target.value }))}
            style={{ border: '1px solid var(--bd)', padding: '0.75rem', lineHeight: 1.7, width: '100%' }} />
        )}
      </Modal>
    </div>
  )
}
