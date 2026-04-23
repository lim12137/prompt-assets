FROM node:22-alpine AS deps
WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/package.json
COPY packages/db/package.json ./packages/db/package.json
COPY packages/domain/package.json ./packages/domain/package.json

RUN pnpm install --frozen-lockfile

FROM node:22-alpine AS builder
WORKDIR /app

RUN corepack enable

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./package.json
COPY --from=deps /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=deps /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=deps /app/apps/web/package.json ./apps/web/package.json
COPY --from=deps /app/packages/db/package.json ./packages/db/package.json
COPY --from=deps /app/packages/domain/package.json ./packages/domain/package.json

COPY apps/web ./apps/web
COPY packages ./packages
COPY tests/fixtures ./tests/fixtures

RUN pnpm --filter @prompt-management/web build

FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

RUN addgroup -S nodejs && adduser -S nextjs -G nodejs
RUN corepack enable

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=builder /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=builder /app/apps ./apps
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/tests/fixtures ./tests/fixtures
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3000
USER nextjs

CMD ["pnpm", "--filter", "@prompt-management/web", "start", "--", "--hostname", "0.0.0.0", "--port", "3000"]
