#!/bin/bash

# Setup .bashrc for the root user
cat << 'EOF' >> ~/.bashrc

# Custom save command to trigger manual sync
save() {
  echo "Triggering manual sync..."
  bash /app/scripts/git-sync.sh
}

# Custom sync command to trigger manual sync
sync() {
  echo "Triggering manual sync..."
  bash /app/scripts/git-sync.sh
}

export PS1="➜ "

alias @='echo -ne "\033]0;__UPLOAD__:'"$(pwd)"':'"$RANDOM"'\007"'
alias download='echo -ne "\033]0;__DOWNLOAD__:'"$RANDOM"'\007"'

# Always start in the home directory
cd ~
EOF

# Also add it to /etc/bash.bashrc as a fallback
cat << 'EOF' >> /etc/bash.bashrc

# Custom save command to trigger manual sync
save() {
  echo "Triggering manual sync..."
  bash /app/scripts/git-sync.sh
}

# Custom sync command to trigger manual sync
sync() {
  echo "Triggering manual sync..."
  bash /app/scripts/git-sync.sh
}

export PS1="➜ "

alias @='echo -ne "\033]0;__UPLOAD__:'"$(pwd)"':'"$RANDOM"'\007"'
alias download='echo -ne "\033]0;__DOWNLOAD__:'"$RANDOM"'\007"'

# Always start in the home directory
cd ~
EOF
