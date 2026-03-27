FROM node:20-alpine AS base
RUN npm install -g pnpm

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/database/package.json ./packages/database/
COPY services/accelerate-shopping-feeds-service/package.json ./services/accelerate-shopping-feeds-service/
RUN pnpm install --filter @accelerate/shopping-feeds-service... --frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/database/node_modules ./packages/database/node_modules
COPY --from=deps /app/services/accelerate-shopping-feeds-service/node_modules ./services/accelerate-shopping-feeds-service/node_modules
COPY packages/database ./packages/database
COPY services/accelerate-shopping-feeds-service ./services/accelerate-shopping-feeds-service
WORKDIR /app/services/accelerate-shopping-feeds-service
RUN npx prisma generate
RUN pnpm build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/services/accelerate-shopping-feeds-service/dist ./dist
COPY --from=builder /app/services/accelerate-shopping-feeds-service/node_modules ./node_modules
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/packages/database/prisma ./prisma
EXPOSE 8080
CMD ["node", "dist/index.js"]
