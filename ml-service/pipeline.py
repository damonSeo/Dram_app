"""
위스키 라벨 비주얼 검색 파이프라인
  Detection : YOLOv8   (병/라벨 영역 검출 → 크롭)
  OCR       : PaddleOCR (라벨 텍스트 추출, 위스키에 강함)
  Embedding : OpenCLIP  (크롭 이미지 → 벡터)
모델은 프로세스당 1회 lazy-load 후 재사용.
"""
from __future__ import annotations

import io
import threading
from dataclasses import dataclass, field

import numpy as np
from PIL import Image

# ── 모델 lazy singleton ────────────────────────────────────────────────
_lock = threading.Lock()
_yolo = None
_ocr = None
_clip = None  # (model, preprocess, tokenizer, device)


def _get_yolo():
    global _yolo
    if _yolo is None:
        with _lock:
            if _yolo is None:
                from ultralytics import YOLO
                # yolov8n: 가벼움. 전용 라벨 학습 가중치가 있으면 경로 교체.
                _yolo = YOLO("yolov8n.pt")
    return _yolo


def _get_ocr():
    global _ocr
    if _ocr is None:
        with _lock:
            if _ocr is None:
                from paddleocr import PaddleOCR
                # 영문 위주 라벨. 다국어 필요 시 lang='ml'.
                _ocr = PaddleOCR(use_angle_cls=True, lang="en", show_log=False)
    return _ocr


def _get_clip():
    global _clip
    if _clip is None:
        with _lock:
            if _clip is None:
                import torch
                import open_clip
                device = "cuda" if torch.cuda.is_available() else "cpu"
                model, _, preprocess = open_clip.create_model_and_transforms(
                    "ViT-B-32", pretrained="laion2b_s34b_b79k"
                )
                model = model.to(device).eval()
                tokenizer = open_clip.get_tokenizer("ViT-B-32")
                _clip = (model, preprocess, tokenizer, device)
    return _clip


# CLIP ViT-B-32 임베딩 차원
EMBED_DIM = 512


@dataclass
class AnalysisResult:
    ocr_text: str = ""
    ocr_lines: list[str] = field(default_factory=list)
    detected: bool = False
    box: list[float] | None = None          # [x1,y1,x2,y2] (원본 좌표)
    embedding: list[float] = field(default_factory=list)


def _load_image(data: bytes) -> Image.Image:
    return Image.open(io.BytesIO(data)).convert("RGB")


def detect_and_crop(img: Image.Image) -> tuple[Image.Image, list[float] | None, bool]:
    """YOLOv8로 가장 큰 객체(병/라벨 추정)를 크롭. 실패 시 원본 반환."""
    try:
        model = _get_yolo()
        res = model.predict(np.array(img), verbose=False, conf=0.25)[0]
        if res.boxes is None or len(res.boxes) == 0:
            return img, None, False
        # 면적이 가장 큰 박스 = 병으로 가정
        xyxy = res.boxes.xyxy.cpu().numpy()
        areas = (xyxy[:, 2] - xyxy[:, 0]) * (xyxy[:, 3] - xyxy[:, 1])
        b = xyxy[int(areas.argmax())]
        x1, y1, x2, y2 = [float(v) for v in b]
        # 라벨 여백 약간 포함
        crop = img.crop((max(0, x1), max(0, y1), x2, y2))
        return crop, [x1, y1, x2, y2], True
    except Exception:
        return img, None, False


def run_ocr(img: Image.Image) -> tuple[str, list[str]]:
    """PaddleOCR로 라벨 텍스트 추출."""
    try:
        ocr = _get_ocr()
        out = ocr.ocr(np.array(img), cls=True)
        lines: list[str] = []
        for page in out or []:
            for item in page or []:
                txt = item[1][0] if item and item[1] else ""
                if txt and txt.strip():
                    lines.append(txt.strip())
        return " ".join(lines), lines
    except Exception:
        return "", []


def embed(img: Image.Image) -> list[float]:
    """OpenCLIP 이미지 임베딩 (L2 정규화)."""
    try:
        import torch
        model, preprocess, _, device = _get_clip()
        with torch.no_grad():
            x = preprocess(img).unsqueeze(0).to(device)
            v = model.encode_image(x)
            v = v / v.norm(dim=-1, keepdim=True)
        return v.cpu().numpy().astype("float32").flatten().tolist()
    except Exception:
        return []


def analyze(data: bytes) -> AnalysisResult:
    img = _load_image(data)
    crop, box, detected = detect_and_crop(img)
    text, lines = run_ocr(crop)
    vec = embed(crop)
    return AnalysisResult(
        ocr_text=text,
        ocr_lines=lines,
        detected=detected,
        box=box,
        embedding=vec,
    )
