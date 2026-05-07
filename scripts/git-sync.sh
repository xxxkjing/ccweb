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

echo "Starting git sync..."
git add .

# Only commit if there are changes
if ! git diff-index --quiet HEAD; then
  git commit -m "Auto-sync from terminal: $(date)"
fi

# Pull with rebase
git pull --rebase origin main || true

# Push changes
git push origin main || true

echo "Git sync complete."
