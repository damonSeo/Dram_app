/**
 * 점수 표시 유틸 — 내부 저장은 0–10 (소수점 1자리),
 * UI에는 /10 와 /100 둘 다 보여줌 (whiskynotes.be 식 호환).
 *
 * 7.5 → 75/100,  8.0 → 80/100,  9.2 → 92/100
 * 환산은 단순 ×10 — 직관적이고 손실 없음.
 */
export function scoreToHundred(score: number | null | undefined): number {
  if (typeof score !== 'number' || isNaN(score)) return 0
  return Math.round(score * 10)
}

/** "★ 8.5/10 · 85/100" 처럼 한 줄로 보여줄 때 */
export function formatScoreFull(score: number | null | undefined): string {
  const ten = typeof score === 'number' ? score.toFixed(1) : '—'
  const hundred = scoreToHundred(score)
  return `★ ${ten}/10 · ${hundred}/100`
}

/** 컴팩트 — "8.5/10 (85)" */
export function formatScoreCompact(score: number | null | undefined): string {
  if (typeof score !== 'number') return '—'
  return `${score.toFixed(1)}/10 · ${scoreToHundred(score)}/100`
}
