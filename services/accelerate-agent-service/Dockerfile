# Build context: monorepo root
# docker build -f services/accelerate-agent-service/Dockerfile -t accelerate-agent-service .

FROM node:20-alpine AS base
RUN npm install -g pnpm@9.12.0

# ── Install dependencies ───────────────────────────────────────────────────────
FROM base AS deps
WORKDIR /app

# Copy only what's needed to resolve workspace deps
COPY pnpm-workspace.yaml package.json ./
COPY packages/database/package.json ./packages/database/
COPY packages/database/prisma ./packages/database/prisma
COPY services/accelerate-agent-service/package.json ./services/accelerate-agent-service/

# Install all deps (needed for prisma generate)
RUN pnpm install --frozen-lockfile --filter @accelerate/agent-service...

# ── Build ──────────────────────────────────────────────────────────────────────
FROM deps AS builder
WORKDIR /app

COPY services/accelerate-agent-service ./services/accelerate-agent-service

RUN pnpm --filter @accelerate/agent-service build

# ── Production image ───────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN npm install -g pnpm@9.12.0

# Copy built output + production deps
COPY --from=builder /app/services/accelerate-agent-service/dist ./dist
COPY --from=builder /app/services/accelerate-agent-service/package.json ./
COPY --from=builder /app/packages/database/prisma ./prisma
COPY --from=builder /app/node_modules/.pnpm ./node_modules/.pnpm
COPY --from=builder /app/services/accelerate-agent-service/node_modules ./node_modules

# Regenerate Prisma client for this Alpine image
RUN npx prisma generate --schema=./prisma/schema.prisma

EXPOSE 8080
ENV PORT=8080

CMD ["node", "dist/index.js"]
