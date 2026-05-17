---
title: Oak Whisky Visual Search
emoji: 🥃
colorFrom: yellow
colorTo: indigo
sdk: docker
app_port: 7860
pinned: false
---

# Oak — Whisky Visual Search ML Service

라벨 사진 → **YOLOv8**(검출/크롭) → **PaddleOCR**(텍스트) → **OpenCLIP**(임베딩) → **FAISS**(레퍼런스 유사 검색).

레퍼런스 = 내 아카이브(`whisky_logs`) + 뉴스 수집분(`news_bookmarks`)의 보틀 이미지.

이 Space는 Next.js 앱(`/api/visual-search`)이 HTTP로 호출하며, 미설정/실패 시 앱이 Gemini OCR로 자동 폴백합니다.

## 엔드포인트
| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/health` | 상태 + 인덱스 벡터 수 |
| POST | `/analyze` (multipart `image`) | 크롭·OCR·임베딩 + FAISS 매칭 |
| POST | `/reindex` (헤더 `X-Index-Token`) | 인덱스 재빌드 |

## HF Space Secrets (Settings → Variables and secrets)
| 이름 | 값 |
|---|---|
| `SUPABASE_URL` | `https://xxxx.supabase.co` |
| `SUPABASE_SERVICE_KEY` | Supabase service_role 키 |
| `INDEX_TOKEN` | 임의 문자열 (Next.js `ML_SERVICE_TOKEN`과 동일) |
| `ALLOW_ORIGINS` | `https://dram-app.vercel.app` |
| `BUILD_INDEX_ON_START` | `1` (부팅 시 인덱스 자동 빌드) |

> 무료 CPU Space는 파일시스템이 휘발성이라 재시작 시 인덱스가 사라집니다.
> `BUILD_INDEX_ON_START=1` 이면 부팅 때 Supabase에서 다시 빌드합니다(초기 수십 초~수 분).

## 로컬 실행
```bash
cd ml-service
pip install -r requirements.txt
cp .env.example .env   # SUPABASE 값 입력
python build_index.py
python app.py           # http://localhost:7860
```

## 정확도 메모
- `yolov8n.pt`(범용). 위스키 병/라벨 전용 가중치를 `pipeline._get_yolo()`에 지정하면 향상.
- PaddleOCR `lang="en"` 기본. 일/한 라벨 비중 높으면 `lang="ml"`.
- 레퍼런스가 적을수록 매칭 신뢰도 낮음 — 아카이브/북마크가 쌓일수록 강해짐.
