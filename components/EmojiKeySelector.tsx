'use client'
import { useState } from 'react'
import { KEY_MAP, findEmojiForLabel } from '@/lib/tastingEmojis'

type Field = 'nose' | 'palate' | 'finish'

interface Props {
  /** 선택된 키 — 선택한 순서대로 보존됨 */
  selected: string[]
  onChange: (next: string[]) => void
  /** 단일 필드만 보여줄지 (PersonalNote용) 또는 3개 모두 (TastingPage용) */
  fields?: Field[]
  /** 사용자 추가 입력 활성화 */
  allowCustom?: boolean
}

const FIELD_LABELS: Record<Field, string> = {
  nose: '🌸 향 (Nose)',
  palate: '🥃 맛 (Palate)',
  finish: '✨ 여운 (Finish)',
}

export default function EmojiKeySelector({ selected, onChange, fields = ['nose','palate','finish'], allowCustom = true }: Props) {
  const [activeField, setActiveField] = useState<Field>(fields[0])
  const [customInput, setCustomInput] = useState('')

  const isSelected = (label: string) => selected.includes(label)

  const toggle = (label: string) => {
    if (isSelected(label)) {
      onChange(selected.filter((x) => x !== label))
    } else {
      // 선택 순서대로 끝에 추가
      onChange([...selected, label])
    }
  }

  const addCustom = () => {
    const v = customInput.trim()
    if (!v || isSelected(v)) { setCustomInput(''); return }
    onChange([...selected, v])
    setCustomInput('')
  }

  const moveUp = (i: number) => {
    if (i === 0) return
    const next = [...selected]
    ;[next[i - 1], next[i]] = [next[i], next[i - 1]]
    onChange(next)
  }

  const remove = (label: string) => onChange(selected.filter((x) => x !== label))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {/* 필드 탭 */}
      {fields.length > 1 && (
        <div style={{ display: 'flex', gap: '1px', background: 'var(--bd)' }}>
          {fields.map((f) => (
            <button key={f} onClick={() => setActiveField(f)} className="mono"
              style={{
                flex: 1, padding: '0.45rem', border: 'none', cursor: 'pointer',
                background: activeField === f ? 'var(--gp)' : 'var(--c2)',
                color: activeField === f ? 'var(--gold)' : 'var(--tx2)',
                fontSize: '0.65rem', letterSpacing: '0.05em',
                borderBottom: activeField === f ? '1px solid var(--gold)' : '1px solid transparent',
              }}>
              {FIELD_LABELS[f]}
            </button>
          ))}
        </div>
      )}

      {/* 키워드 칩 그리드 */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: '0.3rem',
        padding: '0.6rem', background: 'var(--c3)', border: '1px solid var(--bd)', maxHeight: 280, overflowY: 'auto',
      }}>
        {KEY_MAP[activeField].map((k, i) => {
          const sel = isSelected(k.label)
          return (
            <button key={`${k.label}-${i}`} onClick={() => toggle(k.label)} className="mono"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                padding: '0.3rem 0.5rem', cursor: 'pointer',
                background: sel ? 'var(--gold)' : 'var(--c2)',
                color: sel ? '#000' : 'var(--tx)',
                border: `1px solid ${sel ? 'var(--gold)' : 'var(--bd)'}`,
                fontSize: '0.7rem', letterSpacing: '0.02em',
                transition: 'all 0.15s',
              }}>
              <span style={{ fontSize: '0.85rem' }}>{k.emoji}</span>
              {k.label}
            </button>
          )
        })}
      </div>

      {/* 자유 입력 */}
      {allowCustom && (
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          <input type="text" value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustom() } }}
            placeholder="원하는 키워드를 직접 추가 (Enter)"
            style={{ flex: 1, border: '1px solid var(--bd)', padding: '0.45rem 0.6rem', background: 'var(--c3)', color: 'var(--tx)', fontSize: '0.78rem' }} />
          <button onClick={addCustom} className="btn-outline-gold" style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem' }}>+</button>
        </div>
      )}

      {/* 선택된 키 — 선택 순서대로 표시, 위로 이동/제거 가능 */}
      {selected.length > 0 && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.4rem' }}>
            <p className="mono" style={{ fontSize: '0.6rem', color: 'var(--gold)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              ✓ 선택 순서 ({selected.length})
            </p>
            <button onClick={() => onChange([])} className="mono"
              style={{ background: 'none', border: 'none', color: 'var(--tx3)', fontSize: '0.62rem', cursor: 'pointer' }}>
              전체 삭제
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            {selected.map((label, i) => {
              const emoji = findEmojiForLabel(label, activeField)
              return (
                <div key={`${label}-${i}`}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                    padding: '0.35rem 0.5rem', background: 'var(--c3)', border: '1px solid var(--bd2)',
                  }}>
                  <span className="mono" style={{ fontSize: '0.65rem', color: 'var(--gold)', minWidth: 20 }}>
                    {(i + 1).toString().padStart(2, '0')}
                  </span>
                  {emoji && <span style={{ fontSize: '0.95rem' }}>{emoji}</span>}
                  <span style={{ flex: 1, fontSize: '0.78rem', color: 'var(--tx)' }}>{label}</span>
                  <button onClick={() => moveUp(i)} disabled={i === 0}
                    title="위로"
                    style={{ background: 'none', border: 'none', color: i === 0 ? 'var(--tx3)' : 'var(--gold)', cursor: i === 0 ? 'default' : 'pointer', fontSize: '0.85rem' }}>↑</button>
                  <button onClick={() => remove(label)}
                    title="제거"
                    style={{ background: 'none', border: 'none', color: '#cf7e7e', cursor: 'pointer', fontSize: '0.85rem' }}>✕</button>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
