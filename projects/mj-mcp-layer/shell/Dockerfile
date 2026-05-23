FROM node:22-bullseye-slim

# Install system dependencies for node-pty and common shell tools
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    curl \
    git \
    bash \
    && rm -rf /var/lib/apt/lists/*

# Install yq for YAML processing in the shell
RUN curl -L https://github.com/mikefarah/yq/releases/latest/download/yq_linux_amd64 -o /usr/bin/yq && chmod +x /usr/bin/yq

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (including devDependencies for build, then prune)
RUN npm install

# Copy source
COPY . .

# Build the project
RUN npm run build

# Create a non-privileged user for the operator shell
RUN useradd -m operator && \
    mkdir -p /home/operator && \
    chown -R operator:operator /home/operator

USER root
# We'll run the service as root but spawn the PTY as the operator user?
# Actually, for PTY to work well, we might need some permissions.
# For now, we'll run the service as root to have permission to spawn PTYs for other users.
# But we'll drop privileges in the PTY itself (logic in session.ts CWE-pending).

EXPOSE 8080

CMD ["npm", "start"]
