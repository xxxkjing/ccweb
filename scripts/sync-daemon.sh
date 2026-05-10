#!/bin/bash

# Configuration
SYNC_INTERVAL=60

while true; do
  if [ -d "$HOME/.git" ]; then
    cd "$HOME" || exit 1
    
    # Configure git if not already
    git config --global user.name "${GIT_USER_NAME:-Claude Code Terminal}"
    git config --global user.email "${GIT_USER_EMAIL:-claude@example.com}"
    
    # Check if there are changes to commit
    if [ -n "$(git status -s)" ]; then
      echo "检测到文件变化就开始同步 - Starting git sync daemon cycle..."
      git add .
      git commit -m "Auto-sync from terminal daemon: $(date)"
      
      git branch -M main
      echo "Pulling latest changes from GitHub..."
      git pull --rebase origin main || git pull origin main --no-rebase -s recursive -X ours --allow-unrelated-histories || true
      
      echo "终端显示进度与日志 - Pushing to GitHub..."
      git push origin main || true
      echo "Git sync daemon cycle complete."
    fi
  fi
  
  sleep $SYNC_INTERVAL
done
