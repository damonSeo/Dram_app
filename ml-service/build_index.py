"""
레퍼런스 FAISS 인덱스 빌더.

소스:
  1) Supabase whisky_logs  — 사용자 아카이브 (image_url 있는 보틀)
  2) Supabase news_bookmarks — 뉴스 수집분 (image 있는 항목)

각 이미지 → YOLOv8 크롭 → OpenCLIP 임베딩 → FAISS 인덱스 + 메타 저장.
주기적으로(예: cron) 재실행해 인덱스를 갱신.

사용:
  python build_index.py
필요 env: SUPABASE_URL, SUPABASE_SERVICE_KEY  (.env 참고)
"""
from __future__ import annotations

import os

import httpx
import numpy as np
from dotenv import load_dotenv

from pipeline import _load_image, detect_and_crop, embed
import index_store

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/")
SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")


def _sb_get(table: str, select: str) -> list[dict]:
    if not SUPABASE_URL or not SERVICE_KEY:
        print(f"[skip] {table}: SUPABASE env 미설정")
        return []
    r = httpx.get(
        f"{SUPABASE_URL}/rest/v1/{table}",
        params={"select": select},
        headers={"apikey": SERVICE_KEY, "Authorization": f"Bearer {SERVICE_KEY}"},
        timeout=30,
    )
    r.raise_for_status()
    return r.json()


def _fetch_image(url: str) -> bytes | None:
    try:
        if url.startswith("data:"):
            import base64
            return base64.b64decode(url.split(",", 1)[1])
        r = httpx.get(url, timeout=20, follow_redirects=True,
                      headers={"User-Agent": "OakIndexBot/1.0"})
        if r.status_code == 200 and r.content:
            return r.content
    except Exception as e:
        print(f"  ! image fetch 실패: {e}")
    return None


def collect() -> list[dict]:
    """레퍼런스 후보 목록 (url + 메타)."""
    items: list[dict] = []

    for r in _sb_get("whisky_logs", "id,brand,region,age,bottler,image_url"):
        if r.get("image_url"):
            items.append({
                "source": "archive",
                "ref_id": r["id"],
                "name": " ".join(filter(None, [r.get("brand"), r.get("age")])).strip() or "Unknown",
                "brand": r.get("brand"),
                "region": r.get("region"),
                "bottler": r.get("bottler"),
                "image_url": r["image_url"],
            })

    try:
        for r in _sb_get("news_bookmarks", "id,title,image,link,source"):
            if r.get("image"):
                items.append({
                    "source": f"news:{r.get('source') or ''}",
                    "ref_id": r["id"],
                    "name": r.get("title") or "Untitled",
                    "link": r.get("link"),
                    "image_url": r["image"],
                })
    except Exception as e:
        print(f"[skip] news_bookmarks: {e}")

    return items


def main():
    cands = collect()
    print(f"레퍼런스 후보 {len(cands)}개 — 임베딩 시작")

    vecs: list[list[float]] = []
    metas: list[dict] = []
    for i, c in enumerate(cands, 1):
        data = _fetch_image(c["image_url"])
        if not data:
            continue
        try:
            img = _load_image(data)
            crop, _, _ = detect_and_crop(img)
            v = embed(crop)
            if not v:
                continue
            vecs.append(v)
            metas.append({k: c[k] for k in c if k != "image_url"} | {"image_url": c["image_url"]})
            if i % 20 == 0:
                print(f"  {i}/{len(cands)} 처리")
        except Exception as e:
            print(f"  ! {c.get('name')}: {e}")

    if not vecs:
        print("임베딩된 항목 없음 — 인덱스 생성 생략")
        return

    arr = np.array(vecs, dtype="float32")
    n = index_store.rebuild(arr, metas)
    print(f"✓ FAISS 인덱스 구축 완료: {n} 벡터 → {index_store.INDEX_PATH}")


if __name__ == "__main__":
    main()
