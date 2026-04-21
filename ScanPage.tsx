'use client'
import { useState, useRef, useCallback } from 'react'
import { useStore } from '@/lib/store'
import { useToast } from '@/components/Toast'
import type { OcrResult } from '@/types'

const REGIONS = ['Speyside','Islay','Highland','Lowland','Campbeltown','Island','Irish','Japanese','American','Taiwanese','Indian','Other']
const CASK_TYPES = ['Ex-Bourbon','Hogshead','Oloroso Sherry','Pedro Ximénez','Port','Rum','Madeira','Sauternes','Virgin Oak','American Oak','European Oak','STR','Wine','Mizunara']
const AGE_CHIPS = ['NAS','8yr','10yr','12yr','15yr','18yr','21yr','25yr','30yr']
const ABV_CHIPS = ['40%','43%','46%','48%','51.7%','55%','58%','Cask Strength']
const CY = new Date().getFullYear()
const VINTAGE_CHIPS = [CY-4, CY-8, CY-12, CY-18, CY-22, CY-27].map(String)

type Mode = 'scan' | 'manual'

interface ScanFields {
  brand: string; region: string; age: string; vintage: string
  abv: string; bottler: string; cask: string
}

const S = {
  wrapper: { maxWidth: 720, margin: '0 auto', padding: '2rem 1.5rem' } as React.CSSProperties,
  section: { border: '1px solid var(--bd)', background: 'var(--c2)', marginBottom: '1px' } as React.CSSProperties,
  hdr: { padding: '0.6rem 1rem', borderBottom: '1px solid var(--bd)', fontFamily: 'DM Mono, monospace', fontSize: '0.65rem', letterSpacing: '0.1em', color: 'var(--tx2)', textTransform: 'uppercase' as const },
  body: { padding: '1rem' } as React.CSSProperties,
  row: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px', background: 'var(--bd)', marginBottom: '1px' } as React.CSSProperties,
  cell: { background: 'var(--c2)', padding: '0.75rem' } as React.CSSProperties,
  label: { fontFamily: 'DM Mono, monospace', fontSize: '0.6rem', color: 'var(--tx3)', letterSpacing: '0.08em', marginBottom: '0.35rem', textTransform: 'uppercase' as const },
  chips: { display: 'flex', flexWrap: 'wrap' as const, gap: '0.35rem', marginTop: '0.5rem' },
}

export default function ScanPage() {
  const { updateCurrentLog, setActiveTab } = useStore()
  const { showToast } = useToast()
  const [mode, setMode] = useState<Mode>('scan')

  // Scan state
  const [preview, setPreview] = useState<string | null>(null)
  const [scanFile, setScanFile] = useState<File | null>(null)
  const [scanFields, setScanFields] = useState<ScanFields>({ brand:'',region:'',age:'',vintage:'',abv:'',bottler:'',cask:'' })
  const [progress, setProgress] = useState(0)
  const [progLabel, setProgLabel] = useState('')
  const [scanning, setScanning] = useState(false)
  const [scanDone, setScanDone] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Manual state
  const [brand, setBrand] = useState('')
  const [region, setRegion] = useState('')
  const [bottler, setBottler] = useState<'OB'|'IB'>('OB')
  const [ibName, setIbName] = useState('')
  const [age, setAge] = useState('')
  const [vintage, setVintage] = useState('')
  const [distilledDate, setDistilledDate] = useState('')
  const [bottledDate, setBottledDate] = useState('')
  const [abvRaw, setAbvRaw] = useState('')
  const [isCaskStrength, setIsCaskStrength] = useState(false)
  const [csAbv, setCsAbv] = useState('')
  const [selectedCasks, setSelectedCasks] = useState<string[]>([])
  const [customCask, setCustomCask] = useState('')
  const [caskNo, setCaskNo] = useState('')
  const [bottles, setBottles] = useState('')

  const handleFile = useCallback((file: File) => {
    setScanFile(file)
    setScanDone(false)
    setScanFields({ brand:'',region:'',age:'',vintage:'',abv:'',bottler:'',cask:'' })
    const reader = new FileReader()
    reader.onload = (e) => setPreview(e.target?.result as string)
    reader.readAsDataURL(file)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file && file.type.startsWith('image/')) handleFile(file)
  }, [handleFile])

  const runOcr = async () => {
    if (!scanFile) return
    setScanning(true)
    setScanDone(false)
    try {
      const form = new FormData()
      form.append('image', scanFile)
      setProgress(20); setProgLabel('Uploading...')
      const res = await fetch('/api/ocr', { method: 'POST', body: form })
      setProgress(55); setProgLabel('AI Vision analyzing...')
      const json = await res.json()
      setProgress(85); setProgLabel('Parsing results...')
      const d: OcrResult = json.data || {}
      setScanFields({
        brand: d.brand || '', region: d.region || '', age: d.age || '',
        vintage: d.vintage || '', abv: d.abv || '', bottler: d.bottler || '', cask: d.cask || '',
      })
      setProgress(100); setProgLabel('Complete')
      setScanDone(true)
      showToast('OCR 완료!', 'ok')
    } catch {
      showToast('OCR 실패', 'err')
    } finally {
      setScanning(false)
    }
  }

  const goToTasting = (fields: Record<string, string | string[]>) => {
    updateCurrentLog({
      brand: (fields.brand as string) || '',
      region: (fields.region as string) || '',
      age: (fields.age as string) || '',
      vintage: (fields.vintage as string) || '',
      abv: (fields.abv as string) || '',
      bottler: (fields.bottler as string) || '',
      ib_name: (fields.ib_name as string) || '',
      casks: (fields.casks as string[]) || [],
      cask_no: (fields.cask_no as string) || '',
      bottles: (fields.bottles as string) || '',
      distilled_date: (fields.distilled_date as string) || '',
      bottled_date: (fields.bottled_date as string) || '',
      date: new Date().toISOString().split('T')[0],
    })
    setActiveTab('tasting')
  }

  const toggleCask = (c: string) =>
    setSelectedCasks((prev) => prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c])

  const getAbvDisplay = () => {
    if (isCaskStrength) return csAbv ? `Cask Strength (${csAbv}%)` : 'Cask Strength'
    return abvRaw
  }

  return (
    <div style={S.wrapper}>
      {/* Mode toggle */}
      <div style={{ display:'flex', gap:'1px', marginBottom:'1.5rem', background:'var(--bd)' }}>
        {(['scan','manual'] as Mode[]).map((m) => (
          <button key={m} onClick={() => setMode(m)} className="mono" style={{
            flex:1, padding:'0.6rem', border:'none', cursor:'pointer',
            background: mode===m ? 'var(--gp)' : 'var(--c2)',
            color: mode===m ? 'var(--gold)' : 'var(--tx2)',
            fontSize:'0.72rem', letterSpacing:'0.08em', textTransform:'uppercase',
            borderBottom: mode===m ? '1px solid var(--gold)' : '1px solid transparent',
          }}>
            {m==='scan' ? '⬡ Scan Label' : '✎ Manual Entry'}
          </button>
        ))}
      </div>

      {/* ── SCAN MODE ── */}
      {mode === 'scan' && (
        <div className="fade-up">
          <div
            onClick={() => fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            style={{
              border: `1px dashed ${dragOver ? 'var(--gold)' : 'var(--bd2)'}`,
              background: dragOver ? 'var(--gp)' : 'var(--c2)',
              padding: '2.5rem 1.5rem', textAlign:'center',
              cursor:'pointer', transition:'all 0.2s', marginBottom:'1px',
            }}
          >
            <input ref={fileInputRef} type="file" accept="image/*" style={{display:'none'}}
              onChange={(e) => { const f=e.target.files?.[0]; if(f) handleFile(f) }} />
            {preview ? (
              <img src={preview} alt="preview" style={{ maxHeight:200, maxWidth:'100%', objectFit:'contain', margin:'0 auto', display:'block' }} />
            ) : (
              <>
                <p className="display" style={{ fontSize:'2.5rem', color:'var(--bd2)', marginBottom:'0.5rem' }}>⬡</p>
                <p className="mono" style={{ fontSize:'0.72rem', color:'var(--tx2)' }}>Drop image or click to upload</p>
                <p style={{ fontSize:'0.7rem', color:'var(--tx3)', marginTop:'0.25rem' }}>JPG · PNG · WEBP</p>
              </>
            )}
          </div>

          {preview && !scanning && !scanDone && (
            <button className="btn-gold" style={{ width:'100%', justifyContent:'center', marginBottom:'1px' }} onClick={runOcr}>
              ✦ Analyze Label
            </button>
          )}

          {scanning && (
            <div style={{ border:'1px solid var(--bd)', background:'var(--c2)', padding:'1rem', marginBottom:'1px' }}>
              <div style={{ display:'flex', alignItems:'center', gap:'0.75rem', marginBottom:'0.6rem' }}>
                <span className="spinner" />
                <span className="mono" style={{ fontSize:'0.72rem', color:'var(--gold)' }}>{progLabel}</span>
              </div>
              <div style={{ height:2, background:'var(--bd)', overflow:'hidden' }}>
                <div style={{ height:'100%', width:`${progress}%`, background:'var(--gold)', transition:'width 0.4s ease' }} />
              </div>
            </div>
          )}

          {scanDone && (
            <div className="fade-up">
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1px', background:'var(--bd)', marginBottom:'1px' }}>
                {([['Distillery','brand'],['Region','region'],['Age','age'],['Vintage','vintage'],['ABV','abv'],['Bottler','bottler'],['Cask','cask']] as [string, keyof ScanFields][]).map(([label, key]) => (
                  <div key={key} style={S.cell}>
                    <p style={S.label}>{label}</p>
                    <input type="text" value={scanFields[key]}
                      onChange={(e) => setScanFields((p) => ({ ...p, [key]: e.target.value }))} />
                  </div>
                ))}
              </div>
              <button className="btn-gold" style={{ width:'100%', justifyContent:'center' }}
                onClick={() => goToTasting({ ...scanFields, casks: scanFields.cask ? [scanFields.cask] : [] })}>
                Next — Add Tasting Notes →
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── MANUAL MODE ── */}
      {mode === 'manual' && (
        <div className="fade-up">
          {/* Section 1 */}
          <div style={S.section}>
            <div style={S.hdr}>Distillery &amp; Bottling</div>
            <div style={S.body}>
              <div style={S.row}>
                <div style={S.cell}>
                  <p style={S.label}>Distillery / Brand</p>
                  <input type="text" value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="e.g. Glenfarclas" />
                </div>
                <div style={S.cell}>
                  <p style={S.label}>Region</p>
                  <select value={region} onChange={(e) => setRegion(e.target.value)}>
                    <option value="">Select region</option>
                    {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              </div>
              <div style={S.row}>
                <div style={S.cell}>
                  <p style={S.label}>Bottler</p>
                  <select value={bottler} onChange={(e) => setBottler(e.target.value as 'OB'|'IB')}>
                    <option value="OB">OB (Official)</option>
                    <option value="IB">IB (Independent)</option>
                  </select>
                </div>
                <div style={S.cell}>
                  <p style={S.label}>IB Name</p>
                  <input type="text" value={ibName} onChange={(e) => setIbName(e.target.value)}
                    placeholder={bottler==='IB' ? 'e.g. Gordon & MacPhail' : '(OB selected)'}
                    disabled={bottler!=='IB'} style={{ opacity: bottler==='IB' ? 1 : 0.3 }} />
                </div>
              </div>
            </div>
          </div>

          {/* Section 2 */}
          <div style={S.section}>
            <div style={S.hdr}>Age &amp; Vintage</div>
            <div style={S.body}>
              <div style={S.row}>
                <div style={S.cell}>
                  <p style={S.label}>Age Statement</p>
                  <input type="text" value={age} onChange={(e) => setAge(e.target.value)} placeholder="e.g. 12yr or NAS" />
                  <div style={S.chips}>
                    {AGE_CHIPS.map((c) => (
                      <button key={c} className={`chip${age===c?' active':''}`} onClick={() => setAge(age===c?'':c)}>{c}</button>
                    ))}
                  </div>
                </div>
                <div style={S.cell}>
                  <p style={S.label}>Vintage Year</p>
                  <input type="text" value={vintage} onChange={(e) => setVintage(e.target.value)} placeholder="e.g. 2005" />
                  <div style={S.chips}>
                    {VINTAGE_CHIPS.map((y) => (
                      <button key={y} className={`chip${vintage===y?' active':''}`} onClick={() => setVintage(vintage===y?'':y)}>{y}</button>
                    ))}
                  </div>
                </div>
              </div>
              <div style={S.row}>
                <div style={S.cell}>
                  <p style={S.label}>Distilled Date</p>
                  <input type="text" value={distilledDate} onChange={(e) => setDistilledDate(e.target.value)} placeholder="e.g. Nov 1995" />
                </div>
                <div style={S.cell}>
                  <p style={S.label}>Bottled Date</p>
                  <input type="text" value={bottledDate} onChange={(e) => setBottledDate(e.target.value)} placeholder="e.g. Mar 2023" />
                </div>
              </div>
            </div>
          </div>

          {/* Section 3 */}
          <div style={S.section}>
            <div style={S.hdr}>Strength (ABV)</div>
            <div style={S.body}>
              <div style={S.cell}>
                <p style={S.label}>ABV</p>
                <input type="text"
                  value={isCaskStrength ? csAbv : abvRaw}
                  onChange={(e) => isCaskStrength ? setCsAbv(e.target.value.replace('%','')) : setAbvRaw(e.target.value)}
                  onBlur={(e) => {
                    if (!isCaskStrength) {
                      const v = parseFloat(e.target.value)
                      if (!isNaN(v) && v >= 10) setAbvRaw(`${v}%`)
                    }
                  }}
                  placeholder={isCaskStrength ? 'actual ABV e.g. 63.2' : 'e.g. 46%'} />
                <div style={S.chips}>
                  {ABV_CHIPS.map((c) => {
                    const isCS = c==='Cask Strength'
                    const isActive = isCS ? isCaskStrength : abvRaw===c
                    return (
                      <button key={c} className={`chip${isActive?' active':''}`} onClick={() => {
                        if (isCS) { setIsCaskStrength(!isCaskStrength); setAbvRaw('') }
                        else { setAbvRaw(abvRaw===c?'':c); setIsCaskStrength(false) }
                      }}>{c}</button>
                    )
                  })}
                </div>
                {isCaskStrength && csAbv && (
                  <p className="mono" style={{ fontSize:'0.7rem', color:'var(--gold)', marginTop:'0.5rem' }}>
                    → Cask Strength ({csAbv}%)
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Section 4 */}
          <div style={S.section}>
            <div style={S.hdr}>Cask &amp; Maturation</div>
            <div style={S.body}>
              <p style={S.label}>Cask Types</p>
              <div style={S.chips}>
                {CASK_TYPES.map((c) => (
                  <button key={c} className={`chip${selectedCasks.includes(c)?' active':''}`} onClick={() => toggleCask(c)}>{c}</button>
                ))}
              </div>
              <div style={{ ...S.row, marginTop:'1rem' }}>
                <div style={S.cell}>
                  <p style={S.label}>Custom Cask</p>
                  <input type="text" value={customCask} onChange={(e) => setCustomCask(e.target.value)} placeholder="Custom cask type" />
                </div>
                <div style={S.cell}>
                  <p style={S.label}>Cask No.</p>
                  <input type="text" value={caskNo} onChange={(e) => setCaskNo(e.target.value)} placeholder="e.g. #1234" />
                </div>
              </div>
              <div style={S.row}>
                <div style={S.cell}>
                  <p style={S.label}>Total Bottles</p>
                  <input type="text" value={bottles} onChange={(e) => setBottles(e.target.value)} placeholder="e.g. 285 bottles" />
                </div>
              </div>
            </div>
          </div>

          <button className="btn-gold" style={{ width:'100%', justifyContent:'center', marginTop:'0.5rem' }}
            onClick={() => {
              const allCasks = [...selectedCasks, ...(customCask ? [customCask] : [])]
              goToTasting({ brand, region, bottler, ib_name: ibName, age, vintage, distilled_date: distilledDate, bottled_date: bottledDate, abv: getAbvDisplay(), casks: allCasks, cask_no: caskNo, bottles })
            }}>
            Next — Add Tasting Notes →
          </button>
        </div>
      )}
    </div>
  )
}
