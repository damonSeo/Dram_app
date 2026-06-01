export interface WhiskyLog {
  id: string
  user_id: string
  spirit_type?: SpiritType
  brand: string
  region: string
  bottler: string
  ib_name?: string
  age?: string
  vintage?: string
  distilled_date?: string
  bottled_date?: string
  abv?: string
  casks: string[]
  cask_no?: string
  bottles?: string
  image_url?: string
  color: string
  score: number
  nose?: string
  palate?: string
  finish?: string
  comment?: string
  comment_insta?: string
  blog_post?: string
  insta_post?: string
  /** 재구매 의사: 'yes' = 다시 살래 · 'no' = 안 살래 · 'maybe' = 잘 모르겠어 */
  would_rebuy?: 'yes' | 'no' | 'maybe' | null
  date: string
  created_at: string
  updated_at: string
  /** 시음회 이벤트 연결 (선택) */
  event_id?: string | null
  event_bottle_index?: number | null
}

export interface EventBottle {
  name: string
  distillery?: string
  age?: string
  region?: string
  abv?: string
  bottler?: string
}

export interface TastingEvent {
  id: string
  title: string
  event_date: string          // YYYY-MM-DD
  description: string
  featured_bottles: EventBottle[]
  host_user_id: string | null
  host_nickname?: string
  created_at: string
  updated_at: string
}

export interface OcrResult {
  brand?: string | null
  region?: string | null
  age?: string | null
  vintage?: string | null
  abv?: string | null
  cask?: string | null
  bottler?: string | null
  distilled?: string | null
  bottled?: string | null
  cask_no?: string | null
}

export interface ExtractedKeys {
  nose: string[]
  palate: string[]
  finish: string[]
}

export type SpiritType = 'whisky' | 'bourbon' | 'cognac' | 'cocktail'
export type TabName = 'home' | 'scan' | 'tasting' | 'collection' | 'share' | 'cocktail' | 'search' | 'event' | 'events'

export interface Profile {
  id: string
  nickname: string
  avatar_url?: string | null
  created_at?: string
  updated_at?: string
}

export interface PersonalNote {
  id: string
  user_id: string
  log_id: string
  content: string
  selected_keys: string[]
  author_nickname?: string
  created_at: string
  updated_at: string
}
