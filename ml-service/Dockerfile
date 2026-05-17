# 위스키 비주얼 검색 ML 서비스 — Hugging Face Spaces (Docker SDK)
# HF Spaces는 7860 포트 + 비루트 사용자 권장. 무료 CPU 기준.
FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PORT=7860 \
    HF_HOME=/srv/.cache \
    TORCH_HOME=/srv/.cache/torch \
    PADDLEOCR_HOME=/srv/.cache/paddleocr \
    MPLCONFIGDIR=/srv/.cache/mpl

RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 libglib2.0-0 libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# HF Spaces는 uid 1000 사용자로 실행
RUN useradd -m -u 1000 user
WORKDIR /srv

COPY --chown=user requirements.txt .
RUN pip install --upgrade pip && pip install -r requirements.txt

COPY --chown=user . .
RUN mkdir -p /srv/.cache /srv/data && chown -R user:user /srv

USER user
EXPOSE 7860
CMD ["bash", "entrypoint.sh"]
