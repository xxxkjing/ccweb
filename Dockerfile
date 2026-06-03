FROM node:20-bookworm

# Install required packages
RUN apt-get update && apt-get install -y \
    bash \
    git \
    vim \
    python3 \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install claude-code globally
RUN npm install -g @anthropic-ai/claude-code

# Set up working directory for the application
WORKDIR /app

# Copy package files and install dependencies
COPY package.json package-lock.json* ./
RUN npm ci || npm install

# Copy application files
COPY . .

# Make scripts executable
RUN chmod +x scripts/*.sh

# Build the compiled server entrypoint used by npm run server
RUN npm run build:server

# Run init project script and start the compiled server
CMD ["sh", "-c", "./scripts/init-project.sh && npm run server"]
