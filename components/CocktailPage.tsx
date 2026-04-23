'use client'
import { useStore } from '@/lib/store'

export default function CocktailPage() {
  const { setActiveTab } = useStore()

  return (
    <div className="m-page fade-up" style={{ maxWidth: 720, margin: '0 auto', padding: '3rem 1.5rem' }}>
      <div style={{
        border: '1px solid var(--bd2)',
        background: 'linear-gradient(180deg, rgba(201,168,76,0.08) 0%, rgba(28,28,28,0.95) 100%)',
        padding: '3rem 1.5rem',
        textAlign: 'center',
      }}>
        <p className="display" style={{ fontSize: '3.5rem', color: 'var(--gold)', marginBottom: '0.5rem' }}>🍸</p>
        <p className="mono" style={{ fontSize: '0.6rem', color: 'var(--gold)', letterSpacing: '0.25em', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
          Coming Soon
        </p>
        <h2 className="display" style={{ fontSize: '1.9rem', color: 'var(--tx)', letterSpacing: '0.05em', marginBottom: '1rem' }}>
          Cocktail Archive
        </h2>
        <p style={{ fontSize: '0.88rem', color: 'var(--tx2)', lineHeight: 1.7, maxWidth: 480, margin: '0 auto 1.5rem' }}>
          위스키·와인 베이스 칵테일 레시피와 시음 기록을 담는 공간입니다.
          <br />
          곧 준비해서 선보일게요.
        </p>
        <button className="btn-outline-gold" onClick={() => setActiveTab('home')} style={{ justifyContent: 'center' }}>
          ← 홈으로
        </button>
      </div>

      {/* 예정된 기능 리스트 */}
      <div style={{ marginTop: '1.5rem', border: '1px solid var(--bd)', background: 'var(--c2)' }}>
        <div style={{ padding: '0.7rem 1rem', borderBottom: '1px solid var(--bd)' }}>
          <p className="mono" style={{ fontSize: '0.62rem', color: 'var(--tx2)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            예정된 기능
          </p>
        </div>
        <div style={{ padding: '1rem', display: 'grid', gap: '0.65rem' }}>
          {[
            ['🧪', '클래식 칵테일 레시피 아카이브 (올드패션드, 맨해튼, 사워...)'],
            ['📝', '베이스 스피릿·가니시·재료별 개인 기록'],
            ['⭐', '별점과 한줄평, 사진 저장'],
            ['🔗', '시음한 위스키 노트와 연결해서 추천 페어링'],
          ].map(([icon, text]) => (
            <div key={text} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
              <span style={{ fontSize: '1rem', flexShrink: 0 }}>{icon}</span>
              <p style={{ fontSize: '0.8rem', color: 'var(--tx)', lineHeight: 1.55 }}>{text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
