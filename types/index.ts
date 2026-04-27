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
  date: string
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
export type TabName = 'home' | 'scan' | 'tasting' | 'collection' | 'share' | 'cocktail'

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
