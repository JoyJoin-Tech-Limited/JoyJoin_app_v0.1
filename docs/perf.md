# JoyJoin 性能优化指南

## 性能预算

| 指标 | 目标值 | 说明 |
|------|--------|------|
| TTI (Time to Interactive) | ≤ 2s (p75) | 移动端 3G/4G 网络下 |
| 路由切换时间 | ≤ 1s | 页面间导航响应时间 |
| JS Bundle 大小 | ≤ 150-200KB gzip | 每个路由独立 bundle |
| FCP (First Contentful Paint) | ≤ 1.5s | 首次内容渲染 |
| LCP (Largest Contentful Paint) | ≤ 2.5s | 最大内容渲染 |
| CLS (Cumulative Layout Shift) | ≤ 0.1 | 累积布局偏移 |

## 优化策略

### 1. 路由级代码分割

所有页面组件使用 `React.lazy()` 动态导入：

```typescript
const DiscoverPage = lazy(() => import("@/pages/DiscoverPage"));
const PersonalityTestPageV4 = lazy(() => import("@/pages/PersonalityTestPageV4"));
```

### 2. Suspense 边界

每个路由使用 `Suspense` 包裹，配合 `LoadingScreen` 骨架屏：

```typescript
<Suspense fallback={<LoadingScreen />}>
  <Router />
</Suspense>
```

### 3. 数据预取

使用 TanStack Query 的 `prefetchQuery` 预取下一步数据：

```typescript
// 在当前步骤空闲时预取下一步数据
queryClient.prefetchQuery({
  queryKey: ['/api/next-step-data'],
  staleTime: 5 * 60 * 1000,
});
```

### 4. 静态数据缓存

静态元数据（如人格特质、原型定义）配置较长的 `staleTime`：

```typescript
{
  queryKey: ['/api/archetypes'],
  staleTime: Infinity, // 静态数据不过期
}
```

### 5. 资源优化

- **图片**: 使用 WebP/AVIF 格式，非关键图片设置 `loading="lazy"`
- **字体**: 使用 `font-display: swap`，仅加载必要字重
- **动画**: Lottie JSON 控制在 80KB gzip 以下

### 6. 构建优化

- Vite 使用 esbuild 压缩
- 仅预加载关键 chunk
- 配置合理的 browserslist 目标

## 监控指标

### Web Vitals 日志

开发环境下自动记录 Web Vitals 到控制台：

```typescript
import { logWebVitals } from '@/lib/webVitals';
logWebVitals(); // 初始化性能监控
```

### 性能标记

关键路由使用 `performance.mark/measure`：

```typescript
performance.mark('route-start');
// ... 路由切换 ...
performance.measure('route-transition', 'route-start');
```

## 验证方法

1. **Lighthouse 审计**: 使用移动端节流模式运行
2. **Bundle 分析**: `npm run build -- --analyze`
3. **开发者工具**: Performance 面板录制路由切换

## 目标场景

- 注册流程: onboarding → 性格测试 → 资料填写 → 引导页 → 发现首页
- p75 移动网络下，整体流程 TTI ≤ 2s
