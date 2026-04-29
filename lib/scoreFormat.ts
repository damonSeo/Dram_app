/**
 * 점수 시스템 — /100 점제 (whiskynotes.be 호환)
 *
 * 신규 기록은 0~100 정수로 저장.
 * 레거시 기록은 0~10 (소수점) 으로 저장돼 있을 수 있어
 * 화면 표시·필터링 시 자동 정규화함.
 */

/** /100 으로 정규화 — 레거시(0~10) 자동 환산 */
export function toHundred(score: number | null | undefined): number {
  if (typeof score !== 'number' || isNaN(score)) return 0
  // 0보다 크고 10 이하면 레거시 /10 으로 간주 → ×10
  if (score > 0 && score <= 10) return Math.round(score * 10)
  return Math.round(score)
}

/** 5점 만점 별 (0~5) — /100 기준 */
export function toStars(score: number | null | undefined): number {
  return toHundred(score) / 20
}

/** "85 / 100" — 메인 표시 */
export function formatHundred(score: number | null | undefined): string {
  return `${toHundred(score)} / 100`
}

/** 카드 컴팩트 — "85" */
export function formatHundredCompact(score: number | null | undefined): string {
  return `${toHundred(score)}`
}

/* ─── Backward-compat ─── */
export const scoreToHundred = toHundred
