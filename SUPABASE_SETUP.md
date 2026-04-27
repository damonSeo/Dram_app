# Supabase Auth + Profiles + Personal Notes 셋업

이 앱이 카카오 로그인, 닉네임, 개인 노트 기능을 사용하려면
**Supabase 대시보드에서 아래 두 가지를 한 번 해주셔야 합니다**.

---

## 1. SQL 마이그레이션 실행

Supabase 대시보드 → 좌측 사이드바 → **SQL Editor** → **New query** → 아래 전체를 붙여넣고 **Run**:

```sql
-- spirit_type 컬럼 (이미 추가했다면 스킵)
alter table whisky_logs add column if not exists spirit_type text default 'whisky';

-- 1) profiles 테이블
create table if not exists profiles (
  id uuid primary key references auth.users on delete cascade,
  nickname text not null,
  avatar_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table profiles enable row level security;

drop policy if exists "profiles viewable by all" on profiles;
create policy "profiles viewable by all" on profiles for select using (true);

drop policy if exists "users insert own profile" on profiles;
create policy "users insert own profile" on profiles for insert with check (auth.uid() = id);

drop policy if exists "users update own profile" on profiles;
create policy "users update own profile" on profiles for update using (auth.uid() = id);

-- 2) personal_notes (다른 사람의 archive에 남기는 개인 메모)
create table if not exists personal_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  log_id uuid references whisky_logs on delete cascade not null,
  content text default '',
  selected_keys jsonb default '[]'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, log_id)
);
alter table personal_notes enable row level security;

drop policy if exists "personal notes viewable by all" on personal_notes;
create policy "personal notes viewable by all" on personal_notes for select using (true);

drop policy if exists "users manage own personal notes" on personal_notes;
create policy "users manage own personal notes" on personal_notes for all using (auth.uid() = user_id);

-- 3) whisky_logs RLS — 모두 읽기 가능, 본인 것만 수정/삭제
alter table whisky_logs enable row level security;

drop policy if exists "logs viewable by all" on whisky_logs;
create policy "logs viewable by all" on whisky_logs for select using (true);

drop policy if exists "anyone can insert logs" on whisky_logs;
create policy "anyone can insert logs" on whisky_logs for insert with check (true);

drop policy if exists "users update own logs" on whisky_logs;
create policy "users update own logs" on whisky_logs for update
  using (auth.uid()::text = user_id or user_id = 'anonymous');

drop policy if exists "users delete own logs" on whisky_logs;
create policy "users delete own logs" on whisky_logs for delete
  using (auth.uid()::text = user_id or user_id = 'anonymous');
```

---

## 2. Kakao OAuth 설정

### 2-1. Kakao Developers 앱 만들기

1. https://developers.kakao.com → 로그인 → **내 애플리케이션** → **애플리케이션 추가**
2. 앱 이름: `Oak The Record` (자유)
3. 만든 앱 → **앱 설정 → 플랫폼** → **Web 플랫폼 등록**
   - 사이트 도메인: `https://your-vercel-domain.vercel.app` 그리고 `http://localhost:3000`
4. **제품 설정 → 카카오 로그인** → 활성화 ON
5. **Redirect URI** 등록:
   ```
   https://<YOUR-SUPABASE-PROJECT-REF>.supabase.co/auth/v1/callback
   ```
   (Supabase 프로젝트 URL은 Supabase 대시보드 → Settings → API 에서 확인)
6. **제품 설정 → 카카오 로그인 → 동의 항목** → "닉네임" 필수 동의로 설정
7. **앱 설정 → 앱 키** → **REST API 키** 복사
8. **제품 설정 → 보안** → **Client Secret** 생성 → 복사 (활성화 상태로)

### 2-2. Supabase에 Kakao Provider 등록

1. Supabase 대시보드 → **Authentication → Providers**
2. **Kakao** 찾아서 **Enable**
3. 입력:
   - **Client ID** = Kakao REST API 키
   - **Client Secret** = Kakao Client Secret
4. **Save**

### 2-3. Site URL & Redirect URLs 확인

Supabase 대시보드 → **Authentication → URL Configuration**:
- **Site URL**: `https://your-vercel-domain.vercel.app`
- **Redirect URLs**: 아래 둘 모두 추가
  ```
  https://your-vercel-domain.vercel.app/auth/callback
  http://localhost:3000/auth/callback
  ```

---

## 3. 끝! 

앱 우측 상단의 **💬 Kakao** 버튼을 누르면 카카오 로그인 → 자동으로 프로필 생성 → 닉네임 변경 가능.
