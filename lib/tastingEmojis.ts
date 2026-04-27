/* 위스키/스피릿 시음 키워드 카탈로그 — 이모지 + 한글 라벨로 시인성 강화 */

export interface TasteKey { emoji: string; label: string }

/* Nose 향 */
export const NOSE_KEYS: TasteKey[] = [
  // 과일
  { emoji: '🍎', label: '사과' },
  { emoji: '🍐', label: '서양배' },
  { emoji: '🍑', label: '복숭아' },
  { emoji: '🍊', label: '오렌지 껍질' },
  { emoji: '🍋', label: '레몬' },
  { emoji: '🍒', label: '체리' },
  { emoji: '🍇', label: '포도' },
  { emoji: '🍌', label: '바나나' },
  { emoji: '🍍', label: '파인애플' },
  { emoji: '🥭', label: '망고' },
  { emoji: '🫐', label: '베리류' },
  { emoji: '🍓', label: '딸기' },
  // 견과/꿀/곡물
  { emoji: '🥜', label: '견과류' },
  { emoji: '🌰', label: '구운 밤' },
  { emoji: '🍯', label: '꿀' },
  { emoji: '🌾', label: '곡물' },
  { emoji: '🥖', label: '갓 구운 빵' },
  // 꽃/허브
  { emoji: '🌸', label: '꽃향' },
  { emoji: '🌹', label: '장미' },
  { emoji: '🌿', label: '허브' },
  { emoji: '🌱', label: '풀잎' },
  { emoji: '🍃', label: '민트' },
  // 향신/오크
  { emoji: '🌶️', label: '후추' },
  { emoji: '🍂', label: '낙엽' },
  { emoji: '🪵', label: '오크' },
  { emoji: '☕', label: '커피' },
  { emoji: '🍫', label: '초콜릿' },
  { emoji: '🍬', label: '캐러멜' },
  { emoji: '🥥', label: '코코넛' },
  { emoji: '🧂', label: '바닐라' },
  { emoji: '🌰', label: '토피' },
  // 셰리/와인
  { emoji: '🍷', label: '셰리' },
  { emoji: '🍇', label: '건포도' },
  { emoji: '🍑', label: '건자두' },
  // 피트/스모키
  { emoji: '🔥', label: '피트' },
  { emoji: '💨', label: '스모크' },
  { emoji: '🌊', label: '바닷내음' },
  { emoji: '🧴', label: '요오드' },
  { emoji: '🩹', label: '요오드 약품' },
]

/* Palate 맛 */
export const PALATE_KEYS: TasteKey[] = [
  { emoji: '🍯', label: '꿀단 단맛' },
  { emoji: '🍬', label: '캐러멜' },
  { emoji: '🍫', label: '다크 초콜릿' },
  { emoji: '☕', label: '커피' },
  { emoji: '🌶️', label: '스파이시' },
  { emoji: '🧂', label: '짠맛' },
  { emoji: '🍋', label: '시트러스' },
  { emoji: '🍎', label: '사과' },
  { emoji: '🍐', label: '서양배' },
  { emoji: '🍑', label: '복숭아' },
  { emoji: '🍓', label: '베리' },
  { emoji: '🍇', label: '건포도' },
  { emoji: '🥜', label: '견과류' },
  { emoji: '🥥', label: '코코넛' },
  { emoji: '🌰', label: '토피' },
  { emoji: '🪵', label: '오크' },
  { emoji: '🔥', label: '피트' },
  { emoji: '💨', label: '스모크' },
  { emoji: '🌊', label: '브리니' },
  { emoji: '🍷', label: '셰리' },
  { emoji: '🍯', label: '바닐라' },
  { emoji: '🥧', label: '커스터드' },
  { emoji: '🧈', label: '버터' },
  { emoji: '🥛', label: '크리미' },
  { emoji: '🌿', label: '허브' },
  { emoji: '🍃', label: '민트' },
  { emoji: '🍊', label: '오렌지' },
  { emoji: '⚡', label: '쨍한 산미' },
  { emoji: '💪', label: '풀바디' },
  { emoji: '🪶', label: '라이트 바디' },
]

/* Finish 여운 */
export const FINISH_KEYS: TasteKey[] = [
  { emoji: '⏳', label: '긴 여운' },
  { emoji: '⏱️', label: '짧은 여운' },
  { emoji: '🌶️', label: '스파이시 피니시' },
  { emoji: '🔥', label: '피트 여운' },
  { emoji: '💨', label: '스모키 여운' },
  { emoji: '🍯', label: '단 여운' },
  { emoji: '🍫', label: '초콜릿' },
  { emoji: '☕', label: '커피' },
  { emoji: '🪵', label: '오크' },
  { emoji: '🌊', label: '브리니' },
  { emoji: '🍋', label: '시트러스' },
  { emoji: '🌶️', label: '드라이' },
  { emoji: '🧂', label: '미네랄' },
  { emoji: '🥜', label: '너트' },
  { emoji: '🍂', label: '낙엽' },
  { emoji: '🌶️', label: '후추' },
  { emoji: '🍷', label: '셰리' },
  { emoji: '🥥', label: '코코넛' },
  { emoji: '🌰', label: '토피' },
  { emoji: '🌿', label: '허브' },
  { emoji: '🧈', label: '부드러운' },
  { emoji: '⚡', label: '톡 쏘는' },
]

export const KEY_MAP: Record<'nose'|'palate'|'finish', TasteKey[]> = {
  nose: NOSE_KEYS,
  palate: PALATE_KEYS,
  finish: FINISH_KEYS,
}

/* 라벨에 매칭되는 이모지 검색 (AI 추출 키워드를 시각화할 때 사용) */
export function findEmojiForLabel(label: string, field: 'nose'|'palate'|'finish'): string | null {
  const lower = label.toLowerCase().trim()
  for (const k of KEY_MAP[field]) {
    if (k.label.toLowerCase() === lower || lower.includes(k.label.toLowerCase())) return k.emoji
  }
  // 영어 키워드 폴백
  const FALLBACK: Record<string, string> = {
    vanilla:'🧂', honey:'🍯', oak:'🪵', smoke:'💨', peat:'🔥', sherry:'🍷', citrus:'🍋',
    chocolate:'🍫', coffee:'☕', caramel:'🍬', spice:'🌶️', spicy:'🌶️', fruit:'🍑', floral:'🌸',
    nutty:'🥜', salt:'🧂', briny:'🌊', dry:'🌶️', sweet:'🍯', long:'⏳', short:'⏱️',
  }
  for (const [k, e] of Object.entries(FALLBACK)) {
    if (lower.includes(k)) return e
  }
  return null
}
