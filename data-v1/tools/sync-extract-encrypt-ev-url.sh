#!/usr/bin/env bash
set -euo pipefail

WORKDIR="${WORKDIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
SOURCE_URL="${SOURCE_URL:-https://raw.githubusercontent.com/brodatv1/lite/refs/heads/main/v215/EV.json}"
TARGET_FILE="${TARGET_FILE:-data-v1/source/EV.json}"
GIT_REMOTE="${GIT_REMOTE:-origin}"
GIT_BRANCH="${GIT_BRANCH:-}"
COMMIT_MSG="${COMMIT_MSG:-chore(data-v1): auto-update EV from upstream}"
FORCE_UPDATE="${FORCE_UPDATE:-0}"
PUSH_CHANGES="${PUSH_CHANGES:-1}"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing command: $1"
    exit 1
  fi
}

require_cmd node
require_cmd git

if [ -z "${ORCA_ANDROID_SOURCE_KEY:-}" ]; then
  echo "ORCA_ANDROID_SOURCE_KEY is required."
  exit 1
fi

cd "$WORKDIR"

if [ ! -f "data-v1/tools/extract-images.mjs" ] || [ ! -f "scripts/encrypt-data-v1-source-folder.mjs" ]; then
  echo "Invalid WORKDIR: $WORKDIR"
  echo "Expected data-v1/tools/extract-images.mjs and scripts/encrypt-data-v1-source-folder.mjs"
  exit 1
fi

if [ -z "$GIT_BRANCH" ]; then
  GIT_BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || true)"
  if [ -z "$GIT_BRANCH" ] || [ "$GIT_BRANCH" = "HEAD" ]; then
    GIT_BRANCH="main"
  fi
fi

TMP_FILE="$(mktemp)"
trap 'rm -f "$TMP_FILE"' EXIT

json_sha256() {
  local file_path="$1"
  if [ ! -f "$file_path" ]; then
    echo ""
    return 0
  fi

  node -e "const fs=require('fs'); const crypto=require('crypto'); const p=process.argv[1]; const raw=fs.readFileSync(p,'utf8').replace(/^\uFEFF/, ''); const data=JSON.stringify(JSON.parse(raw)); process.stdout.write(crypto.createHash('sha256').update(data).digest('hex'));" "$file_path"
}

echo "WORKDIR     : $WORKDIR"
echo "SOURCE_URL  : $SOURCE_URL"
echo "TARGET_FILE : $TARGET_FILE"

node -e "const fs=require('fs'); const out=process.argv[2]; (async()=>{ const res=await fetch(process.argv[1],{cache:'no-store'}); if(!res.ok){throw new Error('HTTP '+res.status+' from upstream');} const text=(await res.text()).replace(/^\uFEFF/, ''); const json=JSON.parse(text); fs.writeFileSync(out, JSON.stringify(json,null,2)+'\n','utf8'); })().catch((err)=>{ console.error('Failed to download/parse SOURCE_URL:', err.message || err); process.exit(1); });" "$SOURCE_URL" "$TMP_FILE"

mkdir -p "$(dirname "$TARGET_FILE")"

before_hash="$(json_sha256 "$TARGET_FILE")"
after_hash="$(json_sha256 "$TMP_FILE")"

echo "EV hash before: ${before_hash:-"(none)"}"
echo "EV hash after : ${after_hash:-"(none)"}"

if [ "$FORCE_UPDATE" != "1" ] && [ -n "$before_hash" ] && [ "$before_hash" = "$after_hash" ]; then
  echo "EV.json unchanged. Skip."
  exit 0
fi

cp "$TMP_FILE" "$TARGET_FILE"
echo "Saved upstream EV.json -> $TARGET_FILE"

echo "Running extract-images..."
node data-v1/tools/extract-images.mjs --file EV.json

echo "Running encrypt..."
ORCA_ANDROID_SOURCE_KEY="$ORCA_ANDROID_SOURCE_KEY" node scripts/encrypt-data-v1-source-folder.mjs --file EV.json

git add data-v1/source-encrypted/EV.enc data-v1/source-encrypted/manifest.json data-v1/source-images

if git diff --cached --quiet; then
  echo "No encrypted/image output change. Skip commit."
  exit 0
fi

git commit -m "$COMMIT_MSG"

if [ "$PUSH_CHANGES" = "1" ]; then
  git push "$GIT_REMOTE" "$GIT_BRANCH"
  echo "Done. Changes pushed to $GIT_REMOTE/$GIT_BRANCH"
else
  echo "Done. Commit created locally (push disabled)."
fi

