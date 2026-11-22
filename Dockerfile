# Multistage Production Dockerfile for Admission Here
FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat

# 1. Install dependencies
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma/
# Install ALL dependencies (including devDependencies like tailwindcss, typescript) for build
ENV NODE_ENV=development
RUN npm ci

# 2. Build the application
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Dummy DATABASE_URL for build time
ENV DATABASE_URL="postgresql://postgres:bps@localhost:5432/admission_db?schema=public"
ENV AUTH_SECRET="build-secret-dummy-key"
RUN npx prisma generate
RUN npm run build

# 3. Production runner
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Don't run production as root
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy static assets and standalone build output
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/scripts/prepare-blog-analytics.cjs ./scripts/prepare-blog-analytics.cjs

USER nextjs

EXPOSE 3000

CMD ["sh", "-c", "node scripts/prepare-blog-analytics.cjs && exec node server.js"]

