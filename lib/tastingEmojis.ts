/* 위스키/스피릿 시음 키워드 카탈로그 — 이모지 + 한글 라벨로 시인성 강화 */

export interface TasteKey { emoji: string; label: string }

/* Nose 향 */
export const NOSE_KEYS: TasteKey[] = [
  // 신선한 과일
  { emoji: '🍎', label: '사과' },
  { emoji: '🍏', label: '풋사과' },
  { emoji: '🍐', label: '서양배' },
  { emoji: '🍑', label: '복숭아' },
  { emoji: '🍊', label: '오렌지 껍질' },
  { emoji: '🍋', label: '레몬' },
  { emoji: '🍈', label: '멜론' },
  { emoji: '🍒', label: '체리' },
  { emoji: '🍇', label: '청포도' },
  { emoji: '🍌', label: '바나나' },
  { emoji: '🍍', label: '파인애플' },
  { emoji: '🥭', label: '망고' },
  { emoji: '🫐', label: '블루베리' },
  { emoji: '🍓', label: '딸기' },
  { emoji: '🍉', label: '수박' },
  { emoji: '🥝', label: '키위' },
  { emoji: '🍈', label: '잘 익은 참외' },
  // 말린/조린 과일
  { emoji: '🍇', label: '건포도' },
  { emoji: '🍑', label: '건자두' },
  { emoji: '🍊', label: '말린 살구' },
  { emoji: '🫙', label: '마멀레이드' },
  { emoji: '🍓', label: '베리 잼' },
  { emoji: '🍯', label: '무화과' },
  { emoji: '🍫', label: '대추야자' },
  // 견과/곡물/베이커리
  { emoji: '🥜', label: '땅콩' },
  { emoji: '🌰', label: '구운 밤' },
  { emoji: '🌰', label: '아몬드' },
  { emoji: '🌰', label: '헤이즐넛' },
  { emoji: '🌾', label: '곡물' },
  { emoji: '🌾', label: '보리' },
  { emoji: '🥖', label: '갓 구운 빵' },
  { emoji: '🍪', label: '비스킷' },
  { emoji: '🥐', label: '버터 페이스트리' },
  { emoji: '🥣', label: '오트밀' },
  { emoji: '🍮', label: '커스터드' },
  // 단맛/디저트
  { emoji: '🍯', label: '꿀' },
  { emoji: '🍬', label: '캐러멜' },
  { emoji: '🌰', label: '토피' },
  { emoji: '🧂', label: '바닐라' },
  { emoji: '🍫', label: '밀크 초콜릿' },
  { emoji: '🍫', label: '다크 초콜릿' },
  { emoji: '🥥', label: '코코넛' },
  { emoji: '🍿', label: '버터스카치' },
  { emoji: '🍦', label: '바닐라 아이스크림' },
  { emoji: '🍰', label: '스펀지케이크' },
  // 꽃/허브/풀
  { emoji: '🌸', label: '꽃향' },
  { emoji: '🌹', label: '장미' },
  { emoji: '💜', label: '라벤더' },
  { emoji: '🌼', label: '엘더플라워' },
  { emoji: '🍯', label: '히더 꿀' },
  { emoji: '🌿', label: '허브' },
  { emoji: '🌱', label: '풀잎' },
  { emoji: '🍃', label: '민트' },
  { emoji: '🌿', label: '유칼립투스' },
  { emoji: '🍵', label: '녹차' },
  { emoji: '🌾', label: '건초' },
  // 향신료/우디
  { emoji: '🌶️', label: '후추' },
  { emoji: '🫚', label: '생강' },
  { emoji: '🍂', label: '계피' },
  { emoji: '⭐', label: '정향' },
  { emoji: '🌰', label: '육두구' },
  { emoji: '🪵', label: '오크' },
  { emoji: '🪵', label: '삼나무' },
  { emoji: '🖍️', label: '연필심' },
  { emoji: '📦', label: '오래된 가구' },
  { emoji: '🍂', label: '낙엽' },
  { emoji: '☕', label: '커피' },
  { emoji: '🚬', label: '담뱃잎' },
  { emoji: '🟤', label: '가죽' },
  // 셰리/와인
  { emoji: '🍷', label: '셰리' },
  { emoji: '🍷', label: '올로로소' },
  { emoji: '🍷', label: 'PX 셰리' },
  { emoji: '🍷', label: '레드와인' },
  { emoji: '🍷', label: '포트' },
  { emoji: '🥃', label: '럼' },
  { emoji: '🍷', label: '마데이라' },
  // 피트/스모키/해양
  { emoji: '🔥', label: '피트' },
  { emoji: '💨', label: '스모크' },
  { emoji: '🪵', label: '모닥불' },
  { emoji: '🥓', label: '훈제 베이컨' },
  { emoji: '🩹', label: '소독약' },
  { emoji: '🌊', label: '바닷내음' },
  { emoji: '🧂', label: '소금기' },
  { emoji: '🧴', label: '요오드' },
  { emoji: '🪨', label: '미네랄' },
  { emoji: '🌫️', label: '재' },
  // 기타
  { emoji: '🧈', label: '버터' },
  { emoji: '🥛', label: '크림' },
  { emoji: '🧀', label: '치즈' },
  { emoji: '🍳', label: '유황(성냥)' },
  { emoji: '⛽', label: '왁스' },
  { emoji: '🪙', label: '금속' },
  { emoji: '🌧️', label: '젖은 흙' },
  { emoji: '🍄', label: '버섯' },
]

/* Palate 맛 */
export const PALATE_KEYS: TasteKey[] = [
  // 단맛
  { emoji: '🍯', label: '꿀 단맛' },
  { emoji: '🍬', label: '캐러멜' },
  { emoji: '🌰', label: '토피' },
  { emoji: '🍿', label: '버터스카치' },
  { emoji: '🧂', label: '바닐라' },
  { emoji: '🍫', label: '다크 초콜릿' },
  { emoji: '🍫', label: '밀크 초콜릿' },
  { emoji: '🍮', label: '커스터드' },
  { emoji: '🍰', label: '케이크' },
  { emoji: '🥧', label: '과일 파이' },
  { emoji: '🍪', label: '진저브레드' },
  // 과일
  { emoji: '🍋', label: '시트러스' },
  { emoji: '🍊', label: '오렌지' },
  { emoji: '🍎', label: '사과' },
  { emoji: '🍏', label: '풋사과' },
  { emoji: '🍐', label: '서양배' },
  { emoji: '🍑', label: '복숭아' },
  { emoji: '🍓', label: '베리' },
  { emoji: '🫐', label: '블랙커런트' },
  { emoji: '🍇', label: '건포도' },
  { emoji: '🍒', label: '체리' },
  { emoji: '🍌', label: '바나나' },
  { emoji: '🍍', label: '열대과일' },
  { emoji: '🥭', label: '망고' },
  { emoji: '🍊', label: '말린 살구' },
  { emoji: '🍑', label: '건자두' },
  { emoji: '🫙', label: '마멀레이드' },
  // 향신/우디
  { emoji: '🌶️', label: '스파이시' },
  { emoji: '🌶️', label: '후추' },
  { emoji: '🫚', label: '생강' },
  { emoji: '🍂', label: '계피' },
  { emoji: '⭐', label: '정향' },
  { emoji: '🪵', label: '오크' },
  { emoji: '🪵', label: '타닌' },
  { emoji: '🟤', label: '가죽' },
  { emoji: '☕', label: '에스프레소' },
  { emoji: '🚬', label: '담배' },
  // 견과/곡물/유제품
  { emoji: '🥜', label: '견과류' },
  { emoji: '🌰', label: '아몬드' },
  { emoji: '🥥', label: '코코넛' },
  { emoji: '🌾', label: '맥아' },
  { emoji: '🍪', label: '비스킷' },
  { emoji: '🧈', label: '버터' },
  { emoji: '🥛', label: '크리미' },
  { emoji: '🍦', label: '바닐라 크림' },
  { emoji: '🧀', label: '치즈' },
  // 셰리/와인
  { emoji: '🍷', label: '셰리' },
  { emoji: '🍷', label: 'PX 단맛' },
  { emoji: '🍷', label: '레드와인' },
  { emoji: '🍷', label: '포트' },
  { emoji: '🥃', label: '럼' },
  // 피트/해양
  { emoji: '🔥', label: '피트' },
  { emoji: '💨', label: '스모크' },
  { emoji: '🥓', label: '훈제' },
  { emoji: '🌊', label: '브리니' },
  { emoji: '🧂', label: '짠맛' },
  { emoji: '🪨', label: '미네랄' },
  { emoji: '🩹', label: '소독약' },
  // 허브/꽃
  { emoji: '🌿', label: '허브' },
  { emoji: '🍃', label: '민트' },
  { emoji: '🌸', label: '꽃' },
  // 질감/구조
  { emoji: '⚡', label: '쨍한 산미' },
  { emoji: '💪', label: '풀바디' },
  { emoji: '🪶', label: '라이트 바디' },
  { emoji: '🛢️', label: '오일리' },
  { emoji: '🌾', label: '드라이' },
  { emoji: '🥄', label: '두툼한 질감' },
  { emoji: '🫧', label: '매끄러운' },
  { emoji: '🔪', label: '날카로운' },
  { emoji: '🌶️', label: '알코올 화함' },
]

/* Finish 여운 */
export const FINISH_KEYS: TasteKey[] = [
  // 길이/강도
  { emoji: '⏳', label: '긴 여운' },
  { emoji: '⏱️', label: '짧은 여운' },
  { emoji: '➰', label: '중간 길이' },
  { emoji: '♾️', label: '끝없이 이어지는' },
  { emoji: '🌬️', label: '여운이 빠르게 사라짐' },
  // 풍미
  { emoji: '🍯', label: '단 여운' },
  { emoji: '🍫', label: '초콜릿' },
  { emoji: '☕', label: '커피' },
  { emoji: '🌰', label: '토피' },
  { emoji: '🍬', label: '캐러멜' },
  { emoji: '🥥', label: '코코넛' },
  { emoji: '🥜', label: '너트' },
  { emoji: '🧂', label: '바닐라' },
  { emoji: '🪵', label: '오크' },
  { emoji: '🪵', label: '타닌' },
  { emoji: '🟤', label: '가죽' },
  { emoji: '🚬', label: '담배' },
  { emoji: '🍋', label: '시트러스' },
  { emoji: '🍊', label: '오렌지 껍질' },
  { emoji: '🍓', label: '베리' },
  { emoji: '🍇', label: '건포도' },
  { emoji: '🍷', label: '셰리' },
  { emoji: '🍷', label: '포트' },
  { emoji: '🌿', label: '허브' },
  { emoji: '🍃', label: '민트' },
  { emoji: '🍂', label: '낙엽' },
  // 향신/드라이
  { emoji: '🌶️', label: '스파이시 피니시' },
  { emoji: '🌶️', label: '후추' },
  { emoji: '🫚', label: '생강' },
  { emoji: '🍂', label: '계피' },
  { emoji: '🌾', label: '드라이' },
  { emoji: '🪨', label: '미네랄' },
  // 피트/해양
  { emoji: '🔥', label: '피트 여운' },
  { emoji: '💨', label: '스모키 여운' },
  { emoji: '🪵', label: '잿내' },
  { emoji: '🌊', label: '브리니' },
  { emoji: '🧂', label: '소금기' },
  { emoji: '🩹', label: '소독약' },
  // 질감/인상
  { emoji: '🧈', label: '부드러운' },
  { emoji: '⚡', label: '톡 쏘는' },
  { emoji: '🔥', label: '뜨겁게 타는' },
  { emoji: '🌶️', label: '얼얼한' },
  { emoji: '🫧', label: '깔끔한' },
  { emoji: '😋', label: '군침 도는' },
  { emoji: '🥃', label: '따뜻한' },
  { emoji: '🪶', label: '가벼운' },
  { emoji: '💪', label: '묵직한' },
  { emoji: '🍂', label: '쌉싸름한' },
  { emoji: '😖', label: '거친' },
  { emoji: '⚖️', label: '균형 잡힌' },
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
    nutty:'🥜', salt:'🧂', briny:'🌊', dry:'🌾', sweet:'🍯', long:'⏳', short:'⏱️',
    leather:'🟤', tobacco:'🚬', tannin:'🪵', mint:'🍃', herbal:'🌿', toffee:'🌰',
    coconut:'🥥', banana:'🍌', apple:'🍎', pear:'🍐', peach:'🍑', berry:'🍓',
    raisin:'🍇', cinnamon:'🍂', ginger:'🫚', pepper:'🌶️', butter:'🧈', creamy:'🥛',
    malt:'🌾', biscuit:'🍪', port:'🍷', rum:'🥃', mineral:'🪨', ash:'🌫️', wax:'⛽',
  }
  for (const [k, e] of Object.entries(FALLBACK)) {
    if (lower.includes(k)) return e
  }
  return null
}
