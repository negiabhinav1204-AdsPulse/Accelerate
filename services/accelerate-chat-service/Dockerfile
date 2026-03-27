# Build context: monorepo root
FROM node:20-alpine AS base
RUN npm install -g pnpm@9.12.0

FROM base AS deps
WORKDIR /app
COPY pnpm-workspace.yaml package.json ./
COPY packages/database/package.json ./packages/database/
COPY packages/database/prisma ./packages/database/prisma
COPY services/accelerate-chat-service/package.json ./services/accelerate-chat-service/
RUN pnpm install --frozen-lockfile --filter @accelerate/chat-service...

FROM deps AS builder
WORKDIR /app
COPY services/accelerate-chat-service ./services/accelerate-chat-service
RUN pnpm --filter @accelerate/chat-service build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN npm install -g pnpm@9.12.0

COPY --from=builder /app/services/accelerate-chat-service/dist ./dist
COPY --from=builder /app/services/accelerate-chat-service/package.json ./
COPY --from=builder /app/packages/database/prisma ./prisma
COPY --from=builder /app/node_modules/.pnpm ./node_modules/.pnpm
COPY --from=builder /app/services/accelerate-chat-service/node_modules ./node_modules

RUN npx prisma generate --schema=./prisma/schema.prisma

EXPOSE 8080
ENV PORT=8080
CMD ["node", "dist/index.js"]
