# JoyJoin 性能优化指南

> **Last updated:** 2026-04-01 (PRs #385, #386, #388, #390)

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

### 1. 路由级代码分割 (active default)

**All non-critical page components must use `React.lazy()` dynamic imports.** This is the active default in `apps/user-client/src/App.tsx` (PR #386):

```typescript
// Critical / above-fold routes — eagerly imported (no lazy)
import DiscoverPage from "@/pages/DiscoverPage";
import PersonalityTestPageV4 from "@/pages/PersonalityTestPageV4";

// All other pages — lazy-loaded (active convention)
const EventsPage = lazy(() => import("@/pages/EventsPage"));
const ConnectionsPage = lazy(() => import("@/pages/ConnectionsPage"));
const ProfilePage = lazy(() => import("@/pages/ProfilePage"));
const MatchingStatusPage = lazy(() => import("@/pages/MatchingStatusPage"));
// … (see App.tsx for the full list)
```

**Guardrail:** Do **not** add static imports for non-critical pages. If in doubt, use `lazy()`.

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

**Prefetch gating:** Asset prefetching should be gated on real activity state. Do not unconditionally prefetch large background assets for users who have no active events (see PR #363 — center-tab empty-state page gates background asset prefetch for no-activity users).

### 4. 静态数据缓存

静态元数据（如人格特质、原型定义）配置较长的 `staleTime`：

```typescript
{
  queryKey: ['/api/archetypes'],
  staleTime: Infinity, // 静态数据不过期
}
```

### 5. 资源优化

#### 图片格式 (updated, PR #388)

- **Hero images:** Use **WebP** format with `decoding="async"` on the `<img>` tag. PNG is no longer the default for hero images. Example from `LandingPage.tsx`:
  ```tsx
  <img src={matchCardImg} alt="…" decoding="async" />
  ```
  Landing page hero images are in `apps/user-client/src/assets/landing screen/*.webp`.
- **Non-critical images:** Add `loading="lazy"` to defer off-screen images.
- **Animated SVGs:** Optimise (run through SVGO) before committing — see empty-state SVGs (PR #362).
- **字体**: 使用 `font-display: swap`，仅加载必要字重
- **动画**: Lottie JSON 控制在 80KB gzip 以下

#### Archetype assets

The 12 archetype PNG files are large (~120–300 KB each). `DiscoverPage.tsx` defers archetype image loads until they are needed (PR #386). Do not eagerly preload all archetype assets in the critical path.

#### Matching-state assets (centralized, PR #390)

All matching-state screens share a single background SVG (`apps/user-client/src/assets/matching/shared/matching-bg.svg`). State-specific hero images live in sibling subdirectories:

```
apps/user-client/src/assets/matching/
├── shared/              # ← single shared dark background
│   └── matching-bg.svg
├── waiting/
│   └── matching-waiting-hero.svg
├── no-match/
│   └── no-match-hero.svg
├── join-error/
│   └── join-error-hero.svg
├── extended-data-empty/
│   └── extended-data-empty-hero.svg
└── test-incomplete/
    └── …
```

**Guardrail:** Do **not** duplicate `matching-bg.svg` into per-screen directories. Always import from `matching/shared/matching-bg.svg` via `MatchingStateLayout`.

### 6. 构建优化 / Vite chunk strategy (PR #385)

- Admin-only code must **not** be imported into `apps/user-client` — it inflates the user bundle unnecessarily. Dead admin code was removed from user-client in PR #385.
- Vite manual chunk grouping: vendor libraries (`react`, `framer-motion`, `@tanstack/react-query`) are split into a stable vendor chunk; feature chunks are kept per-route via `lazy()`.
- Uses esbuild for minification.
- Only preload the critical vendor chunk and the initial route chunk.
- Configure a reasonable `browserslist` target for the mobile-first audience.

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
// … 路由切换 …
performance.measure('route-transition', 'route-start');
```

## 验证方法

1. **Lighthouse 审计**: 使用移动端节流模式运行
2. **Bundle 分析**: `npm run build -- --analyze`
3. **开发者工具**: Performance 面板录制路由切换

## 目标场景

- 注册流程: onboarding → 性格测试 → 资料填写 → 引导页 → 发现首页
- p75 移动网络下，整体流程 TTI ≤ 2s

## Performance Guardrails (summary)

| Guardrail | Rule |
|-----------|------|
| Non-critical routes | Must use `React.lazy()` — no static imports in `App.tsx` |
| Admin code | Must not be imported into `apps/user-client` |
| Matching background | Reuse `matching/shared/matching-bg.svg` via `MatchingStateLayout` — never duplicate |
| Hero images | Use WebP + `decoding="async"`; avoid large PNG |
| Archetype assets | Defer / gate — do not preload all 12 in the critical path |
| Asset prefetching | Gate on real activity state — do not prefetch for no-activity users |
