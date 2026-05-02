'use client'
import { useState, useEffect } from 'react'
import { useStore } from '@/lib/store'
import { useToast } from '@/components/Toast'
import { getBrowserClient } from '@/lib/supabaseClient'
import type { Profile } from '@/types'

export default function UserMenu() {
  const { currentUserId, currentProfile, setCurrentUser } = useStore()
  const { showToast } = useToast()
  const [open, setOpen] = useState(false)
  const [nickEditing, setNickEditing] = useState(false)
  const [nickInput, setNickInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [loggingIn, setLoggingIn] = useState(false)

  // 카카오 페이지에서 뒤로 왔을 때 스피너 리셋
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') setLoggingIn(false)
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
        // Auth state 변화 감지
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
        console.warn('[UserMenu] Auth init failed (Supabase env may not be set):', e)
      }
    }
    init()
    return () => { mounted = false }
  }, [setCurrentUser])

  const loginWithKakao = async () => {
    setLoggingIn(true)
    try {
      const supabase = getBrowserClient()
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'kakao',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          scopes: 'profile nickname', // account_email 제외 (비즈니스 앱 심사 불필요)
        },
      })
      if (error) throw error
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : '로그인 실패. Supabase Kakao provider 설정을 확인하세요.', 'err')
      setLoggingIn(false)
    }
  }

  const logout = async () => {
    try {
      const supabase = getBrowserClient()
      await supabase.auth.signOut()
      setCurrentUser(null, null)
      setOpen(false)
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

  /* 비로그인 상태 — Kakao 로그인 버튼 */
  if (!currentUserId) {
    return (
      <button onClick={loginWithKakao} disabled={loggingIn}
        title="카카오 로그인"
        className="mono"
        style={{
          background: '#FEE500', color: '#000', border: 'none',
          padding: '0.4rem 0.7rem', cursor: loggingIn ? 'wait' : 'pointer',
          fontSize: '0.6rem', letterSpacing: '0.05em', fontWeight: 600,
          textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.3rem',
        }}>
        {loggingIn ? <span className="spinner" style={{ borderTopColor: '#000' }} /> : '💬'}
        Kakao
      </button>
    )
  }

  /* 로그인 상태 — 닉네임 표시 + 메뉴 */
  return (
    <>
      <button onClick={() => setOpen(true)} className="mono"
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

      {open && (
        <div onClick={() => !saving && setOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div onClick={(e) => e.stopPropagation()}
            style={{ background: 'var(--c2)', border: '1px solid var(--gold)', maxWidth: 400, width: '100%' }}>
            <div style={{ padding: '0.85rem 1.25rem', borderBottom: '1px solid var(--bd)' }}>
              <p className="mono" style={{ fontSize: '0.65rem', color: 'var(--gold)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                👤 프로필
              </p>
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
                    {saving ? <span className="spinner" style={{ borderTopColor: '#000' }} /> : null}저장
                  </button>
                ) : (
                  <button className="btn-ghost" style={{ fontSize: '0.7rem' }} onClick={() => setOpen(false)}>닫기</button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
