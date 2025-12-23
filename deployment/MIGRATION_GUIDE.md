# JoyJoin 代码迁移指南

> ⚠️ 此指南用于将现有代码迁移到 monorepo 结构。在生产部署前执行。

## 迁移概览

```
当前结构:                      目标结构:
├── client/                   ├── apps/
│   └── src/                  │   ├── user-client/src/
│       ├── pages/            │   ├── admin-client/src/
│       │   ├── admin/        │   └── server/src/
│       │   └── *.tsx         ├── packages/
│       └── components/       │   └── shared/src/
├── server/                   └── deployment/
└── shared/
```

## 第一步：配置 Workspace

### 1.1 更新根目录 package.json

```json
{
  "name": "joyjoin",
  "private": true,
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "dev": "npm run dev --workspace apps/server",
    "dev:user": "npm run dev --workspace apps/user-client",
    "dev:admin": "npm run dev --workspace apps/admin-client",
    "build": "npm run build --workspaces",
    "build:user": "npm run build --workspace apps/user-client",
    "build:admin": "npm run build --workspace apps/admin-client",
    "build:server": "npm run build --workspace apps/server",
    "check": "tsc --build",
    "db:push": "drizzle-kit push",
    "test": "npx tsx server/tests/runSimulation.ts 100"
  }
}
```

### 1.2 创建根目录 tsconfig.json

```json
{
  "compilerOptions": {
    "composite": true,
    "declaration": true,
    "declarationMap": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "incremental": true,
    "isolatedModules": true,
    "moduleResolution": "bundler",
    "noEmit": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "strict": true
  },
  "references": [
    { "path": "apps/user-client" },
    { "path": "apps/admin-client" },
    { "path": "apps/server" },
    { "path": "packages/shared" }
  ]
}
```

## 第二步：迁移共享代码

### 2.1 移动 schema 和类型

```bash
# 创建共享包结构
mkdir -p packages/shared/src/{components/ui,lib,types}

# 移动 schema
cp shared/schema.ts packages/shared/src/schema.ts

# 移动共享类型
cp client/src/lib/queryClient.ts packages/shared/src/lib/
cp client/src/lib/utils.ts packages/shared/src/lib/
```

### 2.2 移动 UI 组件

```bash
# 复制所有 shadcn UI 组件
cp -r client/src/components/ui/* packages/shared/src/components/ui/
```

### 2.3 创建共享包入口 (packages/shared/src/index.ts)

```typescript
// Types and Schema
export * from './schema';

// Utilities
export * from './lib/utils';
```

## 第三步：迁移用户端

### 3.1 移动页面和组件

```bash
# 移动用户端页面 (排除 admin/)
mkdir -p apps/user-client/src/{pages,components,hooks,lib}

# 复制非管理员页面
for file in client/src/pages/*.tsx; do
  cp "$file" apps/user-client/src/pages/
done

# 复制组件 (排除 admin/)
cp -r client/src/components/* apps/user-client/src/components/
rm -rf apps/user-client/src/components/admin

# 复制 hooks
cp -r client/src/hooks/* apps/user-client/src/hooks/
```

### 3.2 创建用户端 App.tsx

```typescript
// apps/user-client/src/App.tsx
import { Switch, Route } from 'wouter';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@joyjoin/shared/lib/queryClient';
import { Toaster } from '@joyjoin/shared/ui/toaster';

// 用户端页面
import HomePage from './pages/HomePage';
import ProfilePage from './pages/ProfilePage';
import EventsPage from './pages/EventsPage';
// ... 其他用户端页面

function Router() {
  return (
    <Switch>
      <Route path="/" component={HomePage} />
      <Route path="/profile" component={ProfilePage} />
      <Route path="/events" component={EventsPage} />
      {/* ... 其他用户端路由 */}
    </Switch>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router />
      <Toaster />
    </QueryClientProvider>
  );
}
```

### 3.3 更新导入路径

所有用户端代码中的导入需要更新:

```typescript
// 旧导入
import { Button } from '@/components/ui/button';
import { users } from '@shared/schema';

// 新导入
import { Button } from '@joyjoin/shared/ui/button';
import { users } from '@joyjoin/shared/schema';
```

## 第四步：迁移管理端

### 4.1 移动页面和组件

```bash
# 移动管理员页面
mkdir -p apps/admin-client/src/{pages,components}
cp -r client/src/pages/admin/* apps/admin-client/src/pages/
cp -r client/src/components/admin/* apps/admin-client/src/components/
```

### 4.2 创建管理端 App.tsx

```typescript
// apps/admin-client/src/App.tsx
import { Switch, Route, Redirect } from 'wouter';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@joyjoin/shared/lib/queryClient';

// 管理端页面
import AdminLayout from './pages/AdminLayout';
import AdminDashboard from './pages/AdminDashboard';
import AdminUsersPage from './pages/AdminUsersPage';
// ... 其他管理端页面

function Router() {
  return (
    <AdminLayout>
      <Switch>
        <Route path="/" component={AdminDashboard} />
        <Route path="/users" component={AdminUsersPage} />
        <Route path="/events" component={AdminEventsPage} />
        {/* ... 其他管理端路由 */}
      </Switch>
    </AdminLayout>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router />
    </QueryClientProvider>
  );
}
```

## 第五步：迁移后端

### 5.1 移动服务器代码

```bash
# 移动所有服务器代码
cp -r server/* apps/server/src/
```

### 5.2 更新服务器入口

```typescript
// apps/server/src/index.ts
import express from 'express';
import cors from 'cors';
import { registerRoutes } from './routes';

const app = express();

// CORS 配置 - 允许两个门户
app.use(cors({
  origin: process.env.CORS_ORIGINS?.split(',') || [
    'http://localhost:5001',  // User portal dev
    'http://localhost:5002',  // Admin portal dev
  ],
  credentials: true,
}));

app.use(express.json());

// 健康检查端点
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 注册所有路由
registerRoutes(app);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 API Server running on port ${PORT}`);
});
```

## 第六步：验证迁移

### 6.1 安装依赖

```bash
# 清理旧依赖
rm -rf node_modules package-lock.json

# 重新安装
npm install
```

### 6.2 本地测试

```bash
# 启动后端
npm run dev

# 新终端 - 启动用户端
npm run dev:user

# 新终端 - 启动管理端
npm run dev:admin
```

### 6.3 验证构建

```bash
# 构建所有
npm run build

# 检查输出
ls -la dist/
# 应该看到:
# dist/user-client/
# dist/admin-client/
# dist/server/
```

## 迁移清单

- [ ] 更新根 package.json 添加 workspaces
- [ ] 创建根 tsconfig.json
- [ ] 迁移 schema 到 packages/shared
- [ ] 迁移 UI 组件到 packages/shared
- [ ] 迁移用户端页面到 apps/user-client
- [ ] 迁移管理端页面到 apps/admin-client
- [ ] 迁移服务器代码到 apps/server
- [ ] 更新所有导入路径
- [ ] 测试本地开发
- [ ] 测试构建输出
- [ ] 运行 CI/CD 流水线测试

## 回滚方案

如果迁移出现问题，可以回滚：

```bash
# 使用 Git 回滚
git checkout main -- client/ server/ shared/ package.json

# 重新安装依赖
npm install
```

## 常见问题

### Q: 导入路径错误

使用 VSCode 的 "Find and Replace" 批量替换：
- `@/components/ui/` → `@joyjoin/shared/ui/`
- `@shared/schema` → `@joyjoin/shared/schema`

### Q: TypeScript 路径解析问题

确保每个 app 的 tsconfig.json 包含正确的 paths：

```json
{
  "compilerOptions": {
    "paths": {
      "@joyjoin/shared/*": ["../../packages/shared/src/*"],
      "@/*": ["./src/*"]
    }
  }
}
```

### Q: Tailwind CSS 找不到样式

更新每个 app 的 tailwind.config.ts content 路径：

```typescript
export default {
  content: [
    './src/**/*.{ts,tsx}',
    '../../packages/shared/src/**/*.{ts,tsx}',
  ],
  // ...
}
```
