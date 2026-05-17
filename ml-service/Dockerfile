# 위스키 비주얼 검색 ML 서비스
# CPU 기본. GPU 필요 시 베이스를 nvidia/cuda + torch cu118로 교체.
FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

# PaddleOCR/torch/opencv 런타임 의존
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 libglib2.0-0 libgomp1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /srv

COPY requirements.txt .
RUN pip install --upgrade pip && pip install -r requirements.txt

COPY . .

# 인덱스/모델 캐시 볼륨
VOLUME ["/srv/data"]

EXPOSE 8000
CMD ["python", "app.py"]
