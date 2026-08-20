# Multi-stage build for JoyJoin Admin Client (Static SPA)
FROM node:20-alpine AS builder

ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

WORKDIR /app

# Copy root package files for workspaces (tsconfig.base.json is copied after
# npm ci below so its layer cache stays stable against config churn)
COPY package*.json ./
COPY packages/shared/package.json ./packages/shared/

# Copy app package file
COPY apps/admin-client/package.json ./apps/admin-client/

# Install all dependencies. The root postinstall (setup:agent-skills AI tooling
# mirror) skips gracefully when scripts/.github are absent, so those dirs are
# deliberately NOT copied here. This keeps the npm ci layer's cache stable
# against frequent .github/docs churn instead of forcing a full ~1.3 GiB
# reinstall on every build.
RUN npm ci --no-audit --no-fund

COPY tsconfig.base.json ./
# Copy shared package source
COPY packages/shared ./packages/shared

# Copy admin-client source
COPY apps/admin-client ./apps/admin-client

# Copy attached assets (images referenced by the app)
# COPY attached_assets ./attached_assets

# Build the static assets
WORKDIR /app/apps/admin-client
RUN npm run build

# Production image - nginx to serve static files
FROM nginx:alpine AS runner

# Copy nginx configuration
COPY apps/admin-client/nginx.conf /etc/nginx/conf.d/default.conf

# Copy built static files
COPY --from=builder /app/apps/admin-client/dist /usr/share/nginx/html

# Expose port
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
