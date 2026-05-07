#!/bin/bash
set -e

echo "Initializing project..."

# Auto-create .gitignore in ~
cat << 'EOF' > ~/.gitignore
.npm/
.cache/
node_modules/
ccweb/
project/
.config/
EOF

if [ -n "$GITHUB_REPO" ] && [ -n "$GITHUB_TOKEN" ]; then
  # Strip https:// if provided
  REPO_URL=$(echo $GITHUB_REPO | sed 's|^https://||')
  
  cd ~
  
  if [ -d ".git" ]; then
    echo "Git repository exists. Pulling latest..."
    git remote set-url origin "https://${GITHUB_TOKEN}@${REPO_URL}" || git remote add origin "https://${GITHUB_TOKEN}@${REPO_URL}"
    git pull --rebase origin main || true
  else
    echo "Initializing git repository..."
    git init
    git remote add origin "https://${GITHUB_TOKEN}@${REPO_URL}"
    git pull --rebase origin main || true
  fi
else
  echo "No GITHUB_REPO or GITHUB_TOKEN provided."
  cd ~
  if [ ! -d ".git" ]; then
    git init
  fi
fi

# Set up the shell (aliases, save command, cd into ~)
bash /app/scripts/shell-setup.sh

echo "Project initialization complete."
