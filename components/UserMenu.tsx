'use client'
import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useStore } from '@/lib/store'
import { useToast } from '@/components/Toast'
import { getBrowserClient } from '@/lib/supabaseClient'
import type { Profile } from '@/types'

type LoginTab = 'email' | 'social'
type EmailMode = 'signin' | 'signup'

export default function UserMenu() {
  const { currentUserId, currentProfile, setCurrentUser } = useStore()
  const { showToast } = useToast()
  const [profileOpen, setProfileOpen] = useState(false)
  const [loginOpen, setLoginOpen] = useState(false)
  const [nickEditing, setNickEditing] = useState(false)
  const [nickInput, setNickInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [loadingProvider, setLoadingProvider] = useState<'kakao' | 'google' | null>(null)

  // 이메일 로그인 관련 상태
  const [loginTab, setLoginTab] = useState<LoginTab>('email')
  const [emailMode, setEmailMode] = useState<EmailMode>('signin')
  const [emailInput, setEmailInput] = useState('')
  const [passwordInput, setPasswordInput] = useState('')
  const [nicknameInput, setNicknameInput] = useState('')
  const [emailLoading, setEmailLoading] = useState(false)
  const [signupDone, setSignupDone] = useState(false)

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

  // 이메일 로그인
  const handleEmailSignIn = async () => {
    const email = emailInput.trim()
    const password = passwordInput
    if (!email || !password) { showToast('이메일과 비밀번호를 입력해주세요', 'err'); return }
    setEmailLoading(true)
    try {
      const supabase = getBrowserClient()
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          showToast('이메일 또는 비밀번호가 올바르지 않아요', 'err')
        } else if (error.message.includes('Email not confirmed')) {
          showToast('이메일 인증이 필요해요. 받은 메일을 확인해주세요', 'err')
        } else {
          showToast(error.message, 'err')
        }
      } else {
        setLoginOpen(false)
        showToast('로그인됐어요 👋', 'ok')
      }
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : '로그인 실패', 'err')
    } finally {
      setEmailLoading(false)
    }
  }

  // 이메일 회원가입
  const handleEmailSignUp = async () => {
    const email = emailInput.trim()
    const password = passwordInput
    const nickname = nicknameInput.trim()
    if (!email || !password) { showToast('이메일과 비밀번호를 입력해주세요', 'err'); return }
    if (password.length < 6) { showToast('비밀번호는 6자 이상이어야 해요', 'err'); return }
    setEmailLoading(true)
    try {
      const supabase = getBrowserClient()
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { nickname: nickname || email.split('@')[0] },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })
      if (error) {
        if (error.message.includes('already registered') || error.message.includes('User already registered')) {
          showToast('이미 가입된 이메일이에요. 로그인을 시도해보세요', 'err')
        } else {
          showToast(error.message, 'err')
        }
      } else {
        // 닉네임이 있으면 서버에 저장 (인증 후 자동 처리됨)
        setSignupDone(true)
      }
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : '회원가입 실패', 'err')
    } finally {
      setEmailLoading(false)
    }
  }

  const loginWith = async (provider: 'kakao' | 'google') => {
    setLoadingProvider(provider)
    try {
      const supabase = getBrowserClient()
      const redirectTo = `${window.location.origin}/auth/callback`
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo,
          ...(provider === 'kakao' ? { scopes: 'profile nickname' } : {}),
        },
      })
      if (error) {
        showToast(`[${provider}] ${error.message}`, 'err')
        setLoadingProvider(null)
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      showToast(`로그인 오류: ${msg}`, 'err')
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

  const resetEmailForm = () => {
    setEmailInput('')
    setPasswordInput('')
    setNicknameInput('')
    setSignupDone(false)
    setEmailLoading(false)
  }

  /* ── 비로그인 상태 ── */
  if (!currentUserId) {
    return (
      <>
        <button
          onClick={() => { setLoginOpen(true); resetEmailForm(); setLoginTab('email'); setEmailMode('signin') }}
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

        {loginOpen && createPortal(
          <div
            onClick={() => !loadingProvider && !emailLoading && setLoginOpen(false)}
            style={{
              position: 'fixed', inset: 0, zIndex: 9500,
              background: 'rgba(0,0,0,0.82)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              overflowY: 'auto',
              display: 'flex',
            }}>
            {/* 닫기 */}
            <button
              onClick={() => setLoginOpen(false)}
              style={{
                position: 'fixed', top: '1.25rem', right: '1.25rem', zIndex: 10,
                background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.18)',
                color: 'rgba(255,255,255,0.7)', cursor: 'pointer',
                width: 36, height: 36, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.9rem',
              }}>
              ✕
            </button>

            {/* 카드 */}
            <div
              onClick={e => e.stopPropagation()}
              style={{
                background: 'linear-gradient(160deg, #1A1614 0%, #2C1E17 50%, #1E1A18 100%)',
                border: '1px solid rgba(198,107,61,0.3)',
                width: '100%', maxWidth: 420,
                padding: '2.5rem',
                position: 'relative', overflow: 'hidden',
                margin: 'auto',
              }}>
              {/* 배경 장식 */}
              <div style={{ position: 'absolute', top: -80, right: -80, width: 280, height: 280, borderRadius: '50%', background: 'rgba(198,107,61,0.08)', pointerEvents: 'none' }} />
              <div style={{ position: 'absolute', bottom: -60, left: -60, width: 200, height: 200, borderRadius: '50%', background: 'rgba(198,107,61,0.05)', pointerEvents: 'none' }} />

              <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

                {/* 브랜드 */}
                <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
                  <p className="display" style={{ fontSize: '2rem', color: '#F2EDE7', letterSpacing: '0.12em', lineHeight: 1 }}>OAK</p>
                  <p className="display" style={{ fontSize: '0.68rem', color: 'var(--gold)', letterSpacing: '0.35em', textTransform: 'uppercase', marginTop: '0.1rem' }}>The Record</p>
                  <div style={{ width: 32, height: 1, background: 'rgba(198,107,61,0.3)', margin: '0.85rem auto 0' }} />
                </div>

                {/* ── 탭 ── */}
                <div style={{ display: 'flex', width: '100%', maxWidth: 360, marginBottom: '1.5rem', border: '1px solid rgba(255,255,255,0.12)' }}>
                  {(['email', 'social'] as LoginTab[]).map(t => (
                    <button key={t} onClick={() => setLoginTab(t)} className="mono"
                      style={{
                        flex: 1, padding: '0.55rem', border: 'none', cursor: 'pointer',
                        background: loginTab === t ? 'rgba(198,107,61,0.18)' : 'transparent',
                        color: loginTab === t ? 'var(--gold)' : 'rgba(255,255,255,0.35)',
                        fontSize: '0.62rem', letterSpacing: '0.1em', textTransform: 'uppercase',
                        transition: 'all 0.2s',
                        borderRight: t === 'email' ? '1px solid rgba(255,255,255,0.12)' : 'none',
                      }}>
                      {t === 'email' ? '✉ 이메일' : '🌐 소셜'}
                    </button>
                  ))}
                </div>

                {/* ── 이메일 탭 ── */}
                {loginTab === 'email' && (
                  <div style={{ width: '100%', maxWidth: 360 }}>

                    {/* 회원가입 완료 메시지 */}
                    {signupDone ? (
                      <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
                        <p style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>📬</p>
                        <p className="display" style={{ fontSize: '1.2rem', color: '#F2EDE7', marginBottom: '0.6rem' }}>확인 메일을 보냈어요</p>
                        <p className="mono" style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.45)', lineHeight: 1.8 }}>
                          {emailInput} 로 인증 링크를 발송했어요.<br />
                          메일함을 확인하고 링크를 클릭하면<br />
                          로그인이 완료돼요.
                        </p>
                        <button onClick={() => { setSignupDone(false); setEmailMode('signin') }} className="mono"
                          style={{ marginTop: '1.25rem', background: 'none', border: '1px solid rgba(198,107,61,0.4)', color: 'var(--gold)', padding: '0.5rem 1.2rem', cursor: 'pointer', fontSize: '0.65rem', letterSpacing: '0.08em' }}>
                          로그인으로 돌아가기
                        </button>
                      </div>
                    ) : (
                      <>
                        {/* 로그인 / 회원가입 서브 탭 */}
                        <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1.25rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.75rem' }}>
                          {(['signin', 'signup'] as EmailMode[]).map(m => (
                            <button key={m} onClick={() => { setEmailMode(m); resetEmailForm() }} className="mono"
                              style={{
                                background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                                color: emailMode === m ? 'var(--gold)' : 'rgba(255,255,255,0.3)',
                                fontSize: '0.72rem', letterSpacing: '0.08em',
                                borderBottom: emailMode === m ? '1px solid var(--gold)' : '1px solid transparent',
                                paddingBottom: '0.2rem', transition: 'all 0.15s',
                              }}>
                              {m === 'signin' ? '로그인' : '회원가입'}
                            </button>
                          ))}
                        </div>

                        {/* 폼 */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>

                          {/* 닉네임 (회원가입만) */}
                          {emailMode === 'signup' && (
                            <div>
                              <p className="mono" style={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.35)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.3rem' }}>닉네임 (선택)</p>
                              <input type="text" value={nicknameInput} onChange={e => setNicknameInput(e.target.value)}
                                placeholder="표시될 이름"
                                maxLength={20}
                                style={{
                                  width: '100%', padding: '0.7rem 0.9rem',
                                  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.14)',
                                  color: '#F2EDE7', fontSize: '0.85rem', outline: 'none',
                                  fontFamily: 'var(--mono)', letterSpacing: '0.03em',
                                  boxSizing: 'border-box',
                                }} />
                            </div>
                          )}

                          {/* 이메일 */}
                          <div>
                            <p className="mono" style={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.35)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.3rem' }}>이메일</p>
                            <input type="email" value={emailInput} onChange={e => setEmailInput(e.target.value)}
                              placeholder="your@email.com"
                              autoFocus
                              style={{
                                width: '100%', padding: '0.7rem 0.9rem',
                                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.14)',
                                color: '#F2EDE7', fontSize: '0.85rem', outline: 'none',
                                fontFamily: 'var(--mono)', letterSpacing: '0.03em',
                                boxSizing: 'border-box',
                              }} />
                          </div>

                          {/* 비밀번호 */}
                          <div>
                            <p className="mono" style={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.35)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.3rem' }}>
                              비밀번호 {emailMode === 'signup' && <span style={{ color: 'rgba(255,255,255,0.2)' }}>(6자 이상)</span>}
                            </p>
                            <input type="password" value={passwordInput} onChange={e => setPasswordInput(e.target.value)}
                              placeholder="••••••••"
                              onKeyDown={e => { if (e.key === 'Enter') emailMode === 'signin' ? handleEmailSignIn() : handleEmailSignUp() }}
                              style={{
                                width: '100%', padding: '0.7rem 0.9rem',
                                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.14)',
                                color: '#F2EDE7', fontSize: '0.85rem', outline: 'none',
                                fontFamily: 'var(--mono)', letterSpacing: '0.1em',
                                boxSizing: 'border-box',
                              }} />
                          </div>

                          {/* 제출 버튼 */}
                          <button
                            onClick={emailMode === 'signin' ? handleEmailSignIn : handleEmailSignUp}
                            disabled={emailLoading}
                            style={{
                              width: '100%', background: 'var(--gold)', border: 'none', color: '#1A1614',
                              padding: '0.85rem', cursor: emailLoading ? 'wait' : 'pointer',
                              fontSize: '0.8rem', fontFamily: 'var(--mono)', letterSpacing: '0.1em', fontWeight: 700,
                              marginTop: '0.3rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                              opacity: emailLoading ? 0.7 : 1, transition: 'opacity 0.2s',
                            }}>
                            {emailLoading
                              ? <span className="spinner" style={{ borderTopColor: '#1A1614', width: 14, height: 14, borderWidth: 2 }} />
                              : (emailMode === 'signin' ? '로그인' : '회원가입')}
                          </button>

                          {/* 전환 링크 */}
                          <p className="mono" style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.3)', textAlign: 'center', marginTop: '0.25rem' }}>
                            {emailMode === 'signin' ? (
                              <>아직 계정이 없으신가요?{' '}
                                <button onClick={() => { setEmailMode('signup'); resetEmailForm() }}
                                  style={{ background: 'none', border: 'none', color: 'var(--gold)', cursor: 'pointer', fontSize: '0.6rem', fontFamily: 'var(--mono)', padding: 0, textDecoration: 'underline' }}>
                                  회원가입
                                </button>
                              </>
                            ) : (
                              <>이미 계정이 있으신가요?{' '}
                                <button onClick={() => { setEmailMode('signin'); resetEmailForm() }}
                                  style={{ background: 'none', border: 'none', color: 'var(--gold)', cursor: 'pointer', fontSize: '0.6rem', fontFamily: 'var(--mono)', padding: 0, textDecoration: 'underline' }}>
                                  로그인
                                </button>
                              </>
                            )}
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* ── 소셜 탭 ── */}
                {loginTab === 'social' && (
                  <div style={{ width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                    {/* 카카오 */}
                    <button
                      onClick={() => loginWith('kakao')}
                      disabled={!!loadingProvider}
                      style={{
                        width: '100%', background: '#FEE500', border: 'none', color: '#3C1E1E',
                        padding: '1rem 1.5rem', cursor: loadingProvider ? 'wait' : 'pointer',
                        fontSize: '0.82rem', fontFamily: 'var(--mono)', letterSpacing: '0.06em', fontWeight: 700,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem',
                        opacity: loadingProvider && loadingProvider !== 'kakao' ? 0.35 : 1,
                        transition: 'opacity 0.2s',
                      }}>
                      {loadingProvider === 'kakao'
                        ? <span className="spinner" style={{ borderTopColor: '#3C1E1E' }} />
                        : <span style={{ fontSize: '1.1rem' }}>💬</span>}
                      카카오톡으로 로그인
                    </button>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.1)' }} />
                      <span className="mono" style={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.12em' }}>OR</span>
                      <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.1)' }} />
                    </div>

                    {/* 구글 */}
                    <button
                      onClick={() => loginWith('google')}
                      disabled={!!loadingProvider}
                      style={{
                        width: '100%', background: 'rgba(255,255,255,0.06)',
                        border: '1px solid rgba(255,255,255,0.18)', color: '#F2EDE7',
                        padding: '1rem 1.5rem', cursor: loadingProvider ? 'wait' : 'pointer',
                        fontSize: '0.82rem', fontFamily: 'var(--mono)', letterSpacing: '0.06em',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem',
                        opacity: loadingProvider && loadingProvider !== 'google' ? 0.35 : 1,
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

                    <p className="mono" style={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.2)', textAlign: 'center', marginTop: '0.5rem', lineHeight: 1.7 }}>
                      소셜 로그인에 문제가 있으면<br />이메일 탭을 이용해주세요
                    </p>
                  </div>
                )}

                <p className="mono" style={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.2)', marginTop: '1.5rem', lineHeight: 1.8, textAlign: 'center' }}>
                  로그인하면 개인 아카이브와 테이스팅 노트를 저장할 수 있어요
                </p>
              </div>
            </div>
          </div>,
          document.body
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

      {profileOpen && createPortal(
        <div onClick={() => !saving && setProfileOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)', zIndex: 9500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
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
                    style={{ border: '1px solid var(--bd2)', padding: '0.5rem 0.7rem', background: 'var(--c3)', color: 'var(--tx)', fontSize: '0.85rem', width: '100%', boxSizing: 'border-box' }}
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
        </div>,
        document.body
      )}
    </>
  )
}
