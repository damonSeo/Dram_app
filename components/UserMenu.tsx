'use client'
import { useState, useEffect } from 'react'
import { useStore } from '@/lib/store'
import { useToast } from '@/components/Toast'
import { getBrowserClient } from '@/lib/supabaseClient'
import type { Profile } from '@/types'

export default function UserMenu() {
  const { currentUserId, currentProfile, setCurrentUser } = useStore()
  const { showToast } = useToast()
  const [profileOpen, setProfileOpen] = useState(false)
  const [loginOpen, setLoginOpen] = useState(false)
  const [nickEditing, setNickEditing] = useState(false)
  const [nickInput, setNickInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [loadingProvider, setLoadingProvider] = useState<'kakao' | 'google' | null>(null)

  // OAuth 페이지에서 뒤로 왔을 때 스피너 리셋
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') setLoadingProvider(null)
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [])

  // 초기 로딩: 현재 세션 확인
  useEffect(() => {
    let mounted = true
    const init = async () => {
      try {
        const supabase = getBrowserClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!mounted) return
        if (user) {
          const res = await fetch('/api/profile')
          const json = await res.json() as { data?: Profile | null }
          setCurrentUser(user.id, json.data || null)
        }
        supabase.auth.onAuthStateChange(async (_event, session) => {
          if (!mounted) return
          if (session?.user) {
            const r = await fetch('/api/profile')
            const j = await r.json() as { data?: Profile | null }
            setCurrentUser(session.user.id, j.data || null)
          } else {
            setCurrentUser(null, null)
          }
        })
      } catch (e) {
        console.warn('[UserMenu] Auth init failed:', e)
      }
    }
    init()
    return () => { mounted = false }
  }, [setCurrentUser])

  const loginWith = async (provider: 'kakao' | 'google') => {
    setLoadingProvider(provider)
    try {
      const supabase = getBrowserClient()
      const opts =
        provider === 'kakao'
          ? { scopes: 'profile nickname' }
          : {}
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: `${window.location.origin}/auth/callback`, ...opts },
      })
      if (error) throw error
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : '로그인 실패', 'err')
      setLoadingProvider(null)
    }
  }

  const logout = async () => {
    try {
      const supabase = getBrowserClient()
      await supabase.auth.signOut()
      setCurrentUser(null, null)
      setProfileOpen(false)
      showToast('로그아웃됨', 'ok')
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : '로그아웃 실패', 'err')
    }
  }

  const startEditNickname = () => {
    setNickInput(currentProfile?.nickname || '')
    setNickEditing(true)
  }

  const saveNickname = async () => {
    const v = nickInput.trim()
    if (!v) { showToast('닉네임을 입력해주세요', 'err'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname: v }),
      })
      const json = await res.json() as { data?: Profile; error?: string }
      if (!res.ok) throw new Error(json.error || '저장 실패')
      if (json.data && currentUserId) setCurrentUser(currentUserId, json.data)
      setNickEditing(false)
      showToast('닉네임 저장됨', 'ok')
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : '저장 실패', 'err')
    } finally {
      setSaving(false)
    }
  }

  /* ── 비로그인 상태 ── */
  if (!currentUserId) {
    return (
      <>
        <button
          onClick={() => setLoginOpen(true)}
          className="mono"
          style={{
            background: 'transparent',
            border: '1px solid var(--bd2)',
            color: 'var(--gold)',
            padding: '0.4rem 0.8rem',
            cursor: 'pointer',
            fontSize: '0.6rem',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            display: 'flex', alignItems: 'center', gap: '0.3rem',
          }}>
          🔑 로그인
        </button>

        {/* 로그인 모달 */}
        {loginOpen && (
          <div
            onClick={() => !loadingProvider && setLoginOpen(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
            <div
              onClick={(e) => e.stopPropagation()}
              style={{ background: 'var(--c2)', border: '1px solid var(--bd2)', maxWidth: 380, width: '100%' }}>

              {/* Header */}
              <div style={{ padding: '1.25rem 1.5rem 1rem', borderBottom: '1px solid var(--bd)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p className="display" style={{ fontSize: '1.5rem', color: 'var(--gold)', letterSpacing: '0.05em' }}>
                    Oak the Record
                  </p>
                  <p className="mono" style={{ fontSize: '0.58rem', color: 'var(--tx3)', letterSpacing: '0.12em', textTransform: 'uppercase', marginTop: '0.2rem' }}>
                    Sign in to continue
                  </p>
                </div>
                <button onClick={() => setLoginOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--tx3)', cursor: 'pointer', fontSize: '1rem', padding: '0.2rem' }}>
                  ✕
                </button>
              </div>

              {/* 소셜 로그인 버튼들 */}
              <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {/* 카카오 */}
                <button
                  onClick={() => loginWith('kakao')}
                  disabled={!!loadingProvider}
                  style={{
                    width: '100%',
                    background: '#FEE500',
                    border: 'none',
                    color: '#3C1E1E',
                    padding: '0.85rem 1.25rem',
                    cursor: loadingProvider ? 'wait' : 'pointer',
                    fontSize: '0.78rem',
                    fontFamily: 'var(--mono)',
                    letterSpacing: '0.05em',
                    fontWeight: 600,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                    opacity: loadingProvider && loadingProvider !== 'kakao' ? 0.4 : 1,
                    transition: 'opacity 0.2s',
                  }}>
                  {loadingProvider === 'kakao'
                    ? <span className="spinner" style={{ borderTopColor: '#3C1E1E' }} />
                    : <span style={{ fontSize: '1rem' }}>💬</span>}
                  카카오톡으로 로그인
                </button>

                {/* 구분선 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ flex: 1, height: 1, background: 'var(--bd)' }} />
                  <span className="mono" style={{ fontSize: '0.58rem', color: 'var(--tx3)', letterSpacing: '0.1em' }}>OR</span>
                  <div style={{ flex: 1, height: 1, background: 'var(--bd)' }} />
                </div>

                {/* 구글 */}
                <button
                  onClick={() => loginWith('google')}
                  disabled={!!loadingProvider}
                  style={{
                    width: '100%',
                    background: 'var(--c3)',
                    border: '1px solid var(--bd2)',
                    color: 'var(--tx)',
                    padding: '0.85rem 1.25rem',
                    cursor: loadingProvider ? 'wait' : 'pointer',
                    fontSize: '0.78rem',
                    fontFamily: 'var(--mono)',
                    letterSpacing: '0.05em',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                    opacity: loadingProvider && loadingProvider !== 'google' ? 0.4 : 1,
                    transition: 'opacity 0.2s',
                  }}>
                  {loadingProvider === 'google'
                    ? <span className="spinner" style={{ borderTopColor: 'var(--gold)' }} />
                    : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                      </svg>
                    )}
                  Google로 로그인
                </button>
              </div>

              <div style={{ padding: '0.75rem 1.5rem', borderTop: '1px solid var(--bd)', textAlign: 'center' }}>
                <p className="mono" style={{ fontSize: '0.58rem', color: 'var(--tx3)', lineHeight: 1.6 }}>
                  로그인하면 개인 아카이브와 노트를 저장할 수 있어요
                </p>
              </div>
            </div>
          </div>
        )}
      </>
    )
  }

  /* ── 로그인 상태 — 프로필 버튼 ── */
  return (
    <>
      <button onClick={() => setProfileOpen(true)} className="mono"
        title="프로필"
        style={{
          background: 'transparent', border: '1px solid var(--bd2)',
          color: 'var(--gold)', padding: '0.35rem 0.7rem',
          cursor: 'pointer', fontSize: '0.62rem', letterSpacing: '0.05em',
          display: 'flex', alignItems: 'center', gap: '0.35rem', maxWidth: 140,
        }}>
        <span>👤</span>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {currentProfile?.nickname || '닉네임 설정'}
        </span>
      </button>

      {/* 프로필 모달 */}
      {profileOpen && (
        <div onClick={() => !saving && setProfileOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div onClick={(e) => e.stopPropagation()}
            style={{ background: 'var(--c2)', border: '1px solid var(--gold)', maxWidth: 400, width: '100%' }}>
            <div style={{ padding: '0.85rem 1.25rem', borderBottom: '1px solid var(--bd)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <p className="mono" style={{ fontSize: '0.65rem', color: 'var(--gold)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                👤 프로필
              </p>
              <button onClick={() => setProfileOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--tx3)', cursor: 'pointer', fontSize: '1rem' }}>✕</button>
            </div>
            <div style={{ padding: '1.25rem' }}>
              {nickEditing ? (
                <div>
                  <p className="mono" style={{ fontSize: '0.6rem', color: 'var(--tx3)', marginBottom: '0.4rem', letterSpacing: '0.08em', textTransform: 'uppercase' }}>닉네임</p>
                  <input type="text" value={nickInput} onChange={(e) => setNickInput(e.target.value)}
                    placeholder="닉네임을 입력하세요"
                    maxLength={30}
                    onKeyDown={(e) => { if (e.key === 'Enter') saveNickname() }}
                    style={{ border: '1px solid var(--bd2)', padding: '0.5rem 0.7rem', background: 'var(--c3)', color: 'var(--tx)', fontSize: '0.85rem' }}
                    autoFocus />
                  <p className="mono" style={{ fontSize: '0.58rem', color: 'var(--tx3)', marginTop: '0.4rem' }}>
                    {nickInput.length} / 30
                  </p>
                </div>
              ) : (
                <div>
                  <p className="mono" style={{ fontSize: '0.6rem', color: 'var(--tx3)', marginBottom: '0.3rem', letterSpacing: '0.08em', textTransform: 'uppercase' }}>닉네임</p>
                  <p className="display" style={{ fontSize: '1.5rem', color: 'var(--tx)', marginBottom: '0.75rem' }}>
                    {currentProfile?.nickname || '미설정'}
                  </p>
                  <button className="btn-outline-gold" style={{ fontSize: '0.7rem' }} onClick={startEditNickname}>
                    ✎ 닉네임 변경
                  </button>
                </div>
              )}
            </div>
            <div style={{ padding: '0.85rem 1.25rem', borderTop: '1px solid var(--bd)', display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button onClick={logout} disabled={saving}
                style={{ background: 'transparent', border: '1px solid #cf7e7e', color: '#cf7e7e', padding: '0.4rem 0.85rem', cursor: 'pointer', fontSize: '0.7rem', fontFamily: 'var(--mono)' }}>
                🚪 로그아웃
              </button>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {nickEditing && (
                  <button className="btn-ghost" disabled={saving} style={{ fontSize: '0.7rem' }}
                    onClick={() => setNickEditing(false)}>취소</button>
                )}
                {nickEditing ? (
                  <button className="btn-gold" disabled={saving} style={{ fontSize: '0.7rem' }} onClick={saveNickname}>
                    {saving ? <span className="spinner" style={{ borderTopColor: '#fff' }} /> : null}저장
                  </button>
                ) : (
                  <button className="btn-ghost" style={{ fontSize: '0.7rem' }} onClick={() => setProfileOpen(false)}>닫기</button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
