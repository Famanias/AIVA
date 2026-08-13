FROM node:20-slim

# Install Chromium system dependencies for Remotion & Puppeteer
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    fonts-ipafont-gothic \
    fonts-wqy-zenhei \
    fonts-thai-tlwg \
    fonts-kacst \
    fonts-freefont-ttf \
    libnss3 \
    libatk-bridge2.0-0 \
    libxss1 \
    libgbm1 \
    libasound2 \
    libgtk-3-0 \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Tell Remotion / Puppeteer to use installed Chromium binary
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

# Enable pnpm
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

# Copy root monorepo files & packages
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml /app/
COPY tsconfig.base.json /app/tsconfig.base.json
COPY packages /app/packages
COPY apps/template-renderer /app/apps/template-renderer

# Install dependencies and build
RUN pnpm install --no-frozen-lockfile
RUN pnpm --filter aiva-template-renderer build

EXPOSE 3001

CMD ["pnpm", "--filter", "aiva-template-renderer", "start"]
