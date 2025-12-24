# Multi-stage build for JoyJoin Server
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY shared/ ./shared/

# Install all dependencies (including dev deps for build)
RUN npm ci

# Copy source code
COPY . .

# Build the server (esbuild compiles server/index.ts to dist/index.js)
RUN npm run build

# Production image
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000

# Install native dependencies for bcrypt
RUN apk add --no-cache make gcc g++ python3

# Copy package files and install production dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy built files
COPY --from=builder /app/dist ./dist

# Copy shared types (needed at runtime for some imports)
COPY --from=builder /app/shared ./shared

# Health check - uses the /api/health endpoint
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/api/health || exit 1

# Expose port
EXPOSE 5000

# Start the server - MUST have this for platform to know how to start the container
CMD ["node", "dist/index.js"]
