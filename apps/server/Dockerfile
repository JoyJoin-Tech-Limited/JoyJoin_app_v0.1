# Multi-stage build for JoyJoin API Server (Monorepo)
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root package files for workspaces
COPY package*.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/server/package.json ./apps/server/

# Configure npm to prevent race conditions during installation
RUN npm config set maxsockets 5
RUN npm config set prefer-offline true

# Copy .github and scripts for postinstall step (setup:agent-skills needs .github/skills/ and scripts/)
COPY .github ./.github
COPY scripts ./scripts

# Install all dependencies
RUN npm ci

# Clean up build-stage artifacts not needed at runtime
RUN rm -rf .github scripts
# Copy shared package source
COPY packages/shared ./packages/shared

# Copy server source
COPY apps/server ./apps/server

# Build the server
WORKDIR /app/apps/server
RUN npm run build
RUN npm prune --omit=dev

# Production image
FROM node:20-alpine AS runner

WORKDIR /app

# CJK fonts for headless canvas rendering (moment-card PNG). Without these,
# Chinese text renders as boxes (see lib/momentCardRenderer.ts font scan).
# ffmpeg for the animated share-clip composition (lib/shareClipRenderer.ts,
# feature-flagged SHARE_ANIMATED_CLIP_ENABLED).
RUN apk add --no-cache font-noto-cjk ffmpeg && fc-cache -f

ENV NODE_ENV=production
ENV PORT=5000

# Copy package files and pruned production dependencies
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules

# Copy built server files
COPY --from=builder /app/apps/server/dist ./apps/server/dist
COPY --from=builder /app/apps/server/package.json ./apps/server/package.json

# Copy shared package (needed at runtime)
COPY --from=builder /app/packages/shared ./packages/shared

WORKDIR /app/apps/server

# Health check — respects PORT override for staging/non-default deployments
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider "http://127.0.0.1:${PORT:-5000}/api/health" || exit 1

EXPOSE 5000

CMD ["npm", "run", "start"]
