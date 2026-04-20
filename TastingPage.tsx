'use client'
import { useState } from 'react'
import { useStore } from '@/lib/store'
import { useToast } from '@/components/Toast'
import Modal from '@/components/Modal'
import { aiGenerate } from '@/lib/api'
import { WhiskyLog, ExtractedKeys } from '@/types'

const COLORS = [
  { name: 'Pale Straw', hex: '#F5F0DC' },
  { name: 'Light Gold', hex: '#E8CC7A' },
  { name: 'Deep Gold', hex: '#C9A84C' },
  { name: 'Amber', hex: '#A0693A' },
  { name: 'Deep Amber', hex: '#7A4820' },
  { name: 'Mahogany', hex: '#4A1E0A' },
]

type NoteType = 'nose' | 'palate' | 'finish'

interface NoteModalState {
  type: NoteType
  draft: string
  loading: boolean
}

interface CommentStep {
  step: 1 | 2 | 3
}

export default function TastingPage() {
  const { currentLog, updateCurrentLog, upsertToCollection, setActiveTab, setExtractedKeys, extractedKeys } = useStore()
  const { showToast } = useToast()

  const [noteModal, setNoteModal] = useState<NoteModalState | null>(null)
  const [commentStep, setCommentStep] = useState<CommentStep>({ step: 1 })
  const [excludedKeys, setExcludedKeys] = useState<Record<string, boolean>>({})
  const [instaCaption, setInstaCaption] = useState('')
  const [extractLoading, setExtractLoading] = useState(false)
  const [instaLoading, setInstaLoading] = useState(false)
  const [showUpdateBanner, setShowUpdateBanner] = useState(false)

  const score = currentLog.score ?? 4.0
  const color = currentLog.color ?? 'Deep Gold'

  const setScore = (s: number) => updateCurrentLog({ score: s })
  const setColor = (c: string) => updateCurrentLog({ color: c })
  const setNose = (v: string) => updateCurrentLog({ nose: v })
  const setPalate = (v: string) => updateCurrentLog({ palate: v })
  const setFinish = (v: string) => updateCurrentLog({ finish: v })
  const setComment = (v: string) => updateCurrentLog({ comment: v })

  // Open note modal with expand or compress
  const openNoteModal = async (type: NoteType, action: 'expand_note' | 'compress_note') => {
    const text = type === 'nose' ? currentLog.nose : type === 'palate' ? currentLog.palate : currentLog.finish
    if (!text) { showToast('Write a note first', 'err'); return }
    setNoteModal({ type, draft: '', loading: true })
    try {
      const result = await aiGenerate(action, { type, text })
      setNoteModal({ type, draft: result, loading: false })
    } catch {
      showToast('AI error', 'err')
      setNoteModal(null)
    }
  }

  const applyNoteDraft = () => {
    if (!noteModal) return
    if (noteModal.type === 'nose') setNose(noteModal.draft)
    else if (noteModal.type === 'palate') setPalate(noteModal.draft)
    else setFinish(noteModal.draft)
    setNoteModal(null)
    showToast('Applied', 'ok')
  }

  const regenerateNote = async (action: 'expand_note' | 'compress_note') => {
    if (!noteModal) return
    const text = noteModal.type === 'nose' ? currentLog.nose : noteModal.type === 'palate' ? currentLog.palate : currentLog.finish
    if (!text) return
    setNoteModal(prev => prev ? { ...prev, loading: true } : null)
    try {
      const result = await aiGenerate(action, { type: noteModal.type, text })
      setNoteModal(prev => prev ? { ...prev, draft: result, loading: false } : null)
    } catch {
      showToast('AI error', 'err')
    }
  }

  const loadFromNotes = () => {
    const combined = [
      currentLog.nose && `Nose: ${currentLog.nose}`,
      currentLog.palate && `Palate: ${currentLog.palate}`,
      currentLog.finish && `Finish: ${currentLog.finish}`,
    ].filter(Boolean).join('\n')
    updateCurrentLog({ comment: combined })
  }

  const extractKeys = async () => {
    if (!currentLog.comment) { showToast('Write a comment first', 'err'); return }
    setExtractLoading(true)
    try {
      const result = await aiGenerate('extract_keys', { text: currentLog.comment })
      const parsed: ExtractedKeys = JSON.parse(result)
      setExtractedKeys(parsed)
      setExcludedKeys({})
      setCommentStep({ step: 2 })
    } catch {
      showToast('Extraction failed', 'err')
    } finally {
      setExtractLoading(false)
    }
  }

  const toggleExclude = (key: string) => {
    setExcludedKeys(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const genInstaFromKeys = async () => {
    setInstaLoading(true)
    try {
      const filterKeys = (arr: string[]) => arr.filter(k => !excludedKeys[k])
      const result = await aiGenerate('gen_insta_from_keys', {
        nose: filterKeys(extractedKeys.nose).join(', '),
        palate: filterKeys(extractedKeys.palate).join(', '),
        finish: filterKeys(extractedKeys.finish).join(', '),
        brand: currentLog.brand || '',
        age: currentLog.age || '',
      })
      setInstaCaption(result)
      setCommentStep({ step: 3 })
    } catch {
      showToast('Generation failed', 'err')
    } finally {
      setInstaLoading(false)
    }
  }

  const applyKeywordsAndSave = () => {
    const filterKeys = (arr: string[]) => arr.filter(k => !excludedKeys[k])
    updateCurrentLog({
      nose: filterKeys(extractedKeys.nose).join(', ') || currentLog.nose,
      palate: filterKeys(extractedKeys.palate).join(', ') || currentLog.palate,
      finish: filterKeys(extractedKeys.finish).join(', ') || currentLog.finish,
      comment_insta: instaCaption,
    })
    setShowUpdateBanner(false)
    showToast('Keywords applied', 'ok')
  }

  const archiveDram = () => {
    const id = currentLog.id || crypto.randomUUID()
    const log: WhiskyLog = {
      id,
      user_id: 'anonymous',
      brand: currentLog.brand || 'Unknown',
      region: currentLog.region || '',
      bottler: currentLog.bottler || 'OB',
      ib_name: currentLog.ib_name,
      age: currentLog.age,
      vintage: currentLog.vintage,
      distilled_date: currentLog.distilled_date,
      bottled_date: currentLog.bottled_date,
      abv: currentLog.abv,
      casks: currentLog.casks || [],
      cask_no: currentLog.cask_no,
      bottles: currentLog.bottles,
      image_url: currentLog.image_url,
      color: currentLog.color || 'Deep Gold',
      score: currentLog.score ?? 4.0,
      nose: currentLog.nose,
      palate: currentLog.palate,
      finish: currentLog.finish,
      comment: currentLog.comment,
      comment_insta: currentLog.comment_insta || instaCaption,
      blog_post: currentLog.blog_post,
      insta_post: currentLog.insta_post,
      date: currentLog.date || new Date().toISOString().split('T')[0],
      created_at: currentLog.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    upsertToCollection(log)
    showToast('Archived to collection', 'ok')
    setActiveTab('collection')
  }

  const scoreStars = Math.round(score)

  const NoteCard = ({ type, label }: { type: NoteType; label: string }) => {
    const value = type === 'nose' ? currentLog.nose : type === 'palate' ? currentLog.palate : currentLog.finish
    const setter = type === 'nose' ? setNose : type === 'palate' ? setPalate : setFinish
    return (
      <div className="card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p className="mono" style={{ fontSize: '0.65rem', color: 'var(--tx2)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{label}</p>
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <button className="btn-ghost" style={{ padding: '0.25rem 0.5rem', fontSize: '0.65rem' }} onClick={() => openNoteModal(type, 'expand_note')}>Expand</button>
            <button className="btn-ghost" style={{ padding: '0.25rem 0.5rem', fontSize: '0.65rem' }} onClick={() => openNoteModal(type, 'compress_note')}>Compress</button>
          </div>
        </div>
        <textarea
          value={value || ''}
          onChange={e => setter(e.target.value)}
          placeholder={`Describe the ${label.toLowerCase()}...`}
          style={{ minHeight: '80px', lineHeight: '1.6' }}
        />
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '2rem 1rem' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 className="display" style={{ fontSize: '2.2rem', color: 'var(--gold)' }}>
          {currentLog.brand || 'Unnamed Whisky'}
          {currentLog.age && <span style={{ fontSize: '1.4rem', marginLeft: '0.5rem', color: 'var(--tx2)' }}>{currentLog.age}</span>}
        </h1>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
          {currentLog.region && <span className="mono" style={{ fontSize: '0.65rem', color: 'var(--tx2)' }}>{currentLog.region}</span>}
          {currentLog.abv && <span className="mono" style={{ fontSize: '0.65rem', color: 'var(--tx2)' }}>· {currentLog.abv}%</span>}
          {(currentLog.casks || []).map(c => (
            <span key={c} className="ctag" style={{ cursor: 'default' }}>{c}</span>
          ))}
        </div>
      </div>

      {/* 2-col grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1px', background: 'var(--bd)', marginBottom: '1px' }}>
        {/* Color card */}
        <div className="card" style={{ padding: '1rem' }}>
          <p className="mono" style={{ fontSize: '0.65rem', color: 'var(--tx2)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.75rem' }}>Color</p>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {COLORS.map(c => (
              <button
                key={c.name}
                title={c.name}
                onClick={() => setColor(c.name)}
                style={{
                  width: '36px', height: '36px',
                  background: c.hex,
                  border: color === c.name ? '2px solid var(--gold)' : '2px solid transparent',
                  cursor: 'pointer',
                  borderRadius: '2px',
                  transition: 'border-color 0.2s',
                }}
              />
            ))}
          </div>
          {color && (
            <p className="mono" style={{ fontSize: '0.65rem', color: 'var(--gold)', marginTop: '0.5rem' }}>{color}</p>
          )}
        </div>

        {/* Score card */}
        <div className="card" style={{ padding: '1rem' }}>
          <p className="mono" style={{ fontSize: '0.65rem', color: 'var(--tx2)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.75rem' }}>Score</p>
          <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.75rem' }}>
            {[1, 2, 3, 4, 5].map(s => (
              <button
                key={s}
                onClick={() => setScore(s)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: '1.4rem',
                  color: s <= scoreStars ? 'var(--gold)' : 'var(--bd2)',
                  transition: 'color 0.2s',
                }}
              >
                ★
              </button>
            ))}
          </div>
          <input
            type="range"
            min={1}
            max={5}
            step={0.1}
            value={score}
            onChange={e => setScore(parseFloat(e.target.value))}
            style={{ width: '100%', accentColor: 'var(--gold)', marginBottom: '0.5rem' }}
          />
          <p className="display" style={{ fontSize: '2.5rem', color: 'var(--gold)' }}>{score.toFixed(1)}</p>
        </div>
      </div>

      {/* Nose & Palate */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1px', background: 'var(--bd)', marginBottom: '1px' }}>
        <NoteCard type="nose" label="Nose" />
        <NoteCard type="palate" label="Palate" />
      </div>

      {/* Finish */}
      <div style={{ marginBottom: '1px' }}>
        <NoteCard type="finish" label="Finish" />
      </div>

      {/* Comments */}
      <div style={{ borderTop: '2px solid var(--gold)', background: 'var(--c2)', padding: '1.25rem', marginBottom: '1.5rem' }}>
        <p className="mono" style={{ fontSize: '0.65rem', color: 'var(--tx2)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1rem' }}>Comments</p>

        {commentStep.step === 1 && (
          <div>
            <div style={{ position: 'relative' }}>
              <textarea
                value={currentLog.comment || ''}
                onChange={e => setComment(e.target.value)}
                placeholder="Write your overall impression..."
                style={{ minHeight: '100px', lineHeight: '1.7', background: 'var(--c3)', padding: '0.75rem' }}
              />
              <p className="mono" style={{ fontSize: '0.6rem', color: 'var(--tx3)', textAlign: 'right', marginTop: '0.25rem' }}>
                {(currentLog.comment || '').length} chars
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
              <button className="btn-ghost" onClick={loadFromNotes}>Load from Notes</button>
              <button className="btn-outline-gold" onClick={extractKeys} disabled={extractLoading}>
                {extractLoading ? <><span className="spinner" /> Extracting...</> : '✦ Step 2: Extract Keys →'}
              </button>
            </div>
          </div>
        )}

        {commentStep.step === 2 && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              {(['nose', 'palate', 'finish'] as NoteType[]).map(type => (
                <div key={type}>
                  <p className="mono" style={{ fontSize: '0.6rem', color: 'var(--tx2)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>{type}</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                    {extractedKeys[type].map(key => (
                      <button
                        key={key}
                        className={`ctag${excludedKeys[key] ? ' excluded' : ''}`}
                        onClick={() => toggleExclude(key)}
                      >
                        {key}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn-ghost" onClick={() => setCommentStep({ step: 1 })}>← Back</button>
              <button className="btn-outline-gold" onClick={genInstaFromKeys} disabled={instaLoading}>
                {instaLoading ? <><span className="spinner" /> Generating...</> : '✦ Step 3: Generate Instagram →'}
              </button>
            </div>
          </div>
        )}

        {commentStep.step === 3 && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <p className="mono" style={{ fontSize: '0.6rem', color: 'var(--tx2)', textTransform: 'uppercase' }}>Instagram Caption</p>
              <span className="mono" style={{ fontSize: '0.6rem', color: 'var(--tx3)' }}>{instaCaption.length} / 300</span>
            </div>
            <textarea
              value={instaCaption}
              onChange={e => setInstaCaption(e.target.value)}
              style={{ minHeight: '100px', background: 'var(--c3)', padding: '0.75rem', lineHeight: '1.6' }}
            />
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
              <button className="btn-ghost" onClick={() => setCommentStep({ step: 2 })}>← Back</button>
              <button className="btn-ghost" onClick={() => {
                navigator.clipboard.writeText(instaCaption)
                showToast('Copied!', 'ok')
              }}>Copy</button>
              <button className="btn-outline-gold" onClick={() => setShowUpdateBanner(true)}>Apply & Save</button>
            </div>
          </div>
        )}

        {showUpdateBanner && (
          <div style={{ marginTop: '1rem', padding: '1rem', background: 'var(--gp)', border: '1px solid var(--bd2)' }}>
            <p className="mono" style={{ fontSize: '0.7rem', color: 'var(--gold)', marginBottom: '0.75rem' }}>Update tasting notes?</p>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button className="btn-gold" onClick={applyKeywordsAndSave}>Apply Keywords & Save</button>
              <button className="btn-outline-gold" onClick={() => {
                updateCurrentLog({ comment_insta: instaCaption })
                setShowUpdateBanner(false)
                showToast('Caption saved', 'ok')
              }}>Update Notes Only</button>
              <button className="btn-ghost" onClick={() => setShowUpdateBanner(false)}>Ignore</button>
            </div>
          </div>
        )}
      </div>

      {/* Archive button */}
      <button className="btn-gold" style={{ width: '100%', padding: '0.75rem', fontSize: '0.8rem' }} onClick={archiveDram}>
        Archive this Dram →
      </button>

      {/* Note modal */}
      {noteModal && (
        <Modal
          title={`AI — ${noteModal.type.charAt(0).toUpperCase() + noteModal.type.slice(1)}`}
          subtitle="Preview and apply AI suggestion"
          onClose={() => setNoteModal(null)}
          actions={
            <>
              <button className="btn-ghost" onClick={() => setNoteModal(null)}>Close</button>
              <button className="btn-ghost" onClick={() => regenerateNote('expand_note')}>Regenerate</button>
              <button className="btn-gold" onClick={applyNoteDraft} disabled={noteModal.loading}>Apply</button>
            </>
          }
        >
          {noteModal.loading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--tx2)' }}>
              <span className="spinner" />
              <span className="mono" style={{ fontSize: '0.75rem' }}>Generating...</span>
            </div>
          ) : (
            <textarea
              value={noteModal.draft}
              onChange={e => setNoteModal(prev => prev ? { ...prev, draft: e.target.value } : null)}
              style={{ minHeight: '120px', lineHeight: '1.7', background: 'var(--c3)', padding: '0.75rem' }}
            />
          )}
        </Modal>
      )}
    </div>
  )
}
