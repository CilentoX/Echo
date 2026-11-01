# Echo API — Fastify + Prisma + Node.js 20
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
COPY package.json pnpm-lock.yaml* ./
RUN corepack enable pnpm && pnpm install --frozen-lockfile

# Generate Prisma client
FROM deps AS generator
WORKDIR /app
COPY prisma ./prisma/
RUN pnpm prisma generate

# Build the application
FROM generator AS builder
WORKDIR /app
COPY . .
RUN pnpm build

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 echoapi

# Copy built application
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma/

# Create uploads directory
RUN mkdir -p src/uploads && chown -R echoapi:nodejs src/uploads

USER echoapi

EXPOSE 3001

CMD ["node", "dist/server.js"]