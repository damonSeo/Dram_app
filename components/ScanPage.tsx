'use client'
import { useState, useRef, useCallback, useEffect } from 'react'
import { useStore } from '@/lib/store'
import { useToast } from '@/components/Toast'
import { compressImageToDataUrl, shrinkDataUrl } from '@/lib/imageUtils'
import type { OcrResult, SpiritType } from '@/types'

/* ── constants ─────────────────────────────────────────────────────────────── */

const REGIONS_WHISKY = ['Speyside','Islay','Highland','Lowland','Campbeltown','Island','Irish','Japanese','American','Taiwanese','Indian','Other']
const CASK_TYPES     = ['Ex-Bourbon','Hogshead','Oloroso Sherry','Pedro Ximénez','Port','Rum','Madeira','Sauternes','Virgin Oak','American Oak','European Oak','STR','Wine','Mizunara']
const AGE_CHIPS      = ['NAS','8yr','10yr','12yr','15yr','18yr','21yr','25yr','30yr']
const ABV_CHIPS      = ['40%','43%','46%','48%','51.7%','55%','58%','Cask Strength']
const VINTAGE_CHIPS  = [2022,2018,2014,2008,2004,1999].map(String)

const STATES_BOURBON = ['Kentucky','Tennessee','Indiana','Texas','New York','Colorado','Other']
const AGE_BOURBON    = ['NAS','2yr','4yr','6yr','8yr','10yr','12yr','15yr','20yr']
const PROOF_CHIPS    = ['80','86.6','90','94','100','107','114','120+','Cask Strength']
const MASHBILL_CHIPS = ['High Corn (≥75%)','High Rye (>18%)','Wheated','Four Grain','Single Malt']
const BARREL_CHIPS   = ['New Charred Oak','Char #2','Char #3','Char #4','STR','Toasted']

const REGIONS_COGNAC  = ['Grande Champagne','Petite Champagne','Fine Champagne','Borderies','Fins Bois','Bons Bois','Bois à Terroir']
const AGE_COGNAC      = ['VS (2yr+)','VSOP (4yr+)','Napoléon (6yr+)','XO (10yr+)','XXO (14yr+)','Hors d\'âge','Extra','Vintage']
const GRAPE_COGNAC    = ['Ugni Blanc','Colombard','Folle Blanche','Montils','Sémillon']
const ABV_COGNAC      = ['40%','42%','43%','45%','46%','50%']

/* ── styles ─────────────────────────────────────────────────────────────────── */

const S = {
  wrapper: { maxWidth: 760, margin: '0 auto', padding: '2rem 1.5rem' } as React.CSSProperties,
  section: { border: '1px solid var(--bd)', background: 'var(--c2)', marginBottom: '1px' } as React.CSSProperties,
  hdr: { padding: '0.6rem 1rem', borderBottom: '1px solid var(--bd)', fontFamily: 'DM Mono, monospace', fontSize: '0.65rem', letterSpacing: '0.1em', color: 'var(--tx2)', textTransform: 'uppercase' as const },
  body: { padding: '1rem' } as React.CSSProperties,
  row2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px', background: 'var(--bd)', marginBottom: '1px' } as React.CSSProperties,
  cell: { background: 'var(--c2)', padding: '0.75rem' } as React.CSSProperties,
  label: { fontFamily: 'DM Mono, monospace', fontSize: '0.6rem', color: 'var(--tx3)', letterSpacing: '0.08em', marginBottom: '0.35rem', textTransform: 'uppercase' as const },
  chips: { display: 'flex', flexWrap: 'wrap' as const, gap: '0.3rem', marginTop: '0.45rem' },
}

type InputMode = 'scan' | 'manual'

interface ScanFields {
  brand: string; region: string; age: string; vintage: string
  abv: string; bottler: string; cask: string
}

/* ── shared chip helper ──────────────────────────────────────────────────────  */

function Chips({ options, value, onChange, multi = false, selected = [] }: {
  options: string[]
  value?: string
  onChange?: (v: string) => void
  multi?: boolean
  selected?: string[]
  onToggle?: (v: string) => void
}) {
  if (multi) return null // handled inline
  return (
    <div style={S.chips}>
      {options.map((c) => (
        <button key={c} className={`chip${value === c ? ' active' : ''}`} onClick={() => onChange?.(value === c ? '' : c)}>
          {c}
        </button>
      ))}
    </div>
  )
}

function MultiChips({ options, selected, onToggle }: { options: string[]; selected: string[]; onToggle: (v: string) => void }) {
  return (
    <div style={S.chips}>
      {options.map((c) => (
        <button key={c} className={`chip${selected.includes(c) ? ' active' : ''}`} onClick={() => onToggle(c)}>
          {c}
        </button>
      ))}
    </div>
  )
}

/* ── Whisky Manual fields ─────────────────────────────────────────────────── */

interface WhiskyFields {
  brand: string; region: string; bottler: 'OB'|'IB'; ibName: string
  age: string; vintage: string; distilledDate: string; bottledDate: string
  abv: string; isCaskStrength: boolean; csAbv: string
  selectedCasks: string[]; customCask: string; caskNo: string; bottles: string
}
const DEFAULT_WHISKY: WhiskyFields = {
  brand:'', region:'', bottler:'OB', ibName:'', age:'', vintage:'',
  distilledDate:'', bottledDate:'', abv:'', isCaskStrength:false, csAbv:'',
  selectedCasks:[], customCask:'', caskNo:'', bottles:''
}

function WhiskyManual({ photo, setPhoto }: { photo: string|null; setPhoto:(v:string|null)=>void }) {
  const [f, setF] = useState<WhiskyFields>(DEFAULT_WHISKY)
  const upd = (p: Partial<WhiskyFields>) => setF((prev) => ({ ...prev, ...p }))
  const { updateCurrentLog, resetCurrentLog, setActiveTab } = useStore()
  const { showToast } = useToast()
  const photoRef = useRef<HTMLInputElement>(null)

  const go = async () => {
    if (!f.brand.trim()) { showToast('증류소명을 입력해주세요', 'err'); return }
    const allCasks = [...f.selectedCasks, ...(f.customCask ? [f.customCask] : [])]
    const abv = f.isCaskStrength ? (f.csAbv ? `Cask Strength (${f.csAbv}%)` : 'Cask Strength') : f.abv
    const imgCompressed = photo ? await shrinkDataUrl(photo, 600, 0.7).catch(() => photo) : ''
    resetCurrentLog()
    updateCurrentLog({
      spirit_type: 'whisky',
      brand: f.brand, region: f.region, age: f.age, vintage: f.vintage, abv,
      bottler: f.bottler, ib_name: f.ibName, casks: allCasks, cask_no: f.caskNo,
      bottles: f.bottles, distilled_date: f.distilledDate, bottled_date: f.bottledDate,
      image_url: imgCompressed || undefined,
      date: new Date().toISOString().split('T')[0],
    })
    setActiveTab('tasting')
  }

  return (
    <div className="fade-up">
      <div style={S.section}>
        <div style={S.hdr}>Distillery & Bottling</div>
        <div style={S.body}>
          <div className="m-grid-collapse" style={S.row2}>
            <div style={S.cell}>
              <p style={S.label}>Distillery / Brand</p>
              <input type="text" value={f.brand} onChange={(e) => upd({brand:e.target.value})} placeholder="e.g. Glenfarclas" />
            </div>
            <div style={S.cell}>
              <p style={S.label}>Region</p>
              <select value={f.region} onChange={(e) => upd({region:e.target.value})}>
                <option value="">Select region</option>
                {REGIONS_WHISKY.map((r) => <option key={r}>{r}</option>)}
              </select>
            </div>
          </div>
          <div className="m-grid-collapse" style={S.row2}>
            <div style={S.cell}>
              <p style={S.label}>Bottler</p>
              <select value={f.bottler} onChange={(e) => upd({bottler:e.target.value as 'OB'|'IB'})}>
                <option value="OB">OB (Official)</option>
                <option value="IB">IB (Independent)</option>
              </select>
            </div>
            <div style={S.cell}>
              <p style={S.label}>IB Name</p>
              <input type="text" value={f.ibName} onChange={(e) => upd({ibName:e.target.value})}
                placeholder={f.bottler==='IB' ? 'e.g. Gordon & MacPhail' : '(OB selected)'}
                disabled={f.bottler!=='IB'} style={{opacity: f.bottler==='IB'?1:0.3}} />
            </div>
          </div>
        </div>
      </div>

      <div style={S.section}>
        <div style={S.hdr}>Age & Vintage</div>
        <div style={S.body}>
          <div className="m-grid-collapse" style={S.row2}>
            <div style={S.cell}>
              <p style={S.label}>Age Statement</p>
              <input type="text" value={f.age} onChange={(e) => upd({age:e.target.value})} placeholder="e.g. 12yr or NAS" />
              <Chips options={AGE_CHIPS} value={f.age} onChange={(v)=>upd({age:v})} />
            </div>
            <div style={S.cell}>
              <p style={S.label}>Vintage Year</p>
              <input type="text" value={f.vintage} onChange={(e) => upd({vintage:e.target.value})} placeholder="e.g. 2005" />
              <Chips options={VINTAGE_CHIPS} value={f.vintage} onChange={(v)=>upd({vintage:v})} />
            </div>
          </div>
          <div className="m-grid-collapse" style={S.row2}>
            <div style={S.cell}>
              <p style={S.label}>Distilled Date</p>
              <input type="text" value={f.distilledDate} onChange={(e) => upd({distilledDate:e.target.value})} placeholder="e.g. Nov 1995" />
            </div>
            <div style={S.cell}>
              <p style={S.label}>Bottled Date</p>
              <input type="text" value={f.bottledDate} onChange={(e) => upd({bottledDate:e.target.value})} placeholder="e.g. Mar 2023" />
            </div>
          </div>
        </div>
      </div>

      <div style={S.section}>
        <div style={S.hdr}>Strength (ABV)</div>
        <div style={S.body}>
          <div style={S.cell}>
            <p style={S.label}>ABV</p>
            <input type="text"
              value={f.isCaskStrength ? f.csAbv : f.abv}
              onChange={(e) => f.isCaskStrength ? upd({csAbv:e.target.value.replace('%','')}) : upd({abv:e.target.value})}
              placeholder={f.isCaskStrength ? 'actual ABV e.g. 63.2' : 'e.g. 46%'} />
            <div style={S.chips}>
              {ABV_CHIPS.map((c) => {
                const isCS = c==='Cask Strength'
                const active = isCS ? f.isCaskStrength : f.abv===c
                return (
                  <button key={c} className={`chip${active?' active':''}`} onClick={() => {
                    if (isCS) upd({isCaskStrength:!f.isCaskStrength, abv:''})
                    else upd({abv:f.abv===c?'':c, isCaskStrength:false})
                  }}>{c}</button>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      <div style={S.section}>
        <div style={S.hdr}>Cask & Maturation</div>
        <div style={S.body}>
          <p style={S.label}>Cask Types</p>
          <MultiChips options={CASK_TYPES} selected={f.selectedCasks} onToggle={(c) => upd({selectedCasks: f.selectedCasks.includes(c) ? f.selectedCasks.filter((x)=>x!==c) : [...f.selectedCasks,c]})} />
          <div className="m-grid-collapse" style={{...S.row2, marginTop:'1rem'}}>
            <div style={S.cell}><p style={S.label}>Custom Cask</p><input type="text" value={f.customCask} onChange={(e)=>upd({customCask:e.target.value})} placeholder="Custom cask type" /></div>
            <div style={S.cell}><p style={S.label}>Cask No.</p><input type="text" value={f.caskNo} onChange={(e)=>upd({caskNo:e.target.value})} placeholder="e.g. #1234" /></div>
          </div>
          <div style={S.row2}>
            <div style={S.cell}><p style={S.label}>Total Bottles</p><input type="text" value={f.bottles} onChange={(e)=>upd({bottles:e.target.value})} placeholder="e.g. 285 bottles" /></div>
          </div>
        </div>
      </div>

      <PhotoSection photo={photo} setPhoto={setPhoto} photoRef={photoRef} />
      <button className="btn-gold" style={{width:'100%', justifyContent:'center', marginTop:'0.5rem'}} onClick={go}>
        Next — Add Tasting Notes →
      </button>
    </div>
  )
}

/* ── Bourbon Manual fields ───────────────────────────────────────────────── */

interface BourbonFields {
  brand: string; state: string; age: string; proof: string
  mashbill: string[]; barrel: string[]; rickWarehouse: string
  bottler: string; distilledDate: string; bottledDate: string; vintage: string
}
const DEFAULT_BOURBON: BourbonFields = {
  brand:'', state:'', age:'', proof:'', mashbill:[], barrel:[], rickWarehouse:'',
  bottler:'OB', distilledDate:'', bottledDate:'', vintage:''
}

function BourbonManual({ photo, setPhoto }: { photo:string|null; setPhoto:(v:string|null)=>void }) {
  const [f, setF] = useState<BourbonFields>(DEFAULT_BOURBON)
  const upd = (p: Partial<BourbonFields>) => setF((prev) => ({...prev,...p}))
  const { updateCurrentLog, resetCurrentLog, setActiveTab } = useStore()
  const { showToast } = useToast()
  const photoRef = useRef<HTMLInputElement>(null)

  const toggle = (field: 'mashbill'|'barrel', v: string) =>
    upd({[field]: f[field].includes(v) ? f[field].filter((x)=>x!==v) : [...f[field],v]})

  const go = async () => {
    if (!f.brand.trim()) { showToast('증류소명을 입력해주세요', 'err'); return }
    const imgCompressed = photo ? await shrinkDataUrl(photo, 600, 0.7).catch(() => photo) : ''
    resetCurrentLog()
    updateCurrentLog({
      spirit_type: 'bourbon',
      brand: f.brand, region: f.state, age: f.age, abv: f.proof,
      vintage: f.vintage, bottler: f.bottler,
      casks: [...f.mashbill, ...f.barrel],
      cask_no: f.rickWarehouse,
      distilled_date: f.distilledDate, bottled_date: f.bottledDate,
      image_url: imgCompressed || undefined,
      date: new Date().toISOString().split('T')[0],
    })
    setActiveTab('tasting')
  }

  return (
    <div className="fade-up">
      <div style={S.section}>
        <div style={S.hdr}>Distillery & Origin</div>
        <div style={S.body}>
          <div className="m-grid-collapse" style={S.row2}>
            <div style={S.cell}>
              <p style={S.label}>Distillery</p>
              <input type="text" value={f.brand} onChange={(e)=>upd({brand:e.target.value})} placeholder="e.g. Buffalo Trace, Maker's Mark" />
            </div>
            <div style={S.cell}>
              <p style={S.label}>State</p>
              <select value={f.state} onChange={(e)=>upd({state:e.target.value})}>
                <option value="">Select state</option>
                {STATES_BOURBON.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="m-grid-collapse" style={S.row2}>
            <div style={S.cell}>
              <p style={S.label}>Bottler</p>
              <select value={f.bottler} onChange={(e)=>upd({bottler:e.target.value})}>
                <option value="OB">Official (OB)</option>
                <option value="IB">Independent (IB)</option>
              </select>
            </div>
            <div style={S.cell}>
              <p style={S.label}>Vintage</p>
              <input type="text" value={f.vintage} onChange={(e)=>upd({vintage:e.target.value})} placeholder="e.g. 2018" />
            </div>
          </div>
        </div>
      </div>

      <div style={S.section}>
        <div style={S.hdr}>Age & Proof</div>
        <div style={S.body}>
          <div className="m-grid-collapse" style={S.row2}>
            <div style={S.cell}>
              <p style={S.label}>Age Statement</p>
              <input type="text" value={f.age} onChange={(e)=>upd({age:e.target.value})} placeholder="e.g. 10yr or NAS" />
              <Chips options={AGE_BOURBON} value={f.age} onChange={(v)=>upd({age:v})} />
            </div>
            <div style={S.cell}>
              <p style={S.label}>Proof / ABV</p>
              <input type="text" value={f.proof} onChange={(e)=>upd({proof:e.target.value})} placeholder="e.g. 90 proof / 45%" />
              <Chips options={PROOF_CHIPS} value={f.proof} onChange={(v)=>upd({proof:v})} />
            </div>
          </div>
          <div className="m-grid-collapse" style={S.row2}>
            <div style={S.cell}><p style={S.label}>Distilled Date</p><input type="text" value={f.distilledDate} onChange={(e)=>upd({distilledDate:e.target.value})} placeholder="e.g. Spring 2012" /></div>
            <div style={S.cell}><p style={S.label}>Bottled Date</p><input type="text" value={f.bottledDate} onChange={(e)=>upd({bottledDate:e.target.value})} placeholder="e.g. Fall 2023" /></div>
          </div>
        </div>
      </div>

      <div style={S.section}>
        <div style={S.hdr}>Mashbill & Barrel</div>
        <div style={S.body}>
          <div style={{marginBottom:'1rem'}}>
            <p style={S.label}>Mashbill Type</p>
            <MultiChips options={MASHBILL_CHIPS} selected={f.mashbill} onToggle={(v)=>toggle('mashbill',v)} />
          </div>
          <div>
            <p style={S.label}>Barrel Type</p>
            <MultiChips options={BARREL_CHIPS} selected={f.barrel} onToggle={(v)=>toggle('barrel',v)} />
          </div>
          <div style={{...S.row2, marginTop:'1rem'}}>
            <div style={S.cell}><p style={S.label}>Rick / Warehouse</p><input type="text" value={f.rickWarehouse} onChange={(e)=>upd({rickWarehouse:e.target.value})} placeholder="e.g. Rick H, Warehouse C" /></div>
          </div>
        </div>
      </div>

      <PhotoSection photo={photo} setPhoto={setPhoto} photoRef={photoRef} />
      <button className="btn-gold" style={{width:'100%', justifyContent:'center', marginTop:'0.5rem'}} onClick={go}>
        Next — Add Tasting Notes →
      </button>
    </div>
  )
}

/* ── Cognac Manual fields ─────────────────────────────────────────────────── */

interface CognacFields {
  brand: string; region: string; ageDesig: string; vintage: string
  abv: string; grapes: string[]; bottler: string; bottledDate: string
}
const DEFAULT_COGNAC: CognacFields = {
  brand:'', region:'', ageDesig:'', vintage:'', abv:'', grapes:[], bottler:'OB', bottledDate:''
}

function CognacManual({ photo, setPhoto }: { photo:string|null; setPhoto:(v:string|null)=>void }) {
  const [f, setF] = useState<CognacFields>(DEFAULT_COGNAC)
  const upd = (p: Partial<CognacFields>) => setF((prev) => ({...prev,...p}))
  const { updateCurrentLog, resetCurrentLog, setActiveTab } = useStore()
  const { showToast } = useToast()
  const photoRef = useRef<HTMLInputElement>(null)

  const go = async () => {
    if (!f.brand.trim()) { showToast('하우스/생산자를 입력해주세요', 'err'); return }
    const imgCompressed = photo ? await shrinkDataUrl(photo, 600, 0.7).catch(() => photo) : ''
    resetCurrentLog()
    updateCurrentLog({
      spirit_type: 'cognac',
      brand: f.brand, region: f.region, age: f.ageDesig,
      vintage: f.vintage, abv: f.abv, bottler: f.bottler,
      casks: f.grapes, bottled_date: f.bottledDate,
      image_url: imgCompressed || undefined,
      date: new Date().toISOString().split('T')[0],
    })
    setActiveTab('tasting')
  }

  return (
    <div className="fade-up">
      <div style={S.section}>
        <div style={S.hdr}>House & Origin</div>
        <div style={S.body}>
          <div className="m-grid-collapse" style={S.row2}>
            <div style={S.cell}>
              <p style={S.label}>House / Producer</p>
              <input type="text" value={f.brand} onChange={(e)=>upd({brand:e.target.value})} placeholder="e.g. Hennessy, Rémy Martin" />
            </div>
            <div style={S.cell}>
              <p style={S.label}>Cognac Region</p>
              <select value={f.region} onChange={(e)=>upd({region:e.target.value})}>
                <option value="">Select region</option>
                {REGIONS_COGNAC.map((r) => <option key={r}>{r}</option>)}
              </select>
              <div style={S.chips}>
                {REGIONS_COGNAC.map((r) => (
                  <button key={r} className={`chip${f.region===r?' active':''}`} style={{fontSize:'0.6rem'}} onClick={()=>upd({region:f.region===r?'':r})}>{r}</button>
                ))}
              </div>
            </div>
          </div>
          <div className="m-grid-collapse" style={S.row2}>
            <div style={S.cell}>
              <p style={S.label}>Bottler</p>
              <select value={f.bottler} onChange={(e)=>upd({bottler:e.target.value})}>
                <option value="OB">Official (OB)</option>
                <option value="IB">Independent (IB)</option>
              </select>
            </div>
            <div style={S.cell}>
              <p style={S.label}>Bottled Date</p>
              <input type="text" value={f.bottledDate} onChange={(e)=>upd({bottledDate:e.target.value})} placeholder="e.g. 2022" />
            </div>
          </div>
        </div>
      </div>

      <div style={S.section}>
        <div style={S.hdr}>Age & Vintage</div>
        <div style={S.body}>
          <div className="m-grid-collapse" style={S.row2}>
            <div style={S.cell}>
              <p style={S.label}>Age Designation</p>
              <input type="text" value={f.ageDesig} onChange={(e)=>upd({ageDesig:e.target.value})} placeholder="e.g. XO, VSOP" />
              <Chips options={AGE_COGNAC} value={f.ageDesig} onChange={(v)=>upd({ageDesig:v})} />
            </div>
            <div style={S.cell}>
              <p style={S.label}>Vintage Year</p>
              <input type="text" value={f.vintage} onChange={(e)=>upd({vintage:e.target.value})} placeholder="e.g. 1988" />
              <Chips options={VINTAGE_CHIPS} value={f.vintage} onChange={(v)=>upd({vintage:v})} />
            </div>
          </div>
          <div style={S.row2}>
            <div style={S.cell}>
              <p style={S.label}>ABV</p>
              <input type="text" value={f.abv} onChange={(e)=>upd({abv:e.target.value})} placeholder="e.g. 40%" />
              <Chips options={ABV_COGNAC} value={f.abv} onChange={(v)=>upd({abv:v})} />
            </div>
          </div>
        </div>
      </div>

      <div style={S.section}>
        <div style={S.hdr}>Grapes</div>
        <div style={S.body}>
          <p style={S.label}>Grape Varieties</p>
          <MultiChips options={GRAPE_COGNAC} selected={f.grapes} onToggle={(v)=>setF((p)=>({...p, grapes:p.grapes.includes(v)?p.grapes.filter((x)=>x!==v):[...p.grapes,v]}))} />
        </div>
      </div>

      <PhotoSection photo={photo} setPhoto={setPhoto} photoRef={photoRef} />
      <button className="btn-gold" style={{width:'100%', justifyContent:'center', marginTop:'0.5rem'}} onClick={go}>
        Next — Add Tasting Notes →
      </button>
    </div>
  )
}

/* ── Photo section (shared) ───────────────────────────────────────────────── */

function PhotoSection({ photo, setPhoto, photoRef }: { photo:string|null; setPhoto:(v:string|null)=>void; photoRef: React.RefObject<HTMLInputElement | null> }) {
  const { showToast } = useToast()
  return (
    <div style={{...S.section, marginTop:'1px'}}>
      <div style={S.hdr}>Label Photo</div>
      <div style={S.body}>
        <input ref={photoRef} type="file" accept="image/*" style={{display:'none'}}
          onChange={async (e) => {
            const f = e.target.files?.[0]; if (!f) return
            try { setPhoto(await compressImageToDataUrl(f, 800, 0.75)) } catch { showToast('이미지 처리 실패','err') }
          }} />
        {photo ? (
          <div style={{display:'flex', alignItems:'flex-start', gap:'1rem'}}>
            <img src={photo} alt="label" style={{width:100, height:100, objectFit:'cover', border:'1px solid var(--bd)'}} />
            <div style={{display:'flex', flexDirection:'column', gap:'0.4rem'}}>
              <button className="btn-ghost" style={{fontSize:'0.7rem'}} onClick={()=>photoRef.current?.click()}>변경</button>
              <button className="btn-ghost" style={{fontSize:'0.7rem', color:'#cf7e7e'}} onClick={()=>setPhoto(null)}>제거</button>
            </div>
          </div>
        ) : (
          <button className="btn-outline-gold" style={{width:'100%', justifyContent:'center'}} onClick={()=>photoRef.current?.click()}>
            📷 라벨 사진 업로드
          </button>
        )}
      </div>
    </div>
  )
}

/* ── Main InputPage ───────────────────────────────────────────────────────── */

export default function ScanPage() {
  const { updateCurrentLog, resetCurrentLog, setActiveTab, scanMode, setScanMode } = useStore()
  const { showToast } = useToast()
  const [mode, setMode] = useState<InputMode>(scanMode)
  const [spiritType, setSpiritType] = useState<SpiritType>('whisky')
  const [manualPhoto, setManualPhoto] = useState<string|null>(null)

  useEffect(() => { setMode(scanMode) }, [scanMode])

  // ── Scan state ─────────────────────────────────────────────────────────────
  const [preview, setPreview] = useState<string|null>(null)
  const [scanFile, setScanFile] = useState<File|null>(null)
  const [scanFields, setScanFields] = useState<ScanFields>({brand:'',region:'',age:'',vintage:'',abv:'',bottler:'',cask:''})
  const [progress, setProgress] = useState(0)
  const [progLabel, setProgLabel] = useState('')
  const [scanning, setScanning] = useState(false)
  const [scanDone, setScanDone] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Search state ───────────────────────────────────────────────────────────
  interface SearchResult { title:string; link:string; snippet?:string; source?:string; price?:string; imageUrl?:string }
  interface SearchData { shopping?:SearchResult[]; organic?:SearchResult[]; fallback?:boolean; googleUrl?:string; lensUrl?:string }
  const [searchData, setSearchData] = useState<SearchData|null>(null)
  const [searching, setSearching] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // ── Distillery info state ──────────────────────────────────────────────────
  interface DistilleryInfo {
    name?:string|null; country?:string|null; region?:string|null; founded?:string|null
    owner?:string|null; style?:string|null; signature?:string|null; flagships?:string[]|null
    history?:string|null; trivia?:string|null; sources?:string[]|null
  }
  const [distilleryInfo, setDistilleryInfo] = useState<DistilleryInfo|null>(null)
  const [distilleryLoading, setDistilleryLoading] = useState(false)
  const [distilleryOpen, setDistilleryOpen] = useState(false)
  const [distilleryName, setDistilleryName] = useState('')
  const [distilleryVerified, setDistilleryVerified] = useState(false)
  const [distilleryStatus, setDistilleryStatus] = useState('')

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleFile = useCallback((file: File) => {
    setScanFile(file); setScanDone(false); setSearchData(null); setSearchOpen(false)
    setScanFields({brand:'',region:'',age:'',vintage:'',abv:'',bottler:'',cask:''})
    const reader = new FileReader()
    reader.onload = (e) => setPreview(e.target?.result as string)
    reader.readAsDataURL(file)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file?.type.startsWith('image/')) handleFile(file)
  }, [handleFile])

  const runOcr = async () => {
    if (!scanFile) return
    setScanning(true); setScanDone(false); setSearchData(null); setSearchOpen(false)
    try {
      const form = new FormData(); form.append('image', scanFile)
      setProgress(15); setProgLabel('Uploading...')
      const res = await fetch('/api/ocr', { method:'POST', body:form })
      setProgress(50); setProgLabel('AI Vision 분석 중...')
      const json = await res.json() as { data?:OcrResult; error?:string }
      if (!res.ok) throw new Error(json.error || `OCR 실패 (${res.status})`)
      setProgress(85); setProgLabel('결과 정리 중...')
      const d: OcrResult = json.data || {}
      const hasAny = Object.values(d).some((v) => v && String(v).trim() !== '')
      setScanFields({ brand:d.brand||'', region:d.region||'', age:d.age||'', vintage:d.vintage||'', abv:d.abv||'', bottler:d.bottler||'', cask:d.cask||'' })
      setProgress(100); setProgLabel('완료'); setScanDone(true)
      if (hasAny) showToast('라벨 인식 완료!','ok')
      else showToast('인식된 정보가 없습니다. 직접 수정해주세요.','err')
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'OCR 실패','err')
    } finally { setScanning(false) }
  }

  const goToTasting = async () => {
    const imgCompressed = preview ? await shrinkDataUrl(preview, 600, 0.7).catch(() => preview) : ''
    resetCurrentLog()
    updateCurrentLog({
      spirit_type: 'whisky',
      brand: scanFields.brand, region: scanFields.region, age: scanFields.age,
      vintage: scanFields.vintage, abv: scanFields.abv, bottler: scanFields.bottler,
      casks: scanFields.cask ? [scanFields.cask] : [],
      image_url: imgCompressed || undefined,
      date: new Date().toISOString().split('T')[0],
    })
    setActiveTab('tasting')
  }

  const runSearch = async () => {
    if (!scanFields.brand.trim()) { showToast('브랜드 정보가 없습니다','err'); return }
    setSearching(true); setSearchOpen(true); setSearchData(null)
    try {
      let q = [scanFields.brand, scanFields.age, scanFields.cask].filter(Boolean).join(' ')
      try {
        const aiRes = await fetch('/api/ai', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({action:'gen_search_query', payload:scanFields}) })
        const aiJson = await aiRes.json() as { text?:string }
        if (aiRes.ok && aiJson.text) { const c = aiJson.text.replace(/^["']|["']$/g,'').trim(); if (c && c.length<=200) q=c }
      } catch { /* fallback to basic query */ }
      setSearchQuery(q)
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`)
      setSearchData(await res.json() as SearchData)
    } catch { showToast('검색 실패','err'); setSearchOpen(false) }
    finally { setSearching(false) }
  }

  const openDistilleryInfo = async (name: string) => {
    if (!name.trim()) return
    setDistilleryName(name); setDistilleryOpen(true); setDistilleryInfo(null)
    setDistilleryVerified(false); setDistilleryLoading(true); setDistilleryStatus('Gemini AI로 1차 정보 수집 중...')
    try {
      const t = setTimeout(()=>setDistilleryStatus('Google 검색으로 사실 검증 중...'), 1800)
      const res = await fetch(`/api/distillery?name=${encodeURIComponent(name)}&region=${encodeURIComponent(scanFields.region||'')}`)
      clearTimeout(t)
      const json = await res.json() as { data?:DistilleryInfo; verified?:boolean; error?:string }
      if (!res.ok) throw new Error(json.error || '증류소 정보 조회 실패')
      if (!json.data) throw new Error('정보 파싱 실패')
      setDistilleryInfo(json.data); setDistilleryVerified(!!json.verified)
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : '증류소 정보 실패','err'); setDistilleryOpen(false)
    } finally { setDistilleryLoading(false); setDistilleryStatus('') }
  }

  /* ── mode / spirit tab selectors ── */

  const modeBtn = (m: InputMode, icon: string, label: string) => (
    <button onClick={() => { setMode(m); setScanMode(m) }} className="mono" style={{
      flex:1, padding:'0.65rem', border:'none', cursor:'pointer',
      background: mode===m ? 'var(--gp)' : 'var(--c2)',
      color: mode===m ? 'var(--gold)' : 'var(--tx2)',
      fontSize:'0.72rem', letterSpacing:'0.08em', textTransform:'uppercase',
      borderBottom: mode===m ? '1px solid var(--gold)' : '1px solid transparent',
    }}>
      {icon} {label}
    </button>
  )

  const spiritBtn = (s: SpiritType, emoji: string, label: string) => (
    <button onClick={() => setSpiritType(s)} className="mono" style={{
      flex:1, padding:'0.5rem', border:'none', cursor:'pointer',
      background: spiritType===s ? 'rgba(201,168,76,0.12)' : 'var(--c3)',
      color: spiritType===s ? 'var(--gold)' : 'var(--tx2)',
      fontSize:'0.68rem', letterSpacing:'0.06em',
      borderBottom: spiritType===s ? '1px solid var(--gold)' : '1px solid transparent',
    }}>
      {emoji} {label}
    </button>
  )

  /* ── render ── */

  return (
    <div className="m-page" style={S.wrapper}>
      {/* Mode toggle */}
      <div style={{display:'flex', gap:'1px', marginBottom:'1.5rem', background:'var(--bd)'}}>
        {modeBtn('scan','⬡','Scan Label')}
        {modeBtn('manual','✎','Manual Input')}
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
              border:`1px dashed ${dragOver?'var(--gold)':'var(--bd2)'}`,
              background: dragOver ? 'var(--gp)' : 'var(--c2)',
              padding:'2.5rem 1.5rem', textAlign:'center',
              cursor:'pointer', transition:'all 0.2s', marginBottom:'1px',
            }}
          >
            <input ref={fileInputRef} type="file" accept="image/*" style={{display:'none'}}
              onChange={(e) => { const f=e.target.files?.[0]; if(f) handleFile(f) }} />
            {preview ? (
              <img src={preview} alt="preview" style={{maxHeight:200, maxWidth:'100%', objectFit:'contain', margin:'0 auto', display:'block'}} />
            ) : (
              <>
                <p className="display" style={{fontSize:'2.5rem', color:'var(--bd2)', marginBottom:'0.5rem'}}>⬡</p>
                <p className="mono" style={{fontSize:'0.72rem', color:'var(--tx2)'}}>Drop image or click to upload</p>
                <p style={{fontSize:'0.7rem', color:'var(--tx3)', marginTop:'0.25rem'}}>JPG · PNG · WEBP</p>
              </>
            )}
          </div>

          {preview && !scanning && !scanDone && (
            <button className="btn-gold" style={{width:'100%', justifyContent:'center', marginBottom:'1px'}} onClick={runOcr}>
              ✦ Analyze Label
            </button>
          )}

          {scanning && (
            <div style={{border:'1px solid var(--bd)', background:'var(--c2)', padding:'1rem', marginBottom:'1px'}}>
              <div style={{display:'flex', alignItems:'center', gap:'0.75rem', marginBottom:'0.6rem'}}>
                <span className="spinner" />
                <span className="mono" style={{fontSize:'0.72rem', color:'var(--gold)'}}>{progLabel}</span>
              </div>
              <div style={{height:2, background:'var(--bd)', overflow:'hidden'}}>
                <div style={{height:'100%', width:`${progress}%`, background:'var(--gold)', transition:'width 0.4s ease'}} />
              </div>
            </div>
          )}

          {scanDone && (
            <div className="fade-up">
              <div className="m-grid-collapse" style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1px', background:'var(--bd)', marginBottom:'1px'}}>
                {([['Distillery','brand'],['Region','region'],['Age','age'],['Vintage','vintage'],['ABV','abv'],['Bottler','bottler'],['Cask','cask']] as [string, keyof ScanFields][]).map(([label, key]) => (
                  <div key={key} style={S.cell}>
                    <p style={S.label}>{label}</p>
                    <input type="text" value={scanFields[key]} onChange={(e) => setScanFields((p) => ({...p,[key]:e.target.value}))} />
                  </div>
                ))}
              </div>

              <div className="m-grid-collapse" style={{display:'flex', gap:'1px', marginBottom:'1px', flexWrap:'wrap'}}>
                <button className="btn-gold" style={{flex:'1 1 200px', justifyContent:'center'}} onClick={goToTasting}>
                  Next — Add Tasting Notes →
                </button>
                <button className="btn-outline-gold" style={{whiteSpace:'nowrap', justifyContent:'center'}} onClick={runSearch} disabled={searching}>
                  {searching ? <span className="spinner"/> : '🔍'} 유사 바틀 검색
                </button>
                <button className="btn-outline-gold" style={{whiteSpace:'nowrap', justifyContent:'center'}} onClick={()=>openDistilleryInfo(scanFields.brand)} disabled={!scanFields.brand||distilleryLoading}>
                  {distilleryLoading ? <span className="spinner"/> : '🏛'} 증류소 정보
                </button>
              </div>

              {/* 검색 결과 패널 */}
              {searchOpen && (
                <div className="fade-up" style={{border:'1px solid var(--bd)', background:'var(--c2)', marginBottom:'1px'}}>
                  <div style={{padding:'0.6rem 1rem', borderBottom:'1px solid var(--bd)', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                    <div style={{flex:1, minWidth:0, marginRight:'0.5rem'}}>
                      <p className="mono" style={{fontSize:'0.65rem', color:'var(--gold)', letterSpacing:'0.1em', marginBottom:'0.15rem'}}>🔍 AI 스마트 검색 결과</p>
                      {searchQuery && <p className="mono" style={{fontSize:'0.6rem', color:'var(--tx3)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>쿼리: {searchQuery}</p>}
                    </div>
                    <button onClick={()=>setSearchOpen(false)} style={{background:'none', border:'none', color:'var(--tx3)', cursor:'pointer', fontSize:'0.9rem'}}>✕</button>
                  </div>

                  {searching && (
                    <div style={{display:'flex', alignItems:'center', gap:'0.75rem', padding:'1rem'}}>
                      <span className="spinner"/><span className="mono" style={{fontSize:'0.72rem', color:'var(--tx2)'}}>Google 검색 중...</span>
                    </div>
                  )}

                  {!searching && searchData && (
                    <div style={{padding:'0.75rem 1rem'}}>
                      {searchData.fallback && (
                        <div style={{display:'flex', flexDirection:'column', gap:'0.5rem'}}>
                          <p className="mono" style={{fontSize:'0.65rem', color:'var(--tx2)', marginBottom:'0.5rem'}}>브라우저에서 직접 검색하시겠어요?</p>
                          <a href={searchData.googleUrl} target="_blank" rel="noopener noreferrer" style={{display:'flex', alignItems:'center', gap:'0.5rem', padding:'0.6rem 0.9rem', border:'1px solid var(--bd)', color:'var(--tx)', textDecoration:'none', fontSize:'0.8rem', background:'var(--c3)'}}>🛒 Google Shopping 검색 →</a>
                          <a href={searchData.lensUrl} target="_blank" rel="noopener noreferrer" style={{display:'flex', alignItems:'center', gap:'0.5rem', padding:'0.6rem 0.9rem', border:'1px solid var(--bd)', color:'var(--tx)', textDecoration:'none', fontSize:'0.8rem', background:'var(--c3)'}}>🔎 Google 웹 검색 →</a>
                        </div>
                      )}
                      {searchData.shopping && searchData.shopping.length > 0 && (
                        <div style={{marginBottom:'1rem'}}>
                          <p className="mono" style={{fontSize:'0.6rem', color:'var(--tx3)', letterSpacing:'0.08em', marginBottom:'0.6rem', textTransform:'uppercase'}}>🛒 구매처</p>
                          <div style={{display:'flex', flexDirection:'column', gap:'1px'}}>
                            {searchData.shopping.map((r,i) => (
                              <a key={i} href={r.link} target="_blank" rel="noopener noreferrer"
                                style={{display:'flex', alignItems:'center', gap:'0.75rem', padding:'0.6rem 0.75rem', background:'var(--c3)', textDecoration:'none'}}
                                onMouseEnter={(e)=>{(e.currentTarget as HTMLAnchorElement).style.background='var(--c4)'}}
                                onMouseLeave={(e)=>{(e.currentTarget as HTMLAnchorElement).style.background='var(--c3)'}}>
                                {r.imageUrl && <img src={r.imageUrl} alt="" style={{width:44, height:44, objectFit:'contain', flexShrink:0, background:'#fff', padding:'2px'}} />}
                                <div style={{flex:1, minWidth:0}}>
                                  <p style={{fontSize:'0.78rem', color:'var(--tx)', lineHeight:1.4, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{r.title}</p>
                                  <p className="mono" style={{fontSize:'0.62rem', color:'var(--tx2)', marginTop:'0.2rem'}}>{r.source}</p>
                                </div>
                                {r.price && <span className="mono" style={{fontSize:'0.75rem', color:'var(--gold)', flexShrink:0}}>{r.price}</span>}
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                      {searchData.organic && searchData.organic.length > 0 && (
                        <div>
                          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'0.6rem'}}>
                            <p className="mono" style={{fontSize:'0.6rem', color:'var(--tx3)', letterSpacing:'0.08em', textTransform:'uppercase'}}>📰 리뷰 & 정보</p>
                            {scanFields.brand && (
                              <button onClick={()=>openDistilleryInfo(scanFields.brand)} className="mono" style={{fontSize:'0.6rem', color:'var(--gold)', background:'none', border:'1px solid var(--bd)', padding:'0.25rem 0.5rem', cursor:'pointer', letterSpacing:'0.08em'}}>
                                🏛 {scanFields.brand} 증류소 →
                              </button>
                            )}
                          </div>
                          <div style={{display:'flex', flexDirection:'column', gap:'1px'}}>
                            {searchData.organic.map((r,i) => (
                              <a key={i} href={r.link} target="_blank" rel="noopener noreferrer"
                                style={{display:'block', padding:'0.6rem 0.75rem', background:'var(--c3)', textDecoration:'none'}}
                                onMouseEnter={(e)=>{(e.currentTarget as HTMLAnchorElement).style.background='var(--c4)'}}
                                onMouseLeave={(e)=>{(e.currentTarget as HTMLAnchorElement).style.background='var(--c3)'}}>
                                <p style={{fontSize:'0.78rem', color:'var(--tx)', lineHeight:1.4, marginBottom:'0.2rem'}}>{r.title}</p>
                                {r.snippet && <p style={{fontSize:'0.7rem', color:'var(--tx2)', lineHeight:1.5, overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical'}}>{r.snippet}</p>}
                                <p className="mono" style={{fontSize:'0.58rem', color:'var(--gold)', marginTop:'0.25rem'}}>{r.source}</p>
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

      {/* ── MANUAL INPUT MODE ── */}
      {mode === 'manual' && (
        <div className="fade-up">
          {/* Spirit type selector */}
          <div style={{marginBottom:'1.25rem'}}>
            <p className="mono" style={{fontSize:'0.6rem', color:'var(--tx3)', letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:'0.5rem'}}>
              Spirit Type
            </p>
            <div style={{display:'flex', gap:'1px', background:'var(--bd)'}}>
              {spiritBtn('whisky','🥃','Whisky')}
              {spiritBtn('bourbon','🌽','Bourbon')}
              {spiritBtn('cognac','🍇','Cognac')}
            </div>
          </div>

          {spiritType === 'whisky'  && <WhiskyManual  photo={manualPhoto} setPhoto={setManualPhoto} />}
          {spiritType === 'bourbon' && <BourbonManual photo={manualPhoto} setPhoto={setManualPhoto} />}
          {spiritType === 'cognac'  && <CognacManual  photo={manualPhoto} setPhoto={setManualPhoto} />}
        </div>
      )}

      {/* ── Distillery Info Modal ── */}
      {distilleryOpen && (
        <div onClick={()=>setDistilleryOpen(false)} style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem'}}>
          <div className="m-modal-panel fade-up" onClick={(e)=>e.stopPropagation()} style={{background:'var(--c2)', border:'1px solid var(--bd)', maxWidth:640, width:'100%', maxHeight:'85vh', overflowY:'auto'}}>
            <div style={{padding:'0.75rem 1rem', borderBottom:'1px solid var(--bd)', display:'flex', justifyContent:'space-between', alignItems:'center', position:'sticky', top:0, background:'var(--c2)', zIndex:1}}>
              <div style={{display:'flex', alignItems:'center', gap:'0.5rem'}}>
                <p className="mono" style={{fontSize:'0.65rem', color:'var(--gold)', letterSpacing:'0.12em', textTransform:'uppercase'}}>🏛 Distillery Info</p>
                {distilleryVerified && !distilleryLoading && (
                  <span className="mono" style={{fontSize:'0.55rem', color:'#9bd6a3', background:'rgba(120,180,120,0.12)', border:'1px solid rgba(120,180,120,0.4)', padding:'0.15rem 0.4rem', letterSpacing:'0.08em', textTransform:'uppercase'}}>✓ Verified</span>
                )}
              </div>
              <button onClick={()=>setDistilleryOpen(false)} style={{background:'none', border:'none', color:'var(--tx3)', cursor:'pointer', fontSize:'1rem'}}>✕</button>
            </div>

            {distilleryLoading && (
              <div style={{display:'flex', flexDirection:'column', alignItems:'center', gap:'0.75rem', padding:'2.5rem 1rem'}}>
                <span className="spinner"/>
                <p className="mono" style={{fontSize:'0.72rem', color:'var(--gold)'}}>{distilleryName}</p>
                <p className="mono" style={{fontSize:'0.65rem', color:'var(--tx2)', textAlign:'center'}}>{distilleryStatus||'정보 조회 중...'}</p>
              </div>
            )}

            {!distilleryLoading && distilleryInfo && (
              <div style={{padding:'1rem'}}>
                <p className="mono" style={{fontSize:'0.6rem', color:'var(--tx3)', letterSpacing:'0.08em', marginBottom:'0.3rem'}}>
                  {[distilleryInfo.country, distilleryInfo.region].filter(Boolean).join(' · ')||'—'}
                </p>
                <p className="display" style={{fontSize:'1.6rem', color:'var(--tx)', lineHeight:1.2, marginBottom:'0.75rem'}}>{distilleryInfo.name||distilleryName}</p>
                <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1px', background:'var(--bd)', marginBottom:'1rem'}}>
                  {([['설립',distilleryInfo.founded],['소유',distilleryInfo.owner]] as [string,string|null|undefined][]).map(([label,val])=>(
                    <div key={label} style={{background:'var(--c2)', padding:'0.6rem 0.75rem'}}>
                      <p className="mono" style={{fontSize:'0.58rem', color:'var(--tx3)', letterSpacing:'0.08em', marginBottom:'0.2rem', textTransform:'uppercase'}}>{label}</p>
                      <p style={{fontSize:'0.82rem', color:'var(--tx)'}}>{val||'—'}</p>
                    </div>
                  ))}
                </div>
                {distilleryInfo.style && <div style={{marginBottom:'1rem'}}><p className="mono" style={{fontSize:'0.6rem', color:'var(--gold)', letterSpacing:'0.08em', marginBottom:'0.3rem', textTransform:'uppercase'}}>스타일</p><p style={{fontSize:'0.85rem', color:'var(--tx)', lineHeight:1.55}}>{distilleryInfo.style}</p></div>}
                {distilleryInfo.signature && <div style={{marginBottom:'1rem'}}><p className="mono" style={{fontSize:'0.6rem', color:'var(--gold)', letterSpacing:'0.08em', marginBottom:'0.3rem', textTransform:'uppercase'}}>시그니처 노트</p><p style={{fontSize:'0.85rem', color:'var(--tx)', lineHeight:1.55}}>{distilleryInfo.signature}</p></div>}
                {distilleryInfo.flagships && distilleryInfo.flagships.length > 0 && (
                  <div style={{marginBottom:'1rem'}}>
                    <p className="mono" style={{fontSize:'0.6rem', color:'var(--gold)', letterSpacing:'0.08em', marginBottom:'0.3rem', textTransform:'uppercase'}}>대표 제품</p>
                    <div style={{display:'flex', flexWrap:'wrap', gap:'0.35rem'}}>{distilleryInfo.flagships.map((f,i)=><span key={i} className="chip active" style={{cursor:'default'}}>{f}</span>)}</div>
                  </div>
                )}
                {distilleryInfo.history && <div style={{marginBottom:'1rem'}}><p className="mono" style={{fontSize:'0.6rem', color:'var(--gold)', letterSpacing:'0.08em', marginBottom:'0.3rem', textTransform:'uppercase'}}>역사</p><p style={{fontSize:'0.82rem', color:'var(--tx2)', lineHeight:1.6}}>{distilleryInfo.history}</p></div>}
                {distilleryInfo.trivia && <div style={{padding:'0.75rem', background:'var(--gp)', border:'1px solid var(--bd)', marginBottom:'1rem'}}><p className="mono" style={{fontSize:'0.6rem', color:'var(--gold)', letterSpacing:'0.08em', marginBottom:'0.3rem', textTransform:'uppercase'}}>💡 Trivia</p><p style={{fontSize:'0.82rem', color:'var(--tx)', lineHeight:1.55}}>{distilleryInfo.trivia}</p></div>}
                {distilleryInfo.sources && distilleryInfo.sources.length > 0 && (
                  <div style={{marginBottom:'1rem', paddingTop:'0.75rem', borderTop:'1px solid var(--bd)'}}>
                    <p className="mono" style={{fontSize:'0.58rem', color:'var(--tx3)', letterSpacing:'0.08em', marginBottom:'0.4rem', textTransform:'uppercase'}}>Verified Sources</p>
                    <div style={{display:'flex', flexWrap:'wrap', gap:'0.3rem'}}>{distilleryInfo.sources.map((s,i)=><span key={i} className="mono" style={{fontSize:'0.62rem', color:'var(--tx2)', padding:'0.2rem 0.45rem', background:'var(--c3)', border:'1px solid var(--bd)'}}>{s}</span>)}</div>
                  </div>
                )}
                <div style={{marginTop:'1rem', display:'flex', gap:'1px'}}>
                  <a href={`https://www.google.com/search?q=${encodeURIComponent((distilleryInfo.name||distilleryName)+' distillery')}`} target="_blank" rel="noopener noreferrer" className="btn-outline-gold" style={{flex:1, justifyContent:'center', textDecoration:'none'}}>🔍 구글에서 더 보기 →</a>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
