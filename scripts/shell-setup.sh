#!/bin/bash

# Setup .bashrc for the root user
cat << 'EOF' >> ~/.bashrc

# Custom save command to trigger manual sync
save() {
  echo "Triggering manual sync..."
  bash /app/scripts/git-sync.sh
}

# Always start in the workspace project directory
cd /workspace/project
EOF

# Also add it to /etc/bash.bashrc as a fallback
cat << 'EOF' >> /etc/bash.bashrc

# Custom save command to trigger manual sync
save() {
  echo "Triggering manual sync..."
  bash /app/scripts/git-sync.sh
}

# Always start in the workspace project directory
cd /workspace/project
EOF
