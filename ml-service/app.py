"""
위스키 비주얼 검색 ML 서비스 (FastAPI)

  POST /analyze   이미지 → YOLOv8 크롭 · PaddleOCR 텍스트 · OpenCLIP 임베딩
                  + FAISS로 레퍼런스(내 아카이브/뉴스) 유사 보틀 검색
  GET  /health    상태 + 인덱스 통계
  POST /reindex   인덱스 재빌드 트리거 (관리용, INDEX_TOKEN 보호)

Next.js(/api/visual-search)가 이 서비스를 호출하고,
서비스 불가 시 기존 Gemini OCR로 폴백.
"""
from __future__ import annotations

import os
import subprocess
import sys

from fastapi import FastAPI, File, UploadFile, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware

import pipeline
import index_store

app = FastAPI(title="Oak Whisky Visual Search", version="1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("ALLOW_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)

INDEX_TOKEN = os.getenv("INDEX_TOKEN", "")


@app.on_event("startup")
def _startup():
    index_store.load()


@app.get("/health")
def health():
    return {"status": "ok", "index": index_store.stats()}


@app.post("/analyze")
async def analyze(image: UploadFile = File(...), k: int = 5):
    if not image.content_type or not image.content_type.startswith("image/"):
        raise HTTPException(400, "image file required")
    data = await image.read()
    if not data:
        raise HTTPException(400, "empty image")

    res = pipeline.analyze(data)
    matches = index_store.search(res.embedding, k=k) if res.embedding else []

    return {
        "detected": res.detected,
        "box": res.box,
        "ocr_text": res.ocr_text,
        "ocr_lines": res.ocr_lines,
        "matches": matches,            # 레퍼런스 유사 보틀 (similarity 0~1)
        "embedding_dim": len(res.embedding),
    }


@app.post("/reindex")
def reindex(x_index_token: str | None = Header(default=None)):
    if INDEX_TOKEN and x_index_token != INDEX_TOKEN:
        raise HTTPException(401, "invalid token")
    # 별도 프로세스로 빌드 (메모리 분리)
    proc = subprocess.Popen([sys.executable, "build_index.py"])
    return {"status": "reindex started", "pid": proc.pid}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=int(os.getenv("PORT", "7860")))
