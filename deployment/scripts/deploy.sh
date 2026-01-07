#!/bin/bash
set -e

ENVIRONMENT=${1:-staging}

echo "🚀 Deploying JoyJoin to $ENVIRONMENT..."

# Validate environment
if [[ "$ENVIRONMENT" != "staging" && "$ENVIRONMENT" != "production" ]]; then
    echo "❌ Invalid environment: $ENVIRONMENT"
    echo "Usage: ./deploy.sh [staging|production]"
    exit 1
fi

# Load environment variables
if [ -f "deployment/.env.$ENVIRONMENT" ]; then
    export $(cat deployment/.env.$ENVIRONMENT | grep -v '^#' | xargs)
fi

echo "📦 Step 1: Building artifacts..."

# Build user client
echo "  Building user client..."
cd apps/user-client
npm run build
cd ../..

# Build admin client
echo "  Building admin client..."
cd apps/admin-client
npm run build
cd ../..

echo "🐳 Step 2: Building API Docker image..."
docker build -t joyjoin-api:$ENVIRONMENT -f apps/server/Dockerfile .

echo "📤 Step 3: Deploying..."

#不要跳过staging的database push
npm run db:push

if [ "$ENVIRONMENT" == "production" ]; then
    echo "  🔶 Production deployment - running migrations first..."
    # Run database migrations
    #npm run db:push
fi

# Deploy based on your platform (uncomment and modify as needed)

# === Vercel (Frontend) ===
# echo "  Deploying user portal to Vercel..."
# npx vercel deploy dist/user-client --prod --yes
# echo "  Deploying admin portal to Vercel..."
# npx vercel deploy dist/admin-client --prod --yes

# === Fly.io (Backend) ===
# echo "  Deploying API to Fly.io..."
# flyctl deploy --config deployment/fly.$ENVIRONMENT.toml

# === Railway ===
# echo "  Deploying to Railway..."
# railway up

# === AWS ECS ===
# echo "  Pushing to ECR..."
# aws ecr get-login-password | docker login --username AWS --password-stdin $ECR_REGISTRY
# docker tag joyjoin-api:$ENVIRONMENT $ECR_REGISTRY/joyjoin-api:$ENVIRONMENT
# docker push $ECR_REGISTRY/joyjoin-api:$ENVIRONMENT
# echo "  Updating ECS service..."
# aws ecs update-service --cluster joyjoin-$ENVIRONMENT --service api --force-new-deployment

echo "✅ Deployment to $ENVIRONMENT completed!"
echo ""
echo "📊 Deployment URLs:"
if [ "$ENVIRONMENT" == "production" ]; then
    echo "  User Portal:  https://app.joyjoin.com"
    echo "  Admin Portal: https://admin.joyjoin.com"
    echo "  API Server:   https://api.joyjoin.com"
else
    echo "  User Portal:  https://staging-app.joyjoin.com"
    echo "  Admin Portal: https://staging-admin.joyjoin.com"
    echo "  API Server:   https://staging-api.joyjoin.com"
fi
