# JoyJoin 部署指南

## 架构概览

```
                    ┌─────────────────┐
                    │   GitHub Repo   │
                    └────────┬────────┘
                             │ Push/PR
                             ▼
                    ┌─────────────────┐
                    │ GitHub Actions  │
                    │   CI/CD流水线    │
                    └────────┬────────┘
                             │
        ┌────────────────────┼────────────────────┐
        ▼                    ▼                    ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│ User Portal  │    │ Admin Portal │    │   API Server │
│ (静态CDN)     │    │  (静态CDN)    │    │  (Docker)    │
│              │    │              │    │              │
│ app.joyjoin  │    │admin.joyjoin │    │ api.joyjoin  │
│     .com     │    │    .com      │    │    .com      │
└──────────────┘    └──────────────┘    └──────────────┘
                             │
                             ▼
                    ┌──────────────┐
                    │  PostgreSQL  │
                    │   (Neon)     │
                    └──────────────┘
```

## 快速开始

### 1. 环境准备

确保你有以下账号/工具:
- GitHub 账号 (用于 CI/CD 和容器注册)
- 静态托管平台: Vercel / Cloudflare Pages / Netlify (任选其一)
- 容器运行平台: Fly.io / Railway / AWS ECS (任选其一)
- PostgreSQL: Neon / Supabase / AWS RDS

### 2. 配置 GitHub Secrets

在 GitHub 仓库 Settings > Secrets and variables > Actions 中添加:

```
# 必需
DATABASE_URL=postgresql://user:pass@host/db?sslmode=require
DEEPSEEK_API_KEY=sk-xxx

# 根据部署平台选择
VERCEL_TOKEN=xxx          # 如果用 Vercel
CLOUDFLARE_TOKEN=xxx      # 如果用 Cloudflare Pages
FLY_API_TOKEN=xxx         # 如果用 Fly.io
```

### 3. 配置 GitHub Variables

在 Settings > Secrets and variables > Actions > Variables 中添加:

```
API_URL=https://api.joyjoin.com  # 生产环境 API 地址
```

## 部署流程

### 自动部署 (推荐)

1. **推送到 `develop` 分支** → 自动部署到 Staging
2. **推送到 `main` 分支** → 自动部署到 Production

### 手动部署

```bash
# 1. 构建用户端
cd apps/user-client
npm run build

# 2. 构建管理端
cd ../admin-client
npm run build

# 3. 构建并推送 API 镜像
docker build -t joyjoin-api -f apps/server/Dockerfile .
docker push your-registry/joyjoin-api:latest
```

## 平台部署指南

### Option A: Vercel (前端) + Fly.io (后端)

#### 前端部署 (Vercel)

```bash
# 安装 Vercel CLI
npm i -g vercel

# 部署用户端
cd dist/user-client
vercel --prod

# 部署管理端
cd ../admin-client
vercel --prod
```

#### 后端部署 (Fly.io)

```bash
# 安装 Fly CLI
curl -L https://fly.io/install.sh | sh

# 初始化
cd apps/server
fly launch

# 设置环境变量
fly secrets set DATABASE_URL="postgresql://..." DEEPSEEK_API_KEY="sk-..."

# 部署
fly deploy
```

### Option B: Cloudflare Pages (前端) + Railway (后端)

#### 前端部署 (Cloudflare Pages)

1. 登录 Cloudflare Dashboard
2. Pages > Create a project
3. 连接 GitHub 仓库
4. 配置:
   - Build command: `npm run build:user`
   - Build output: `dist/user-client`
5. 重复为管理端配置

#### 后端部署 (Railway)

1. 登录 railway.app
2. New Project > Deploy from GitHub repo
3. 选择 `apps/server` 目录
4. 添加环境变量
5. 部署

## 域名配置

### DNS 记录

```
Type    Name     Value
A       app      CDN IP / CNAME to vercel
A       admin    CDN IP / CNAME to vercel
A       api      Container IP / CNAME to fly.io
```

### SSL 证书

- Vercel/Cloudflare 自动提供 SSL
- Fly.io 自动提供 SSL
- 自管服务器使用 Let's Encrypt + Certbot

## 数据库迁移

```bash
# 推送 schema 变更
npm run db:push

# 或使用迁移文件
drizzle-kit generate
drizzle-kit migrate
```

## 环境变量

### API Server (.env.production)

```env
NODE_ENV=production
PORT=5000
DATABASE_URL=postgresql://...
DEEPSEEK_API_KEY=sk-...
JWT_SECRET=your-secure-jwt-secret
CORS_ORIGINS=https://app.joyjoin.com,https://admin.joyjoin.com
```

### User Client (.env.production)

```env
VITE_API_URL=https://api.joyjoin.com
```

### Admin Client (.env.production)

```env
VITE_API_URL=https://api.joyjoin.com
```

## 监控与日志

### 推荐工具

- **日志**: Fly.io logs / Railway logs / AWS CloudWatch
- **APM**: Sentry (错误追踪)
- **Uptime**: UptimeRobot / Checkly

### 健康检查

API 提供健康检查端点:
```
GET https://api.joyjoin.com/api/health
```

## 回滚

### 前端回滚

```bash
# Vercel
vercel rollback

# Cloudflare Pages
# 在 Dashboard 中选择之前的部署
```

### 后端回滚

```bash
# Fly.io
fly releases
fly releases rollback <version>

# Railway
# 在 Dashboard 中选择之前的部署
```

## 常见问题

### Q: 跨域问题 (CORS)

确保 API 服务器配置了正确的 CORS:
```typescript
app.use(cors({
  origin: ['https://app.joyjoin.com', 'https://admin.joyjoin.com'],
  credentials: true
}));
```

### Q: 认证 Cookie 不工作

跨域使用 JWT 替代 session cookie, 或配置:
```typescript
app.use(session({
  cookie: {
    domain: '.joyjoin.com',  // 父域名
    sameSite: 'none',
    secure: true
  }
}));
```

### Q: 静态资源 404

确保前端 build 时设置了正确的 base URL:
```typescript
// vite.config.ts
export default defineConfig({
  base: '/',  // 或你的 CDN 路径
});
```
