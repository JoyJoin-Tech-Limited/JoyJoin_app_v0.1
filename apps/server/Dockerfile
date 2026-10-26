# Multi-stage build for JoyJoin API Server (Monorepo)
#
# Three tiers, so that a deploy only transfers what actually changed:
#   base   — OS packages that change with the Node major only (~pinned)
#   deps   — npm ci + prune, keyed by package-lock.json
#   app    — dist + runtime data, rebuilt on every push
#
# `runner` is FROM deps (not FROM builder) on purpose: the base + deps layers
# then have the same digests as the published `joyjoin-api-deps` image, so the
# CVM pulls only the app layer instead of ~1 GB of node_modules. Before this
# split a cold registry pull took ~60 minutes across the Pacific and starved
# both environments (see docs/deliberations/2026-10-22-staging-deploy-latency-plan.md).

# --- Tier 1: runtime base ---------------------------------------------------
# apk packages live here only. This stage is meant to be published once as
# `joyjoin-api-base` and reused; rebuilding it on every push would defeat the
# split (and on the CVM itself `apk add font-noto-cjk ffmpeg` currently fails,
# which is why application images are never built on the box).
FROM node:20-alpine AS base

ENV NODE_ENV=production
ENV PORT=5000

# CJK fonts for headless canvas rendering (moment-card PNG). Without these,
# Chinese text renders as boxes (see lib/momentCardRenderer.ts font scan).
# ffmpeg for the animated share-clip composition (lib/shareClipRenderer.ts,
# feature-flagged SHARE_ANIMATED_CLIP_ENABLED).
RUN apk add --no-cache font-noto-cjk ffmpeg && fc-cache -f

# --- Tier 2: production dependencies ---------------------------------------
# Only the three manifests are needed, so this layer stays valid across all
# source changes. Published as `joyjoin-api-deps:<sha256(package-lock.json)>`;
# rebuild it only when the lockfile changes.
FROM base AS deps

WORKDIR /app

COPY package*.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/server/package.json ./apps/server/

RUN npm config set maxsockets 5
RUN npm config set prefer-offline true
RUN npm ci --no-audit --no-fund

# Drop devDependencies. Run from the workspace directory, matching the previous
# single-stage behaviour so the pruned layout is byte-for-byte the same.
WORKDIR /app/apps/server
RUN npm prune --omit=dev
# Guarantee the workspace-local node_modules path exists so the runtime image
# inherits it (npm only hoists a package to /app/node_modules when one version
# satisfies every importer; the drizzle-orm bump of 2026-10-22 moved it into the
# workspace instead, and boot crashed with ERR_MODULE_NOT_FOUND without it).
RUN mkdir -p /app/apps/server/node_modules /app/packages/shared/node_modules

# --- Tier 3a: build stage ---------------------------------------------------
# Builds need devDependencies, so this stage installs the full tree.
FROM base AS builder

WORKDIR /app

# Copy root package files for workspaces
COPY package*.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/server/package.json ./apps/server/

# Configure npm to prevent race conditions during installation
RUN npm config set maxsockets 5
RUN npm config set prefer-offline true

# Install all dependencies. The root postinstall (setup:agent-skills AI tooling
# mirror) skips gracefully when scripts/.github are absent, so those dirs are
# deliberately NOT copied here. This keeps the npm ci layer's cache stable
# against frequent .github/docs churn instead of forcing a full ~1.3 GiB
# reinstall on every build.
RUN npm ci --no-audit --no-fund

# Copy shared package source
COPY packages/shared ./packages/shared

# Copy server source
COPY apps/server ./apps/server

# Build the server
WORKDIR /app/apps/server
RUN npm run build

# --- Tier 3b: runtime image -------------------------------------------------
# Inherits the whole deps tier, so a deploy adds only the layers below.
FROM deps AS runner

WORKDIR /app

# Copy built server files
COPY --from=builder /app/apps/server/dist ./apps/server/dist
COPY --from=builder /app/apps/server/package.json ./apps/server/package.json

# Copy runtime data (occupation vector index) — needed by occupation
# correction-candidate resolution; the bundle reads it from apps/server/data.
COPY --from=builder /app/apps/server/data ./apps/server/data

# Copy the shared package source. Its exports map points at ./src/*.ts and the
# server bundle inlines it, so the manifest + sources are all the runtime can
# ever resolve; node_modules comes from the deps tier above.
COPY --from=builder /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=builder /app/packages/shared/src ./packages/shared/src

WORKDIR /app/apps/server

# Health check — respects PORT override for staging/non-default deployments
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider "http://127.0.0.1:${PORT:-5000}/api/health" || exit 1

EXPOSE 5000

CMD ["npm", "run", "start"]
