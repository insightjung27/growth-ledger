#!/usr/bin/env bash
# 성장원장 → GitHub Pages 배포. 로컬 빌드(dist)를 gh-pages 브랜치 루트로 강제 푸시.
set -euo pipefail
export PATH="$HOME/.hermes/node/bin:$PATH"
cd "$(dirname "$0")"

echo "[1/3] build"
npm run build >/dev/null

echo "[2/3] gh-pages 브랜치로 dist 푸시"
cd dist
rm -rf .git
git init -q
git checkout -q -b gh-pages
git config user.email "insight.jung27@gmail.com"
git config user.name "insightjung27"
git add -A
git commit -qm "deploy: 성장원장 pages $(cat ../package.json | grep '\"version\"' | head -1)"
git push -q -f git@github.com:insightjung27/growth-ledger.git gh-pages
cd ..
rm -rf dist/.git

echo "[3/3] 완료 → https://insightjung27.github.io/growth-ledger/"
