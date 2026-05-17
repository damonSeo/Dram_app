# Oak — Whisky Visual Search ML Service

라벨 사진 → **YOLOv8**(검출/크롭) → **PaddleOCR**(텍스트) → **OpenCLIP**(임베딩) → **FAISS**(레퍼런스 유사 검색).

레퍼런스 데이터셋 = 내 아카이브(`whisky_logs`) + 뉴스 수집분(`news_bookmarks`)의 보틀 이미지.

> ⚠️ 이 스택은 Python/PyTorch 기반이라 **Vercel 서버리스에서 실행 불가**. 별도 호스트(Modal/HF Spaces/VPS/Render 등)에 띄우고 Next.js가 HTTP로 호출합니다. 호스팅은 미정 — 아래는 로컬/도커 실행 기준.

## 로컬 실행

```bash
cd ml-service
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # SUPABASE_URL / SUPABASE_SERVICE_KEY 채우기

python build_index.py  # 레퍼런스 인덱스 1회 구축 (data/whisky.index)
python app.py          # http://localhost:8000
```

## 도커

```bash
docker build -t oak-ml ./ml-service
docker run -p 8000:8000 --env-file ml-service/.env -v $PWD/ml-data:/srv/data oak-ml
docker exec <id> python build_index.py   # 인덱스 빌드
```

## 엔드포인트

| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/health` | 상태 + 인덱스 벡터 수 |
| POST | `/analyze` (multipart `image`) | 크롭·OCR·임베딩 + FAISS 매칭 결과 |
| POST | `/reindex` (헤더 `X-Index-Token`) | 인덱스 재빌드 트리거 |

`/analyze` 응답 예:
```json
{
  "detected": true,
  "box": [x1,y1,x2,y2],
  "ocr_text": "GLENFARCLAS 25 YEARS",
  "ocr_lines": ["GLENFARCLAS","25 YEARS OLD","43%"],
  "matches": [
    {"name":"Glenfarclas 25","source":"archive","ref_id":"...","similarity":0.91,"image_url":"..."}
  ],
  "embedding_dim": 512
}
```

## Next.js 연동

- Vercel 환경변수 `ML_SERVICE_URL` = 이 서비스 공개 URL (+ 선택 `ML_SERVICE_TOKEN`)
- 프런트는 `/api/visual-search` 호출
  - `ML_SERVICE_URL` 있으면 → 이 서비스 사용 (OCR 텍스트 + 유사 보틀)
  - 없거나 실패 → 기존 Gemini OCR(`/api/ocr`)로 자동 폴백
- 인덱스 갱신: 새 보틀/북마크가 쌓이면 `/reindex` 주기 호출(예: 일 1회 cron)

## 정확도 메모

- `yolov8n.pt`는 범용. 위스키 병/라벨 전용 데이터로 파인튜닝한 가중치를 `pipeline._get_yolo()`에 지정하면 검출 정확도 향상.
- PaddleOCR `lang="en"` 기본. 일본/한글 라벨 비중 높으면 `lang="ml"`(multilingual).
- 레퍼런스가 적을수록 FAISS 매칭 신뢰도 낮음 — 아카이브/북마크가 쌓일수록 강해짐.
