# Multi-stage build for JoyJoin API Server (Monorepo)
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root package files for workspaces
COPY package*.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/server/package.json ./apps/server/

# Install all dependencies
RUN npm ci

# Copy shared package source
COPY packages/shared ./packages/shared

# Copy server source
COPY apps/server ./apps/server

# Build the server
WORKDIR /app/apps/server
RUN npm run build

# Production image
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000

# Install native dependencies for bcrypt
RUN apk add --no-cache make gcc g++ python3

# Copy package files
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/apps/server/package.json ./apps/server/

# Install production dependencies only
RUN npm ci --omit=dev

# Copy built server files
COPY --from=builder /app/apps/server/dist ./apps/server/dist

# Copy shared package (needed at runtime)
COPY --from=builder /app/packages/shared ./packages/shared

WORKDIR /app/apps/server

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/api/health || exit 1

EXPOSE 5000

CMD ["node", "dist/index.js"]
