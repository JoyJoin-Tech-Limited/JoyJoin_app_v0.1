# Multi-stage build for JoyJoin User Client (Static SPA)
FROM node:20-bookworm-slim AS builder

ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

WORKDIR /app

# Copy root package files for workspaces
COPY package*.json ./
COPY packages/shared/package.json ./packages/shared/

# Copy app package file
COPY apps/user-client/package.json ./apps/user-client/

# Install all dependencies
RUN npm ci

# Copy shared package source
COPY packages/shared ./packages/shared

# Copy user-client source
COPY apps/user-client ./apps/user-client

# Copy attached assets (images referenced by the app)
COPY attached_assets ./attached_assets

# Build the static assets
WORKDIR /app/apps/user-client
RUN npm run build

# Production image - nginx to serve static files
FROM nginx:alpine AS runner

# Copy nginx configuration
COPY apps/user-client/nginx.conf /etc/nginx/conf.d/default.conf

# Copy built static files
COPY --from=builder /app/apps/user-client/dist /usr/share/nginx/html

# Expose port
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
