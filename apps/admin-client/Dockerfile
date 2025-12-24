# Multi-stage build for JoyJoin Admin Client (Static SPA)
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root package files for workspaces
COPY package*.json ./
COPY packages/shared/package.json ./packages/shared/

# Copy app package file
COPY apps/admin-client/package.json ./apps/admin-client/

# Install all dependencies
RUN npm ci

# Copy shared package source
COPY packages/shared ./packages/shared

# Copy admin-client source
COPY apps/admin-client ./apps/admin-client

# Copy attached assets (images referenced by the app)
COPY attached_assets ./attached_assets

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
