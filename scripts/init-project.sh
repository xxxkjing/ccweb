#!/bin/bash
set -e

echo "Initializing project..."

mkdir -p /workspace

if [ -n "$GITHUB_REPO" ] && [ -n "$GITHUB_TOKEN" ]; then
  # Strip https:// if provided
  REPO_URL=$(echo $GITHUB_REPO | sed 's|^https://||')
  
  if [ -d "/workspace/project/.git" ]; then
    echo "Directory exists and is a git repository. Pulling latest..."
    cd /workspace/project
    git remote set-url origin "https://${GITHUB_TOKEN}@${REPO_URL}"
    git pull --rebase origin main
  else
    echo "Cloning repository..."
    git clone "https://${GITHUB_TOKEN}@${REPO_URL}" /workspace/project
  fi
else
  echo "No GITHUB_REPO or GITHUB_TOKEN provided. Creating empty directory..."
  mkdir -p /workspace/project
fi

# Set up the shell (aliases, save command, cd into /workspace/project)
bash ./scripts/shell-setup.sh

echo "Project initialization complete."
