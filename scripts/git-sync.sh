#!/bin/bash

# Only sync if it's a git repo
if [ ! -d "$HOME/.git" ]; then
  echo "Not a git repository, skipping sync."
  exit 0
fi

cd "$HOME" || exit 1

# Configure git if not already
git config --global user.name "${GIT_USER_NAME:-Claude Code Terminal}"
git config --global user.email "${GIT_USER_EMAIL:-claude@example.com}"

echo "检测到文件变化就开始同步 - Starting git sync..."
git add .

# Only commit if there are changes
if ! git diff-index --quiet HEAD; then
  git commit -m "Auto-sync from terminal: $(date)"
fi

git branch -M main

# Pull with rebase
echo "Pulling latest changes from GitHub..."
git pull --rebase origin main || git pull origin main --no-rebase -s recursive -X ours --allow-unrelated-histories || true

# Push changes
echo "终端显示进度与日志 - Pushing to GitHub..."
git push origin main || true

echo "Git sync complete."
