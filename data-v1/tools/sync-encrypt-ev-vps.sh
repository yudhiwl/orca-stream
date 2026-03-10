#!/usr/bin/env bash
set -euo pipefail

WORKDIR="${WORKDIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
LITE_VERSION="${LITE_VERSION:-v215}"
GIT_REMOTE="${GIT_REMOTE:-origin}"
GIT_BRANCH="${GIT_BRANCH:-main}"
COMMIT_MSG="${COMMIT_MSG:-chore(data-v1): auto-encrypt EV source}"
FORCE_ENCRYPT="${FORCE_ENCRYPT:-0}"

# Load .env file if it exists
if [ -f "$WORKDIR/.env" ]; then
  # Use grep to skip comments and empty lines, and export variables
  set -a
  source <(grep -v '^#' "$WORKDIR/.env" | grep -v '^[[:space:]]*$')
  set +a
fi

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing command: $1"
    exit 1
  fi
}

require_cmd node
require_cmd git
require_cmd sha256sum

if [ -z "${ORCA_ANDROID_SOURCE_KEY:-}" ]; then
  echo "ORCA_ANDROID_SOURCE_KEY is required."
  exit 1
fi

cd "$WORKDIR"

if [ ! -f "scripts/sync-lite-data.mjs" ] || [ ! -f "scripts/encrypt-data-v1-source-folder.mjs" ]; then
  echo "Invalid WORKDIR: $WORKDIR"
  echo "Expected scripts/sync-lite-data.mjs and scripts/encrypt-data-v1-source-folder.mjs"
  exit 1
fi

mkdir -p data-v1/source

before_hash="$(sha256sum data-v1/source/EV.json 2>/dev/null | awk '{print $1}' || true)"

echo "WORKDIR: $WORKDIR"
echo "Syncing and decrypting EV.json from brodatv1/lite/${LITE_VERSION} ..."
node scripts/sync-lite-data.mjs --version "$LITE_VERSION" --file EV.json --no-prune --no-live-events-sync

after_hash="$(sha256sum data-v1/source/EV.json 2>/dev/null | awk '{print $1}' || true)"
echo "EV hash before: ${before_hash:-"(none)"}"
echo "EV hash after : ${after_hash:-"(none)"}"

if [ "$FORCE_ENCRYPT" != "1" ] && [ -n "$before_hash" ] && [ "$before_hash" = "$after_hash" ]; then
  echo "EV.json unchanged. Skip encrypt."
  exit 0
fi

echo "EV.json changed. Extracting images..."
node data-v1/tools/extract-images.mjs --file EV.json

echo "EV.json changed. Encrypting..."
ORCA_ANDROID_SOURCE_KEY="$ORCA_ANDROID_SOURCE_KEY" node scripts/encrypt-data-v1-source-folder.mjs --file EV.json

git add data-v1/source-encrypted/EV.enc data-v1/source-encrypted/manifest.json data-v1/source-images

if git diff --cached --quiet; then
  echo "No encrypted output change. Skip commit."
  exit 0
fi

git commit -m "$COMMIT_MSG"
git push "$GIT_REMOTE" "$GIT_BRANCH"

echo "Done."
