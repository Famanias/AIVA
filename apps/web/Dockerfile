FROM node:20-alpine

WORKDIR /app

# Enable pnpm
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

COPY package.json /app/package.json
COPY proxy.ts /app/proxy.ts
COPY next.config.ts /app/next.config.ts 2>/dev/null || true
COPY tsconfig.json /app/tsconfig.json

# Copy application files
COPY . /app

EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000

CMD ["pnpm", "start"]
