FROM node:20-alpine

WORKDIR /app

# Enable pnpm
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

# Copy root monorepo files & packages
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml /app/
COPY packages /app/packages
COPY apps/web /app/apps/web
# Copy template-renderer source so cross-package type imports resolve during next build
COPY apps/template-renderer/src /app/apps/template-renderer/src
COPY apps/template-renderer/package.json /app/apps/template-renderer/package.json

# Install dependencies and build web
RUN pnpm install --no-frozen-lockfile
RUN pnpm --filter @aiva/shared-types build
RUN pnpm --filter web build

EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000

CMD ["pnpm", "--filter", "web", "start"]
