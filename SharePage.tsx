'use client'
import { useState } from 'react'
import { useStore } from '@/lib/store'
import { useToast } from '@/components/Toast'
import Modal from '@/components/Modal'
import { aiGenerate } from '@/lib/api'
import { WhiskyLog } from '@/types'

type NotionStatus = 'idle' | 'loading' | 'ok' | 'err'

export default function SharePage() {
  const { currentLog, collection, updateCurrentLog, notionDbId, setNotionDbId } = useStore()
  const { showToast } = useToast()

  const [blogPost, setBlogPost] = useState('')
  const [instaPost, setInstaPost] = useState('')
  const [showBlogModal, setShowBlogModal] = useState(false)
  const [showInstaModal, setShowInstaModal] = useState(false)
  const [blogLoading, setBlogLoading] = useState(false)
  const [instaLoading, setInstaLoading] = useState(false)
  const [notionStatus, setNotionStatus] = useState<NotionStatus>('idle')
  const [notionError, setNotionError] = useState('')
  const [dbIdInput, setDbIdInput] = useState(notionDbId)

  const genBlogPost = async () => {
    setBlogLoading(true)
    setShowBlogModal(true)
    try {
      const result = await aiGenerate('gen_blog_post', {
        brand: currentLog.brand || '',
        age: currentLog.age || '',
        abv: currentLog.abv || '',
        nose: currentLog.nose || '',
        palate: currentLog.palate || '',
        finish: currentLog.finish || '',
        comment: currentLog.comment || '',
      })
      setBlogPost(result)
    } catch {
      showToast('Blog generation failed', 'err')
      setShowBlogModal(false)
    } finally {
      setBlogLoading(false)
    }
  }

  const genInstaPost = async () => {
    setInstaLoading(true)
    setShowInstaModal(true)
    try {
      const result = await aiGenerate('gen_insta_post', {
        brand: currentLog.brand || '',
        age: currentLog.age || '',
        region: currentLog.region || '',
        score: String(currentLog.score || ''),
        nose: currentLog.nose || '',
        palate: currentLog.palate || '',
        finish: currentLog.finish || '',
      })
      setInstaPost(result)
    } catch {
      showToast('Instagram generation failed', 'err')
      setShowInstaModal(false)
    } finally {
      setInstaLoading(false)
    }
  }

  const saveCardImage = async () => {
    const html2canvas = (await import('html2canvas')).default
    const el = document.getElementById('shareCard')
    if (!el) return
    try {
      const canvas = await html2canvas(el, { backgroundColor: '#1C1C1C', scale: 2 })
      const link = document.createElement('a')
      link.download = `${currentLog.brand || 'dram'}-tasting-note.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
      showToast('Image saved', 'ok')
    } catch {
      showToast('Export failed', 'err')
    }
  }

  const archiveToNotion = async () => {
    if (!notionDbId) { showToast('Set a Notion DB ID first', 'err'); return }
    setNotionStatus('loading')
    setNotionError('')
    try {
      const log: WhiskyLog = {
        id: currentLog.id || crypto.randomUUID(),
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
        comment_insta: currentLog.comment_insta,
        blog_post: blogPost || currentLog.blog_post,
        insta_post: instaPost || currentLog.insta_post,
        date: currentLog.date || new Date().toISOString().split('T')[0],
        created_at: currentLog.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      const res = await fetch('/api/notion-archive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ log, dbId: notionDbId }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        const msg = (err as { error?: string }).error || 'Notion archive failed'
        setNotionError(msg)
        setNotionStatus('err')
        return
      }
      setNotionStatus('ok')
      showToast('Archived to Notion!', 'ok')
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unknown error'
      setNotionError(msg)
      setNotionStatus('err')
    }
  }

  const last5 = collection.slice(0, 5)

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', padding: '2rem 1rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1.5rem' }}>
        {/* Left: Card preview */}
        <div>
          <div
            id="shareCard"
            style={{
              background: 'var(--c2)',
              border: '1px solid var(--bd2)',
              padding: '2rem',
              minHeight: '400px',
            }}
          >
            <p className="mono" style={{ fontSize: '0.55rem', color: 'var(--gold)', letterSpacing: '0.15em', marginBottom: '0.5rem' }}>
              Tasting Note · DRAM
            </p>
            {currentLog.region && (
              <p className="mono" style={{ fontSize: '0.65rem', color: 'var(--tx2)', letterSpacing: '0.1em', marginBottom: '0.5rem' }}>
                {currentLog.region.toUpperCase()}
              </p>
            )}
            <p className="display" style={{ fontSize: '2rem', color: 'var(--tx)', lineHeight: '1.1', marginBottom: '0.25rem' }}>
              {currentLog.brand || 'Whisky Name'}
            </p>
            {currentLog.age && (
              <p className="display" style={{ fontSize: '1.2rem', color: 'var(--tx2)', marginBottom: '0.75rem' }}>
                {currentLog.age} Years Old
              </p>
            )}
            <p className="mono" style={{ fontSize: '0.65rem', color: 'var(--tx2)', marginBottom: '1rem' }}>
              {(currentLog.casks || []).join(' · ')}{currentLog.casks?.length && currentLog.abv ? ' · ' : ''}{currentLog.abv && `${currentLog.abv}%`}
            </p>
            <div style={{ height: '1px', background: 'var(--gold)', opacity: 0.4, marginBottom: '1rem' }} />
            {currentLog.nose && (
              <div style={{ marginBottom: '0.75rem' }}>
                <p className="mono" style={{ fontSize: '0.6rem', color: 'var(--gold)', marginBottom: '0.3rem' }}>NOSE</p>
                <p style={{ fontSize: '0.8rem', fontStyle: 'italic', color: 'var(--tx2)', lineHeight: '1.5' }}>{currentLog.nose}</p>
              </div>
            )}
            {currentLog.palate && (
              <div style={{ marginBottom: '0.75rem' }}>
                <p className="mono" style={{ fontSize: '0.6rem', color: 'var(--gold)', marginBottom: '0.3rem' }}>PALATE</p>
                <p style={{ fontSize: '0.8rem', fontStyle: 'italic', color: 'var(--tx2)', lineHeight: '1.5' }}>{currentLog.palate}</p>
              </div>
            )}
            {currentLog.finish && (
              <div style={{ marginBottom: '1rem' }}>
                <p className="mono" style={{ fontSize: '0.6rem', color: 'var(--gold)', marginBottom: '0.3rem' }}>FINISH</p>
                <p style={{ fontSize: '0.8rem', fontStyle: 'italic', color: 'var(--tx2)', lineHeight: '1.5' }}>{currentLog.finish}</p>
              </div>
            )}
            <div style={{ height: '1px', background: 'var(--gold)', opacity: 0.4, marginBottom: '1rem' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <p className="display" style={{ fontSize: '2.5rem', color: 'var(--gold)' }}>
                {(currentLog.score || 4).toFixed(1)}
              </p>
              <p className="display" style={{ fontSize: '1.2rem', color: 'var(--tx3)', letterSpacing: '0.1em' }}>DRAM</p>
            </div>
          </div>
        </div>

        {/* Right: Controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Export & Post */}
          <div className="section">
            <div className="section-header">Export & Post</div>
            <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <button className="btn-outline-gold" style={{ textAlign: 'left' }} onClick={genBlogPost} disabled={blogLoading}>
                {blogLoading ? <><span className="spinner" /> Generating Blog...</> : '📝 Blog Post'}
              </button>
              <button className="btn-outline-gold" style={{ textAlign: 'left' }} onClick={genInstaPost} disabled={instaLoading}>
                {instaLoading ? <><span className="spinner" /> Generating...</> : '📸 Instagram Post'}
              </button>
              <button className="btn-outline-gold" style={{ textAlign: 'left' }} onClick={saveCardImage}>
                🖼 Save Card Image
              </button>
            </div>
          </div>

          {/* Notion Archive */}
          <div className="section">
            <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Notion Archive</span>
              <span>
                {notionStatus === 'idle' && <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--tx3)', display: 'inline-block' }} />}
                {notionStatus === 'loading' && <span className="spinner" />}
                {notionStatus === 'ok' && <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#7ecf7e', display: 'inline-block' }} />}
                {notionStatus === 'err' && <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#cf7e7e', display: 'inline-block' }} />}
              </span>
            </div>
            <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="text"
                  value={dbIdInput}
                  onChange={e => setDbIdInput(e.target.value)}
                  placeholder="Notion DB ID"
                  style={{ flex: 1, background: 'var(--c3)', padding: '0.4rem 0.6rem', border: '1px solid var(--bd)' }}
                />
                <button className="btn-ghost" onClick={() => { setNotionDbId(dbIdInput); showToast('DB ID saved', 'ok') }}>
                  Save
                </button>
              </div>

              {notionStatus === 'ok' ? (
                <div>
                  <div style={{ padding: '0.5rem', background: 'rgba(80,160,80,0.1)', border: '1px solid rgba(80,160,80,0.3)', marginBottom: '0.5rem' }}>
                    <p className="mono" style={{ fontSize: '0.7rem', color: '#7ecf7e' }}>✓ Saved</p>
                  </div>
                  <a
                    href={`https://notion.so/${notionDbId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mono"
                    style={{ fontSize: '0.7rem', color: 'var(--gold)', textDecoration: 'underline' }}
                  >
                    🔗 Open Notion DB →
                  </a>
                </div>
              ) : (
                <button className="btn-gold" onClick={archiveToNotion} disabled={notionStatus === 'loading'}>
                  {notionStatus === 'loading' ? <><span className="spinner" /> Archiving...</> : '📓 Archive to Notion'}
                </button>
              )}

              {notionStatus === 'err' && notionError && (
                <div style={{ padding: '0.5rem', background: 'rgba(160,60,60,0.1)', border: '1px solid rgba(160,60,60,0.3)' }}>
                  <p className="mono" style={{ fontSize: '0.7rem', color: '#cf7e7e' }}>
                    {notionError.includes('401') ? 'Authentication error — please re-authenticate with Notion.' :
                      notionError.includes('400') ? 'Invalid request — check your DB properties.' :
                        notionError}
                  </p>
                </div>
              )}

              {/* Setup guide */}
              <div style={{ borderTop: '1px solid var(--bd)', paddingTop: '0.75rem' }}>
                <p className="mono" style={{ fontSize: '0.6rem', color: 'var(--tx2)', marginBottom: '0.5rem' }}>SETUP GUIDE</p>
                <ol style={{ paddingLeft: '1rem' }}>
                  {[
                    'Create a Notion database for whisky logs',
                    'Add properties: Name, Region, Age, ABV, Score, Nose, Palate, Finish',
                    'Connect Notion MCP at mcp.notion.com',
                    'Copy your database ID from the URL',
                    'Paste the DB ID above and save',
                  ].map((step, i) => (
                    <li key={i} className="mono" style={{ fontSize: '0.65rem', color: 'var(--tx2)', marginBottom: '0.3rem', lineHeight: '1.5' }}>
                      {step}
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </div>

          {/* Collection quick-select */}
          {last5.length > 0 && (
            <div className="section">
              <div className="section-header">Recent Drams</div>
              <div style={{ padding: '0.5rem' }}>
                {last5.map(log => (
                  <button
                    key={log.id}
                    onClick={() => updateCurrentLog(log)}
                    style={{
                      width: '100%', textAlign: 'left',
                      padding: '0.6rem 0.75rem',
                      background: 'transparent',
                      border: 'none',
                      borderBottom: '1px solid var(--bd)',
                      cursor: 'pointer',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      transition: 'background 0.2s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--gp)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <span style={{ fontSize: '0.8rem', color: 'var(--tx)' }}>{log.brand}</span>
                    <span className="mono" style={{ fontSize: '0.65rem', color: 'var(--tx2)' }}>{log.age}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Blog Modal */}
      {showBlogModal && (
        <Modal
          title="Blog Post"
          subtitle="AI-generated blog post — edit as needed"
          onClose={() => setShowBlogModal(false)}
          actions={
            <>
              <button className="btn-ghost" onClick={() => setShowBlogModal(false)}>Close</button>
              <button className="btn-ghost" onClick={genBlogPost}>Regenerate</button>
              <button className="btn-gold" onClick={() => { navigator.clipboard.writeText(blogPost); showToast('Copied!', 'ok') }}>Copy</button>
            </>
          }
        >
          {blogLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--tx2)' }}>
              <span className="spinner" /><span className="mono" style={{ fontSize: '0.75rem' }}>Generating...</span>
            </div>
          ) : (
            <textarea
              value={blogPost}
              onChange={e => setBlogPost(e.target.value)}
              style={{ minHeight: '200px', lineHeight: '1.7', background: 'var(--c3)', padding: '0.75rem' }}
            />
          )}
        </Modal>
      )}

      {/* Instagram Modal */}
      {showInstaModal && (
        <Modal
          title="Instagram Post"
          subtitle="AI-generated Instagram post"
          onClose={() => setShowInstaModal(false)}
          actions={
            <>
              <button className="btn-ghost" onClick={() => setShowInstaModal(false)}>Close</button>
              <button className="btn-ghost" onClick={genInstaPost}>Regenerate</button>
              <button className="btn-gold" onClick={() => { navigator.clipboard.writeText(instaPost); showToast('Copied!', 'ok') }}>Copy</button>
            </>
          }
        >
          {instaLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--tx2)' }}>
              <span className="spinner" /><span className="mono" style={{ fontSize: '0.75rem' }}>Generating...</span>
            </div>
          ) : (
            <textarea
              value={instaPost}
              onChange={e => setInstaPost(e.target.value)}
              style={{ minHeight: '200px', lineHeight: '1.7', background: 'var(--c3)', padding: '0.75rem' }}
            />
          )}
        </Modal>
      )}
    </div>
  )
}
