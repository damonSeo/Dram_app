#!/usr/bin/env bash
set -e

# HF Spaces 무료 티어는 파일시스템이 휘발성 → 부팅 시 인덱스 재빌드(선택).
# SUPABASE_URL/KEY 가 있고 BUILD_INDEX_ON_START=1 이면 백그라운드로 빌드.
if [ "${BUILD_INDEX_ON_START:-0}" = "1" ] && [ -n "${SUPABASE_URL:-}" ] && [ -n "${SUPABASE_SERVICE_KEY:-}" ]; then
  echo "[entrypoint] building FAISS index from Supabase (background)..."
  python build_index.py &
fi

exec python app.py
