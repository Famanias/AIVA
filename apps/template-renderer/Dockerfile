FROM node:20-bullseye-slim

# Install Chromium dependencies for Puppeteer/Remotion
RUN apt-get update && apt-get install -y \
    chromium \
    libnss3 \
    libxss1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libgtk-3-0 \
    && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

# Enable pnpm
RUN npm install -g pnpm@9

# Copy package files (monorepo setup)
COPY package.json pnpm-workspace.yaml ./
COPY apps/template-renderer/package.json apps/template-renderer/
COPY packages/shared-types/package.json packages/shared-types/

# Install dependencies
RUN pnpm install

# Copy source
COPY packages/shared-types packages/shared-types
COPY apps/template-renderer apps/template-renderer

WORKDIR /app/apps/template-renderer

# Build
RUN pnpm build

EXPOSE 3001

CMD ["pnpm", "start"]
