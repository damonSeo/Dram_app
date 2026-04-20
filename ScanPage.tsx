'use client'
import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { useStore } from '@/lib/store'
import { useToast } from '@/components/Toast'
import { runOcr } from '@/lib/api'
import { OcrResult } from '@/types'

const REGIONS = ['Speyside', 'Islay', 'Highland', 'Lowland', 'Campbeltown', 'Island', 'Irish', 'Japanese', 'American', 'Taiwanese', 'Indian', 'Other']

const CASK_TYPES = ['Ex-Bourbon', 'Hogshead', 'Oloroso Sherry', 'Pedro Ximénez', 'Port', 'Rum', 'Madeira', 'Sauternes', 'Virgin Oak', 'American Oak', 'European Oak', 'STR', 'Wine', 'Mizunara']

const AGE_CHIPS = ['NAS', '8yr', '10yr', '12yr', '15yr', '18yr', '21yr', '25yr', '30yr']
const ABV_CHIPS = ['40%', '43%', '46%', '48%', '51.7%', '55%', '58%', 'Cask Strength']

const CURRENT_YEAR = new Date().getFullYear()
const VINTAGE_CHIPS = Array.from({ length: 6 }, (_, i) => String(CURRENT_YEAR - 5 + i))

type ScanMode = 'scan' | 'manual'

const PROGRESS_STEPS = ['Uploading', 'AI Vision', 'Parsing', 'Complete']

export default function ScanPage() {
  const [mode, setMode] = useState<ScanMode>('scan')
  const { updateCurrentLog, setActiveTab, currentLog } = useStore()
  const { showToast } = useToast()

  // Scan mode state
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [progressStep, setProgressStep] = useState(-1)
  const [ocrResult, setOcrResult] = useState<OcrResult | null>(null)
  const [scanFields, setScanFields] = useState({
    brand: '', region: '', age: '', vintage: '', abv: '', bottler: 'OB', cask: ''
  })

  // Manual mode state
  const [brand, setBrand] = useState(currentLog.brand || '')
  const [region, setRegion] = useState(currentLog.region || '')
  const [bottler, setBottler] = useState(currentLog.bottler || 'OB')
  const [ibName, setIbName] = useState(currentLog.ib_name || '')
  const [age, setAge] = useState(currentLog.age || '')
  const [vintage, setVintage] = useState(currentLog.vintage || '')
  const [distilledDate, setDistilledDate] = useState(currentLog.distilled_date || '')
  const [bottledDate, setBottledDate] = useState(currentLog.bottled_date || '')
  const [abv, setAbv] = useState(currentLog.abv || '')
  const [caskStrengthActual, setCaskStrengthActual] = useState('')
  const [selectedCasks, setSelectedCasks] = useState<string[]>(currentLog.casks || [])
  const [additionalCask, setAdditionalCask] = useState('')
  const [caskNo, setCaskNo] = useState(currentLog.cask_no || '')
  const [bottles, setBottles] = useState(currentLog.bottles || '')

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    setImagePreview(url)
    setProgressStep(0)
    try {
      await new Promise(r => setTimeout(r, 400))
      setProgressStep(1)
      const result = await runOcr(file)
      setProgressStep(2)
      await new Promise(r => setTimeout(r, 300))
      setProgressStep(3)
      setOcrResult(result)
      setScanFields({
        brand: result.brand || '',
        region: result.region || '',
        age: result.age || '',
        vintage: result.vintage || '',
        abv: result.abv || '',
        bottler: result.bottler || 'OB',
        cask: result.cask || '',
      })
    } catch {
      showToast('OCR failed', 'err')
      setProgressStep(-1)
    }
  }, [showToast])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': [] },
    maxFiles: 1,
  })

  const handleScanNext = () => {
    updateCurrentLog({
      brand: scanFields.brand,
      region: scanFields.region,
      age: scanFields.age,
      vintage: scanFields.vintage,
      abv: scanFields.abv,
      bottler: scanFields.bottler,
      casks: scanFields.cask ? [scanFields.cask] : [],
    })
    setActiveTab('tasting')
  }

  const toggleCask = (cask: string) => {
    setSelectedCasks(prev =>
      prev.includes(cask) ? prev.filter(c => c !== cask) : [...prev, cask]
    )
  }

  const handleAbvChip = (chip: string) => {
    if (chip === 'Cask Strength') {
      setAbv('Cask Strength')
    } else {
      setAbv(chip.replace('%', ''))
    }
  }

  const handleManualNext = () => {
    const finalAbv = abv === 'Cask Strength' && caskStrengthActual
      ? `Cask Strength (${caskStrengthActual}%)`
      : abv

    const allCasks = [...selectedCasks]
    if (additionalCask.trim()) allCasks.push(additionalCask.trim())

    updateCurrentLog({
      brand,
      region,
      bottler,
      ib_name: bottler === 'IB' ? ibName : undefined,
      age,
      vintage,
      distilled_date: distilledDate,
      bottled_date: bottledDate,
      abv: finalAbv,
      casks: allCasks,
      cask_no: caskNo,
      bottles,
    })
    setActiveTab('tasting')
  }

  return (
    <div style={{ maxWidth: '680px', margin: '0 auto', padding: '2rem 1rem' }}>
      {/* Mode toggle */}
      <div style={{ display: 'flex', marginBottom: '1.5rem', border: '1px solid var(--bd)' }}>
        {(['scan', 'manual'] as ScanMode[]).map(m => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className="mono"
            style={{
              flex: 1,
              padding: '0.6rem',
              background: mode === m ? 'var(--gp)' : 'transparent',
              border: 'none',
              borderBottom: mode === m ? '2px solid var(--gold)' : '2px solid transparent',
              color: mode === m ? 'var(--gold)' : 'var(--tx2)',
              cursor: 'pointer',
              fontSize: '0.7rem',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              transition: 'all 0.2s',
            }}
          >
            {m === 'scan' ? 'Scan Label' : 'Manual Entry'}
          </button>
        ))}
      </div>

      {mode === 'scan' && (
        <div>
          {/* Dropzone */}
          <div
            {...getRootProps()}
            style={{
              border: `2px dashed ${isDragActive ? 'var(--gold)' : 'var(--bd2)'}`,
              padding: '3rem 1rem',
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s',
              background: isDragActive ? 'var(--gp)' : 'transparent',
              marginBottom: '1rem',
            }}
          >
            <input {...getInputProps()} />
            {imagePreview ? (
              <img src={imagePreview} alt="Preview" style={{ maxHeight: '200px', maxWidth: '100%', objectFit: 'contain' }} />
            ) : (
              <div>
                <p style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📷</p>
                <p className="mono" style={{ color: 'var(--tx2)', fontSize: '0.75rem' }}>
                  {isDragActive ? 'Drop image here' : 'Drag & drop or click to select whisky label'}
                </p>
              </div>
            )}
          </div>

          {/* Progress bar */}
          {progressStep >= 0 && (
            <div style={{ marginBottom: '1.5rem' }}>
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{ width: `${((progressStep + 1) / PROGRESS_STEPS.length) * 100}%` }}
                />
              </div>
              <p className="mono" style={{ fontSize: '0.7rem', color: 'var(--gold)', marginTop: '0.4rem' }}>
                {PROGRESS_STEPS[progressStep]}
                {progressStep < 3 && <span className="spinner" style={{ marginLeft: '0.5rem' }} />}
              </p>
            </div>
          )}

          {/* OCR result fields */}
          {ocrResult !== null && (
            <div>
              <div className="field-grid" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: '1.5rem' }}>
                {[
                  { label: 'Distillery', key: 'brand' as const, value: scanFields.brand, onChange: (v: string) => setScanFields(p => ({ ...p, brand: v })) },
                  { label: 'Region', key: 'region' as const, value: scanFields.region, onChange: (v: string) => setScanFields(p => ({ ...p, region: v })) },
                  { label: 'Age', key: 'age' as const, value: scanFields.age, onChange: (v: string) => setScanFields(p => ({ ...p, age: v })) },
                  { label: 'Vintage', key: 'vintage' as const, value: scanFields.vintage, onChange: (v: string) => setScanFields(p => ({ ...p, vintage: v })) },
                  { label: 'ABV', key: 'abv' as const, value: scanFields.abv, onChange: (v: string) => setScanFields(p => ({ ...p, abv: v })) },
                  { label: 'Bottler', key: 'bottler' as const, value: scanFields.bottler, onChange: (v: string) => setScanFields(p => ({ ...p, bottler: v })) },
                  { label: 'Cask', key: 'cask' as const, value: scanFields.cask, onChange: (v: string) => setScanFields(p => ({ ...p, cask: v })) },
                ].map(f => (
                  <div key={f.key} className="field-cell">
                    <p className="mono" style={{ fontSize: '0.6rem', color: 'var(--tx3)', marginBottom: '0.3rem', textTransform: 'uppercase' }}>{f.label}</p>
                    <input
                      type="text"
                      value={f.value}
                      onChange={e => f.onChange(e.target.value)}
                      placeholder="—"
                    />
                  </div>
                ))}
              </div>
              <button className="btn-gold" style={{ width: '100%' }} onClick={handleScanNext}>
                Next — Add Tasting Notes →
              </button>
            </div>
          )}
        </div>
      )}

      {mode === 'manual' && (
        <div>
          {/* Section 1: Distillery & Bottling */}
          <div className="section" style={{ marginBottom: '1px' }}>
            <div className="section-header">Distillery & Bottling</div>
            <div className="field-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <div className="field-cell" style={{ gridColumn: '1 / -1' }}>
                <p className="mono" style={{ fontSize: '0.6rem', color: 'var(--tx3)', marginBottom: '0.3rem', textTransform: 'uppercase' }}>Distillery / Brand</p>
                <input type="text" value={brand} onChange={e => setBrand(e.target.value)} placeholder="e.g. Glenfarclas" />
              </div>
              <div className="field-cell">
                <p className="mono" style={{ fontSize: '0.6rem', color: 'var(--tx3)', marginBottom: '0.3rem', textTransform: 'uppercase' }}>Region</p>
                <select value={region} onChange={e => setRegion(e.target.value)}>
                  <option value="">Select region</option>
                  {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="field-cell">
                <p className="mono" style={{ fontSize: '0.6rem', color: 'var(--tx3)', marginBottom: '0.3rem', textTransform: 'uppercase' }}>Bottler</p>
                <select value={bottler} onChange={e => setBottler(e.target.value)}>
                  <option value="OB">OB (Official Bottler)</option>
                  <option value="IB">IB (Independent Bottler)</option>
                </select>
              </div>
              {bottler === 'IB' && (
                <div className="field-cell" style={{ gridColumn: '1 / -1' }}>
                  <p className="mono" style={{ fontSize: '0.6rem', color: 'var(--tx3)', marginBottom: '0.3rem', textTransform: 'uppercase' }}>IB Name</p>
                  <input type="text" value={ibName} onChange={e => setIbName(e.target.value)} placeholder="e.g. Gordon & MacPhail" />
                </div>
              )}
            </div>
          </div>

          {/* Section 2: Age & Vintage */}
          <div className="section" style={{ marginBottom: '1px' }}>
            <div className="section-header">Age & Vintage</div>
            <div className="field-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <div className="field-cell">
                <p className="mono" style={{ fontSize: '0.6rem', color: 'var(--tx3)', marginBottom: '0.3rem', textTransform: 'uppercase' }}>Age Statement</p>
                <input type="text" value={age} onChange={e => setAge(e.target.value)} placeholder="e.g. 12" />
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginTop: '0.5rem' }}>
                  {AGE_CHIPS.map(c => (
                    <button key={c} className={`chip${age === c || age === c.replace('yr', '') ? ' active' : ''}`} onClick={() => setAge(c)}>
                      {c}
                    </button>
                  ))}
                </div>
              </div>
              <div className="field-cell">
                <p className="mono" style={{ fontSize: '0.6rem', color: 'var(--tx3)', marginBottom: '0.3rem', textTransform: 'uppercase' }}>Vintage Year</p>
                <input type="text" value={vintage} onChange={e => setVintage(e.target.value)} placeholder="e.g. 1995" />
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginTop: '0.5rem' }}>
                  {VINTAGE_CHIPS.map(c => (
                    <button key={c} className={`chip${vintage === c ? ' active' : ''}`} onClick={() => setVintage(c)}>
                      {c}
                    </button>
                  ))}
                </div>
              </div>
              <div className="field-cell">
                <p className="mono" style={{ fontSize: '0.6rem', color: 'var(--tx3)', marginBottom: '0.3rem', textTransform: 'uppercase' }}>Distilled Date</p>
                <input type="text" value={distilledDate} onChange={e => setDistilledDate(e.target.value)} placeholder="e.g. April 2005" />
              </div>
              <div className="field-cell">
                <p className="mono" style={{ fontSize: '0.6rem', color: 'var(--tx3)', marginBottom: '0.3rem', textTransform: 'uppercase' }}>Bottled Date</p>
                <input type="text" value={bottledDate} onChange={e => setBottledDate(e.target.value)} placeholder="e.g. March 2020" />
              </div>
            </div>
          </div>

          {/* Section 3: Strength */}
          <div className="section" style={{ marginBottom: '1px' }}>
            <div className="section-header">Strength</div>
            <div className="field-cell">
              <p className="mono" style={{ fontSize: '0.6rem', color: 'var(--tx3)', marginBottom: '0.3rem', textTransform: 'uppercase' }}>ABV (%)</p>
              <input
                type="text"
                value={abv}
                onChange={e => setAbv(e.target.value)}
                placeholder="e.g. 46.0"
              />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginTop: '0.5rem' }}>
                {ABV_CHIPS.map(c => (
                  <button
                    key={c}
                    className={`chip${(c === 'Cask Strength' && abv.startsWith('Cask Strength')) || abv === c.replace('%', '') ? ' active' : ''}`}
                    onClick={() => handleAbvChip(c)}
                  >
                    {c}
                  </button>
                ))}
              </div>
              {abv === 'Cask Strength' && (
                <div style={{ marginTop: '0.75rem' }}>
                  <p className="mono" style={{ fontSize: '0.6rem', color: 'var(--tx3)', marginBottom: '0.3rem' }}>Actual Cask Strength ABV</p>
                  <input
                    type="number"
                    value={caskStrengthActual}
                    onChange={e => setCaskStrengthActual(e.target.value)}
                    placeholder="e.g. 63.2"
                    step="0.1"
                  />
                  {caskStrengthActual && (
                    <p className="mono" style={{ fontSize: '0.65rem', color: 'var(--gold)', marginTop: '0.3rem' }}>
                      → Cask Strength ({caskStrengthActual}%)
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Section 4: Cask & Maturation */}
          <div className="section" style={{ marginBottom: '1.5rem' }}>
            <div className="section-header">Cask & Maturation</div>
            <div className="field-cell">
              <p className="mono" style={{ fontSize: '0.6rem', color: 'var(--tx3)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Cask Types</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.75rem' }}>
                {CASK_TYPES.map(c => (
                  <button
                    key={c}
                    className={`chip${selectedCasks.includes(c) ? ' active' : ''}`}
                    onClick={() => toggleCask(c)}
                  >
                    {c}
                  </button>
                ))}
              </div>
              <div style={{ borderTop: '1px solid var(--bd)', paddingTop: '0.75rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px', background: 'var(--bd)', marginTop: '0.5rem' }}>
                <div style={{ background: 'var(--c2)', padding: '0.5rem' }}>
                  <p className="mono" style={{ fontSize: '0.6rem', color: 'var(--tx3)', marginBottom: '0.3rem' }}>Additional Cask</p>
                  <input type="text" value={additionalCask} onChange={e => setAdditionalCask(e.target.value)} placeholder="e.g. Armagnac" />
                </div>
                <div style={{ background: 'var(--c2)', padding: '0.5rem' }}>
                  <p className="mono" style={{ fontSize: '0.6rem', color: 'var(--tx3)', marginBottom: '0.3rem' }}>Cask No.</p>
                  <input type="text" value={caskNo} onChange={e => setCaskNo(e.target.value)} placeholder="e.g. #1234" />
                </div>
                <div style={{ background: 'var(--c2)', padding: '0.5rem', gridColumn: '1 / -1' }}>
                  <p className="mono" style={{ fontSize: '0.6rem', color: 'var(--tx3)', marginBottom: '0.3rem' }}>Total Bottles</p>
                  <input type="text" value={bottles} onChange={e => setBottles(e.target.value)} placeholder="e.g. 284" />
                </div>
              </div>
            </div>
          </div>

          <button className="btn-gold" style={{ width: '100%' }} onClick={handleManualNext}>
            Next →
          </button>
        </div>
      )}
    </div>
  )
}
