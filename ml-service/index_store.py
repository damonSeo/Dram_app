"""
FAISS 벡터 인덱스 저장/검색.
인덱스 파일과 메타데이터(JSON) 사이드카를 함께 관리.
레퍼런스 = 내 아카이브(whisky_logs) + 뉴스 수집분(news_bookmarks) 보틀 이미지.
"""
from __future__ import annotations

import json
import os
import threading

import numpy as np

INDEX_PATH = os.getenv("FAISS_INDEX_PATH", "data/whisky.index")
META_PATH = os.getenv("FAISS_META_PATH", "data/whisky_meta.json")
EMBED_DIM = 512

_lock = threading.Lock()
_index = None
_meta: list[dict] = []


def _ensure_dirs():
    os.makedirs(os.path.dirname(INDEX_PATH) or ".", exist_ok=True)


def load():
    """디스크에서 인덱스+메타 로드. 없으면 빈 인덱스."""
    global _index, _meta
    import faiss
    with _lock:
        if os.path.exists(INDEX_PATH) and os.path.exists(META_PATH):
            _index = faiss.read_index(INDEX_PATH)
            with open(META_PATH, "r", encoding="utf-8") as f:
                _meta = json.load(f)
        else:
            # 코사인 유사도 = 정규화 벡터 + 내적
            _index = faiss.IndexFlatIP(EMBED_DIM)
            _meta = []
    return _index, _meta


def _get():
    global _index
    if _index is None:
        load()
    return _index, _meta


def rebuild(vectors: np.ndarray, metas: list[dict]):
    """전체 인덱스 재구축 후 디스크 저장."""
    global _index, _meta
    import faiss
    _ensure_dirs()
    with _lock:
        idx = faiss.IndexFlatIP(EMBED_DIM)
        if len(vectors):
            idx.add(vectors.astype("float32"))
        faiss.write_index(idx, INDEX_PATH)
        with open(META_PATH, "w", encoding="utf-8") as f:
            json.dump(metas, f, ensure_ascii=False)
        _index, _meta = idx, metas
    return idx.ntotal


def search(vec: list[float], k: int = 5) -> list[dict]:
    """쿼리 임베딩과 가장 가까운 레퍼런스 보틀 k개."""
    idx, meta = _get()
    if idx is None or idx.ntotal == 0 or not vec:
        return []
    q = np.array([vec], dtype="float32")
    sims, ids = idx.search(q, min(k, idx.ntotal))
    out: list[dict] = []
    for sim, i in zip(sims[0], ids[0]):
        if i < 0 or i >= len(meta):
            continue
        m = dict(meta[i])
        m["similarity"] = round(float(sim), 4)  # 0~1 (정규화 내적)
        out.append(m)
    return out


def stats() -> dict:
    idx, meta = _get()
    return {"count": int(idx.ntotal) if idx is not None else 0, "meta": len(meta)}
