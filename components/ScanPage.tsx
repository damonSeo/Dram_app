'use client'
import { useState, useRef, useCallback } from 'react'
import { useStore } from '@/lib/store'
import { useToast } from '@/components/Toast'
import { compressImageToDataUrl, shrinkDataUrl } from '@/lib/imageUtils'
import type { OcrResult, WhiskyLog } from '@/types'

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
  const { updateCurrentLog, resetCurrentLog, loadLog, setActiveTab, collection } = useStore()
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

  // Search state
  interface SearchResult { title: string; link: string; snippet?: string; source?: string; price?: string; imageUrl?: string }
  interface SearchData { shopping?: SearchResult[]; organic?: SearchResult[]; fallback?: boolean; googleUrl?: string; lensUrl?: string }
  const [searchData, setSearchData] = useState<SearchData | null>(null)
  const [searching, setSearching] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)

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
  const [manualPhoto, setManualPhoto] = useState<string | null>(null)
  const manualFileRef = useRef<HTMLInputElement>(null)

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
    setSearchData(null)
    setSearchOpen(false)
    try {
      const form = new FormData()
      form.append('image', scanFile)
      setProgress(15); setProgLabel('Uploading...')
      const res = await fetch('/api/ocr', { method: 'POST', body: form })
      setProgress(50); setProgLabel('AI Vision 분석 중...')
      const json = await res.json() as { data?: OcrResult; error?: string }
      if (!res.ok) throw new Error(json.error || `OCR 실패 (${res.status})`)
      setProgress(85); setProgLabel('결과 정리 중...')
      const d: OcrResult = json.data || {}
      const hasAny = Object.values(d).some((v) => v && String(v).trim() !== '')
      setScanFields({
        brand: d.brand || '', region: d.region || '', age: d.age || '',
        vintage: d.vintage || '', abv: d.abv || '', bottler: d.bottler || '', cask: d.cask || '',
      })
      setProgress(100); setProgLabel('완료')
      setScanDone(true)
      if (hasAny) showToast('라벨 인식 완료!', 'ok')
      else showToast('인식된 정보가 없습니다. 수동으로 입력해주세요.', 'err')
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'OCR 실패', 'err')
    } finally {
      setScanning(false)
    }
  }

  const runSearch = async () => {
    const q = [scanFields.brand, scanFields.age].filter(Boolean).join(' ')
    if (!q.trim()) { showToast('브랜드 정보가 없습니다', 'err'); return }
    setSearching(true)
    setSearchOpen(true)
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`)
      const data = await res.json() as SearchData
      setSearchData(data)
    } catch {
      showToast('검색 실패', 'err')
      setSearchOpen(false)
    } finally {
      setSearching(false)
    }
  }

  const goToTasting = async (fields: Record<string, string | string[]>, photo?: string | null) => {
    const imgCompressed = photo ? await shrinkDataUrl(photo, 600, 0.7).catch(() => photo) : ''
    // 기존 currentLog(id, nose, palate 등)를 완전히 초기화하고 새 노트로 시작
    resetCurrentLog()
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
      image_url: imgCompressed || undefined,
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
    <div className="m-page" style={S.wrapper}>
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
            className="m-dropzone"
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
              <div className="m-grid-collapse" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1px', background:'var(--bd)', marginBottom:'1px' }}>
                {([['Distillery','brand'],['Region','region'],['Age','age'],['Vintage','vintage'],['ABV','abv'],['Bottler','bottler'],['Cask','cask']] as [string, keyof ScanFields][]).map(([label, key]) => (
                  <div key={key} style={S.cell}>
                    <p style={S.label}>{label}</p>
                    <input type="text" value={scanFields[key]}
                      onChange={(e) => setScanFields((p) => ({ ...p, [key]: e.target.value }))} />
                  </div>
                ))}
              </div>

              {/* 버튼 행 */}
              <div style={{ display:'flex', gap:'1px', marginBottom:'1px' }}>
                <button className="btn-gold" style={{ flex:1, justifyContent:'center' }}
                  onClick={() => goToTasting({ ...scanFields, casks: scanFields.cask ? [scanFields.cask] : [] }, preview)}>
                  Next — Add Tasting Notes →
                </button>
                <button className="btn-outline-gold" style={{ whiteSpace:'nowrap', justifyContent:'center' }}
                  onClick={runSearch} disabled={searching}>
                  {searching ? <span className="spinner" /> : '🔍'} 유사 바틀 검색
                </button>
              </div>

              {/* 검색 결과 패널 */}
              {searchOpen && (
                <div className="fade-up" style={{ border:'1px solid var(--bd)', background:'var(--c2)', marginBottom:'1px' }}>
                  <div style={{ padding:'0.6rem 1rem', borderBottom:'1px solid var(--bd)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <p className="mono" style={{ fontSize:'0.65rem', color:'var(--gold)', letterSpacing:'0.1em' }}>
                      🔍 {scanFields.brand} {scanFields.age} 검색 결과
                    </p>
                    <button onClick={() => setSearchOpen(false)}
                      style={{ background:'none', border:'none', color:'var(--tx3)', cursor:'pointer', fontSize:'0.9rem' }}>✕</button>
                  </div>

                  {searching && (
                    <div style={{ display:'flex', alignItems:'center', gap:'0.75rem', padding:'1rem' }}>
                      <span className="spinner" />
                      <span className="mono" style={{ fontSize:'0.72rem', color:'var(--tx2)' }}>Google 검색 중...</span>
                    </div>
                  )}

                  {!searching && searchData && (
                    <div style={{ padding:'0.75rem 1rem' }}>
                      {/* Fallback: no API key */}
                      {searchData.fallback && (
                        <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem' }}>
                          <p className="mono" style={{ fontSize:'0.65rem', color:'var(--tx2)', marginBottom:'0.5rem' }}>
                            브라우저에서 직접 검색하시겠어요?
                          </p>
                          <a href={searchData.googleUrl} target="_blank" rel="noopener noreferrer"
                            style={{ display:'flex', alignItems:'center', gap:'0.5rem', padding:'0.6rem 0.9rem', border:'1px solid var(--bd)', color:'var(--tx)', textDecoration:'none', fontSize:'0.8rem', background:'var(--c3)' }}>
                            🛒 Google Shopping 검색 →
                          </a>
                          <a href={searchData.lensUrl} target="_blank" rel="noopener noreferrer"
                            style={{ display:'flex', alignItems:'center', gap:'0.5rem', padding:'0.6rem 0.9rem', border:'1px solid var(--bd)', color:'var(--tx)', textDecoration:'none', fontSize:'0.8rem', background:'var(--c3)' }}>
                            🔎 Google 웹 검색 →
                          </a>
                        </div>
                      )}

                      {/* Shopping results */}
                      {searchData.shopping && searchData.shopping.length > 0 && (
                        <div style={{ marginBottom:'1rem' }}>
                          <p className="mono" style={{ fontSize:'0.6rem', color:'var(--tx3)', letterSpacing:'0.08em', marginBottom:'0.6rem', textTransform:'uppercase' }}>🛒 구매처</p>
                          <div style={{ display:'flex', flexDirection:'column', gap:'1px' }}>
                            {searchData.shopping.map((r, i) => (
                              <a key={i} href={r.link} target="_blank" rel="noopener noreferrer"
                                style={{ display:'flex', alignItems:'center', gap:'0.75rem', padding:'0.6rem 0.75rem', background:'var(--c3)', textDecoration:'none', transition:'background 0.15s' }}
                                onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = 'var(--c4)' }}
                                onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = 'var(--c3)' }}>
                                {r.imageUrl && (
                                  <img src={r.imageUrl} alt="" style={{ width:44, height:44, objectFit:'contain', flexShrink:0, background:'#fff', padding:'2px' }} />
                                )}
                                <div style={{ flex:1, minWidth:0 }}>
                                  <p style={{ fontSize:'0.78rem', color:'var(--tx)', lineHeight:1.4, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.title}</p>
                                  <p className="mono" style={{ fontSize:'0.62rem', color:'var(--tx2)', marginTop:'0.2rem' }}>{r.source}</p>
                                </div>
                                {r.price && (
                                  <span className="mono" style={{ fontSize:'0.75rem', color:'var(--gold)', flexShrink:0 }}>{r.price}</span>
                                )}
                              </a>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Organic results */}
                      {searchData.organic && searchData.organic.length > 0 && (
                        <div>
                          <p className="mono" style={{ fontSize:'0.6rem', color:'var(--tx3)', letterSpacing:'0.08em', marginBottom:'0.6rem', textTransform:'uppercase' }}>📰 리뷰 & 정보</p>
                          <div style={{ display:'flex', flexDirection:'column', gap:'1px' }}>
                            {searchData.organic.map((r, i) => (
                              <a key={i} href={r.link} target="_blank" rel="noopener noreferrer"
                                style={{ display:'block', padding:'0.6rem 0.75rem', background:'var(--c3)', textDecoration:'none', transition:'background 0.15s' }}
                                onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = 'var(--c4)' }}
                                onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = 'var(--c3)' }}>
                                <p style={{ fontSize:'0.78rem', color:'var(--tx)', lineHeight:1.4, marginBottom:'0.2rem' }}>{r.title}</p>
                                {r.snippet && <p style={{ fontSize:'0.7rem', color:'var(--tx2)', lineHeight:1.5, overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' }}>{r.snippet}</p>}
                                <p className="mono" style={{ fontSize:'0.58rem', color:'var(--gold)', marginTop:'0.25rem' }}>{r.source}</p>
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
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
              <div className="m-grid-collapse" style={S.row}>
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
              <div className="m-grid-collapse" style={S.row}>
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
              <div className="m-grid-collapse" style={S.row}>
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
              <div className="m-grid-collapse" style={S.row}>
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
              <div className="m-grid-collapse" style={{ ...S.row, marginTop:'1rem' }}>
                <div style={S.cell}>
                  <p style={S.label}>Custom Cask</p>
                  <input type="text" value={customCask} onChange={(e) => setCustomCask(e.target.value)} placeholder="Custom cask type" />
                </div>
                <div style={S.cell}>
                  <p style={S.label}>Cask No.</p>
                  <input type="text" value={caskNo} onChange={(e) => setCaskNo(e.target.value)} placeholder="e.g. #1234" />
                </div>
              </div>
              <div className="m-grid-collapse" style={S.row}>
                <div style={S.cell}>
                  <p style={S.label}>Total Bottles</p>
                  <input type="text" value={bottles} onChange={(e) => setBottles(e.target.value)} placeholder="e.g. 285 bottles" />
                </div>
              </div>
            </div>
          </div>

          {/* Section 5 — 라벨 사진 */}
          <div style={S.section}>
            <div style={S.hdr}>Label Photo</div>
            <div style={S.body}>
              <input ref={manualFileRef} type="file" accept="image/*" style={{ display: 'none' }}
                onChange={async (e) => {
                  const f = e.target.files?.[0]
                  if (!f) return
                  try {
                    const data = await compressImageToDataUrl(f, 800, 0.75)
                    setManualPhoto(data)
                  } catch { showToast('이미지 처리 실패', 'err') }
                }} />
              {manualPhoto ? (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                  <img src={manualPhoto} alt="label" style={{ width: 140, height: 140, objectFit: 'cover', border: '1px solid var(--bd)' }} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <button className="btn-ghost" style={{ fontSize: '0.7rem' }} onClick={() => manualFileRef.current?.click()}>사진 변경</button>
                    <button className="btn-ghost" style={{ fontSize: '0.7rem', color: '#cf7e7e' }} onClick={() => setManualPhoto(null)}>제거</button>
                  </div>
                </div>
              ) : (
                <button className="btn-outline-gold" style={{ width: '100%', justifyContent: 'center' }} onClick={() => manualFileRef.current?.click()}>
                  📷 라벨 사진 업로드
                </button>
              )}
            </div>
          </div>

          <button className="btn-gold" style={{ width:'100%', justifyContent:'center', marginTop:'0.5rem' }}
            onClick={() => {
              const allCasks = [...selectedCasks, ...(customCask ? [customCask] : [])]
              goToTasting({ brand, region, bottler, ib_name: ibName, age, vintage, distilled_date: distilledDate, bottled_date: bottledDate, abv: getAbvDisplay(), casks: allCasks, cask_no: caskNo, bottles }, manualPhoto)
            }}>
            Next — Add Tasting Notes →
          </button>
        </div>
      )}

      {/* ── 최근 저장한 노트 ── */}
      {collection.length > 0 && (
        <div style={{ marginTop: '2.5rem', borderTop: '1px solid var(--bd)', paddingTop: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '1rem' }}>
            <p className="mono" style={{ fontSize: '0.7rem', color: 'var(--tx2)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              ◈ 최근 저장한 노트
            </p>
            <button className="btn-ghost" style={{ fontSize: '0.7rem' }} onClick={() => setActiveTab('collection')}>
              전체 보기 →
            </button>
          </div>
          <div className="m-recent-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1px', background: 'var(--bd)' }}>
            {collection.slice(0, 6).map((log: WhiskyLog) => (
              <div key={log.id}
                onClick={() => { loadLog({ ...log }); setActiveTab('share') }}
                style={{ background: 'var(--c2)', cursor: 'pointer', display: 'flex', gap: '0.6rem', padding: '0.6rem', alignItems: 'center' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'var(--c3)' }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'var(--c2)' }}>
                {log.image_url ? (
                  <img src={log.image_url} alt="" style={{ width: 46, height: 46, objectFit: 'cover', flexShrink: 0, border: '1px solid var(--bd)' }} />
                ) : (
                  <div style={{ width: 46, height: 46, background: 'var(--c3)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--tx3)', fontSize: '1rem' }}>🥃</div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p className="mono" style={{ fontSize: '0.55rem', color: 'var(--gold)', letterSpacing: '0.08em', marginBottom: '0.1rem', textTransform: 'lowercase' }}>
                    {log.region || '—'}
                  </p>
                  <p className="display" style={{ fontSize: '0.92rem', color: 'var(--tx)', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {log.brand || '—'}
                  </p>
                  <p className="mono" style={{ fontSize: '0.6rem', color: 'var(--tx2)', marginTop: '0.1rem' }}>
                    {[log.age, log.abv].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <span className="display" style={{ fontSize: '0.9rem', color: 'var(--gold)', flexShrink: 0 }}>
                  ★ {log.score?.toFixed(1)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
