# Build context: monorepo root
FROM node:20-alpine AS base
RUN npm install -g pnpm@9.12.0

FROM base AS deps
WORKDIR /app
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/database/package.json ./packages/database/
COPY packages/database/prisma ./packages/database/prisma
COPY packages/common/package.json ./packages/common/
COPY services/accelerate-campaigns-service/package.json ./services/accelerate-campaigns-service/
RUN pnpm install --frozen-lockfile --filter @accelerate/campaigns-service...

FROM deps AS builder
WORKDIR /app
COPY packages/common ./packages/common
COPY packages/database ./packages/database
COPY services/accelerate-campaigns-service ./services/accelerate-campaigns-service
RUN npx prisma generate --schema=packages/database/prisma/schema.prisma

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN npm install -g pnpm@9.12.0

COPY --from=builder /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules/.pnpm ./node_modules/.pnpm
COPY --from=builder /app/services/accelerate-campaigns-service/node_modules ./services/accelerate-campaigns-service/node_modules
COPY --from=builder /app/services/accelerate-campaigns-service/package.json ./services/accelerate-campaigns-service/package.json
COPY --from=builder /app/services/accelerate-campaigns-service/src ./services/accelerate-campaigns-service/src
COPY --from=builder /app/packages/common ./packages/common
COPY --from=builder /app/packages/database ./packages/database

EXPOSE 8088
ENV PORT=8088
CMD ["pnpm", "--filter", "@accelerate/campaigns-service", "start"]
