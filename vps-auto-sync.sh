#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# VPS Auto Sync & Encrypt Script
# This script is designed to be run as a cronjob on the VPS to automatically:
# 1. Sync EV.json using sync-lite-data.mjs
# 2. Encrypt EV.json and ID.json using encrypt-data-v1-source-folder.mjs
# 3. Commit and push any changes to GitHub
# ==============================================================================

WORKDIR="/www/wwwroot/api.orcatv.my.id/orca-stream" # <-- GANTI INI DENGAN PATH FOLDER ORCASTREAM DI VPS ANDA
GIT_BRANCH="main"
COMMIT_MSG="chore(data-v1): auto-sync and encrypt sources from VPS cron"

# Ensure we are in the correct directory
cd "$WORKDIR" || { echo "Directory $WORKDIR tidak ditemukan!"; exit 1; }

# 2. Check for required environment variable
if [ -z "${ORCA_ANDROID_SOURCE_KEY:-}" ]; then
  # Try to load from .env if it exists
  if [ -f ".env" ]; then
    export $(grep -v '^#' .env | xargs)
  fi
  
  if [ -z "${ORCA_ANDROID_SOURCE_KEY:-}" ]; then
    echo "ERROR: ORCA_ANDROID_SOURCE_KEY is not set. Please set it in .env file or export it."
    exit 1
  fi
fi

echo "================================================================="
echo "Starting VPS Auto Sync & Encrypt Job at $(date)"
echo "================================================================="

# 3. Pull latest changes from git to avoid conflicts
echo "-> Pulling latest changes from Git..."
git pull origin "$GIT_BRANCH"

# 4. Sync EV.json
echo "-> Syncing EV.json..."
node scripts/sync-lite-data.mjs --file EV.json

# 5. Encrypt EV.json and ID.json
echo "-> Encrypting EV.json and ID.json..."
node scripts/encrypt-data-v1-source-folder.mjs --files EV.json,ID.json

# 6. Check for changes and commit
echo "-> Checking for changes..."
git add data-v1/source/EV.json data-v1/source/ID.json 2>/dev/null || true
git add data-v1/source-encrypted/ 2>/dev/null || true

if git diff --cached --quiet; then
  echo "-> No changes detected. Nothing to commit."
else
  echo "-> Changes detected. Committing and pushing..."
  git commit -m "$COMMIT_MSG"
  git push origin "$GIT_BRANCH"
  echo "-> Successfully pushed changes to GitHub."
fi

echo "================================================================="
echo "Job finished at $(date)"
echo "================================================================="
