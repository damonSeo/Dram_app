#!/usr/bin/env bash
# Hugging Face Space로 ml-service 배포 (사용자 HF 계정 필요)
#
# 사전: 1) huggingface.co 가입  2) Space 생성 (SDK=Docker)
#       3) HF 토큰 발급 (Settings → Access Tokens, write 권한)
#
# 사용:
#   cd ml-service
#   HF_USER=<your-id> HF_SPACE=<space-name> HF_TOKEN=<token> bash deploy-hf.sh
set -e

: "${HF_USER:?HF_USER 필요}"
: "${HF_SPACE:?HF_SPACE 필요}"
: "${HF_TOKEN:?HF_TOKEN 필요}"

TMP=$(mktemp -d)
echo "→ Space 클론: $HF_USER/$HF_SPACE"
git clone "https://user:${HF_TOKEN}@huggingface.co/spaces/${HF_USER}/${HF_SPACE}" "$TMP"

# ml-service 내용만 복사 (가상환경/데이터 제외)
rsync -a --exclude .venv --exclude data --exclude __pycache__ --exclude .env ./ "$TMP/"

cd "$TMP"
git add -A
git -c user.email=deploy@oak -c user.name=oak-deploy commit -m "deploy ml-service" || echo "변경 없음"
git push
echo "✓ 배포 완료 → https://huggingface.co/spaces/${HF_USER}/${HF_SPACE}"
echo "  Space Settings에서 Secrets(SUPABASE_URL 등) 설정 후 빌드가 끝나면"
echo "  공개 URL을 Vercel ML_SERVICE_URL 에 넣으세요."
