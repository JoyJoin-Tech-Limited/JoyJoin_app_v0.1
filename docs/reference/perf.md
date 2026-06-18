# JoyJoin 性能优化指南

> **Last updated:** 2026-06-17 (Profile-linked subpackage migration + `usePageTTI` instrumentation with cold ≤2000 ms / warm ≤800 ms budgets)
> **Previous:** 2026-06-16 (Profile page predictive prefetch + offline-first shell + share-card degradation)
> **Previous:** 2026-05-13 (device baseline tiering: tier-1 Gen Z 8GB+/120Hz/5G primary, degradation path secondary)
> **Previous:** 2026-05-22 (archetype asset optimization: local spritesheet, WebP-first canvas, PNG moved to CDN, onboarding subpackage 1.4M → 788K)

## Device Baseline Tiers

JoyJoin uses a **tiered device baseline** rather than a single lowest-common-denominator target.

| Tier | Target demographic | Baseline assumption | UX goal |
|------|-------------------|---------------------|---------|
| **Primary** | Tier-1 city Gen Z (Beijing, Shanghai, Guangzhou, Shenzhen) | 8GB+ RAM, 120Hz AMOLED, 5G, Snapdragon 7s Gen 2 / Dimensity 8200+ or better | Full fidelity: smooth 120Hz motion, rich assets, real-time features |
| **Degradation** | Lower-tier cities, older devices, entry-level phones | 4–6GB RAM, 60Hz LCD, 4G, older MediaTek or budget Snapdragon | Graceful reduction: shorter animations, lower-res images, reduced particle effects |

**Rationale (2025–2026 data):**
- Counterpoint Dec 2025: global avg smartphone DRAM = **8.4GB**; Huawei avg in China = **12GB**; premium segment avg = **~11GB**
- QuestMobile Jun 2025: vivo 40.7% / Xiaomi 35.2% / OPPO 32.8% of users under 24; Gen Z upgrading to **>3,000 yuan** devices (+1.4% YoY)
- MIIT Jan 2026: **65.9% 5G penetration** nationally; tier-1 cities have 5G-A with **131+ Mbps**

Frontend work should **optimize for the Primary tier** and maintain a **graceful degradation path** for the Degradation tier. Do not let the Degradation tier dictate the ceiling for the Primary tier.

> **Runtime tier detection (2026-06-13):** `apps/mini-program/src/hooks/useDeviceTier.ts` uses `benchmarkLevel` on Android (`<= 15` = degradation) and falls back to iOS model/system heuristics when `benchmarkLevel` is unavailable. iPhone XR/XS/XS Max and iPhone SE 2/3 are classified as primary; old iPhone X/8/7/6/6s and first-gen SE, or iOS <15, are degradation.

## 性能预算

| 指标 | Primary tier 目标 | Degradation tier 目标 | 说明 |
|------|-------------------|----------------------|------|
| TTI (Time to Interactive) | ≤ 1.5s (p75) | ≤ 2.5s (p75) | Primary: 5G 下; Degradation: 4G 下 |
| 路由切换时间 | ≤ 600ms | ≤ 1s | 页面间导航响应时间 |
| JS Bundle 大小 | ≤ 200KB gzip | ≤ 150KB gzip | 每个路由独立 bundle; Primary 可接受更大 bundle 换取功能完整性 |
| FCP (First Contentful Paint) | ≤ 1.2s | ≤ 1.8s | 首次内容渲染 |
| LCP (Largest Contentful Paint) | ≤ 2.0s | ≤ 3.0s | 最大内容渲染 |
| CLS (Cumulative Layout Shift) | ≤ 0.1 | ≤ 0.1 | 累积布局偏移 |

**Image quality budget (Primary tier):**
- Hero images: WebP at higher quality (Q80–85 vs previous Q60–70)
- Animation assets: Lottie JSON up to 120KB gzip acceptable if gated to Primary tier
- Archetype assets: full-resolution PNG/WebP on Primary; downscaled on Degradation
- Mascot animation assets: animated WebP (~450–500 KB) on Primary; static WebP fallback (~10 KB) shown when `prefers-reduced-motion: reduce` is active

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

**Tiered loading note:** On Primary-tier devices, consider eager-loading critical tab routes (Discover, Events) if the device has ≥8GB RAM. On Degradation-tier devices, keep all non-tab routes lazy-loaded.

### 2. Suspense 边界

每个路由使用 `Suspense` 包裹，配合 `LoadingScreen` 骨架屏：

```typescript
<Suspense fallback={<LoadingScreen />}>
  <Router />
</Suspense>
```

### 3. 数据预取

#### Predictive Shell 预取（composite endpoint，2026-05-17）

The mini-program uses **composite shell endpoints** to prefetch tab data before the user switches tabs. The landing page stages prefetches via `PrefetchEngine` after entry animation:

```typescript
// apps/mini-program/src/pages/index/index.tsx
const engine = getPrefetchEngine(queryClient);
engine.stage('discover', async () => {
  const shell = await fetchDiscoverShell();
  injectDiscoverShellIntoCache(queryClient, shell);
});
engine.stage('events', async () => {
  const shell = await fetchEventsShell();
  injectEventsShellIntoCache(queryClient, shell);
}, 3000);
```

**Key properties:**
- **Auth injection is gated** for Discover/Events/Connections shells — only injects if the auth cache is empty, to avoid overwriting a full `AuthUserResponse` with a pruned one.
- **Profile shell injects unconditionally** — it returns the full `AuthUserResponse`, so it is safe to overwrite.
- **Server-side cache:** `ShellCache` (NodeCache, 30s TTL) reduces DB round-trips. Invalidated on mutations via `shellCache.invalidateUser(userId)`.
- **Fallback:** Events and Connections pages gracefully fall back to legacy endpoints if composite 500s.

See `docs/mini-program/mini-program-data-fetching.md` for query key mapping and `apps/mini-program/src/lib/prefetchEngine.ts` for the engine implementation.

#### 页面 TTI 监控（2026-06-17）

`apps/mini-program/src/hooks/usePageTTI.ts` 提供轻量级小程序页面首达可交互时间（Time to Interactive）埋点：

- 以 `useLoad` / `useDidShow` 作为起点，`ready` prop（可选）作为内容可交互信号。
- 预算：冷启动 ≤ 2000 ms，温启动 / 预载分包 ≤ 800 ms。
- 通过 `logInfo` 上报，并在微信环境回退到 `wx.reportAnalytics('page_tti', ...)`。
- 不阻塞渲染、不抛异常、无副作用；已应用于 `pages/profile-linked/*` 迁移页面。

#### Profile 页预取与离线韧性（2026-06-16）

`apps/mini-program/src/pages/profile/index.tsx` 在数据稳定后通过 `PrefetchEngine` 预取相邻的 Events 与 Connections shells，减少 tab 切换冷启动耗时。同时采用以下策略保证弱网/离线体验：

- `useQuery` 配置 `networkMode: 'offlineFirst'`，配合指数退避 `retryDelay` 与离线感知 `retry` 谓词，避免离线时无限重试。
- 监听 `Taro.onNetworkStatusChange`，网络恢复时自动重新拉取 `GET /api/shell/profile`。
- 错误态优先展示缓存的 `PROFILE_SHELL_QUERY_KEY` 数据（`profileShell = shell ?? cachedShell`），仅在无缓存时才显示错误卡片。
- 分享海报（750×750 canvas）在 `useDeviceTier().isDegradation` 设备上强制使用 DPR 1，降低大 canvas 内存占用；`profilePoster.ts` 通过 `ctx.draw(false, callback)` 刷新画布并带 15s 超时保护。
- `useProfileShareCard.ts` 使用 `mountedRef` 与 unmount cleanup，防止异步生成/保存海报时泄漏 loading 状态。

#### Legacy per-query prefetch

For non-shell data, use TanStack Query's `prefetchQuery`:

```typescript
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
- **动画**: Lottie JSON ≤ 120KB gzip on Primary tier; ≤ 80KB gzip on Degradation tier. Gate large motion assets behind device capability checks.

#### Archetype assets

The 12 archetype full-size WebP files (~18–25 KB each, ~250 KB total) are served from CDN. The **primary archetype image is preloaded on test completion and again on the results page mount** so the result reveal is instant; the remaining images load on demand. The slot machine spritesheet (20 KB) is bundled locally in the preloaded onboarding subpackage — zero network on animation start.

**Canvas poster generation** draws WebP primary with CDN PNG fallback (PNG moved off-subpackage to CDN in 2026-05-22, saving ~672 KB). The colored-circle fallback (archetype initial + accent color) renders if both formats fail.

**Historical:** PNGs were previously bundled locally (~120–300 KB each, ~641 KB total) for canvas `drawImage` compatibility. WebP canvas support is now primary.

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
- **Primary tier:** Target modern Chromium/WebView (WeChat 8.0+ on Android 12+/iOS 16+). ES2020+ features acceptable.
- **Degradation tier:** Maintain broader compatibility for older WebView versions.

### 7. Mini Program 分包策略（launch-primary 客户端）

`apps/mini-program` 是当前 **launch-primary** WeChat 客户端；性能预算与分包决策优先在这里验证，再对照 web。权威策略说明见 [`apps/mini-program/README.md`](../apps/mini-program/README.md) 的 *Package Loading Strategy*。

**当前主包预算与资产策略（2026-06-18）：**

- 压缩后主包约为 **1.88 MB**，保留约 120 KB 的余量（WeChat 主包硬上限 2 MB）。
- 仅 6 个核心 Xiaoyue  mascot 精灵状态（`welcome`/`idle`/`coach`/`loading`/`listening`/`thinking`）作为本地兜底打包；其余 14 个状态走 CDN。
- `status-icons`、`info-labels`（semantic）、`ui` 三个 icon tier 在构建时剔除 `@3x`，以 `@1x`/`@2x` 打包；3x 设备回退到 `@2x`。
- 48 个兴趣插画（taxonomy v2.0）全部走 CDN，统一通过 `packages/shared/src/interests.ts` 中的 `imageUrl` + `cdnAsset()` 解析。
- `TARO_APP_CDN_BASE_URL` 在 `apps/mini-program/config/index.ts` 与 CI workflow 中均默认回退到 `https://joyjoinapp.com/static`，确保生产构建不会丢失 CDN 前缀。

**代码中的真实配置（与文档同步）：**

| 机制 | 位置 |
|------|------|
| 主包页面列表 + 分包声明 + `preloadRule` | [`apps/mini-program/src/lib/onboarding/onboardingRoutes.ts`](../apps/mini-program/src/lib/onboarding/onboardingRoutes.ts) → 由 [`app.config.ts`](../apps/mini-program/src/app.config.ts) 引用 |
| Onboarding subpackage | `root: pages/onboarding`，7 个页面（见 `MINI_PROGRAM_ONBOARDING_SUBPACKAGE_PAGES`） |
| Pool-registration subpackage | `root: pages/pool-registration`，1 个页面；pool-specific hero backdrops 在分包内 `assets/`，Batch C 仪式化资源走 CDN |
| Matching-status subpackage | `root: pages/matching-status`，1 个页面 |
| Icebreaker-session subpackage | `root: pages/icebreaker-session`，2 个页面 |
| Profile-linked subpackage | `root: pages/profile-linked`，4 个页面（edit-profile, rewards, invite, terms）；从 `pages/profile` 预拉 |
| 预下载 | `MINI_PROGRAM_PRELOAD_RULES`：从 `index`/`login` 预拉 `pages/onboarding`；从 `event-detail`/`events` 预拉 `pages/pool-registration`；从 `profile` 预拉 `pages/profile-linked` |
| 按需注入 | `app.config.ts` 中 `lazyCodeLoading: 'requiredComponents'` |

**可重复探测：** 仓库根目录 `scripts/measure-mini-program-cold-entry.sh`（需本机微信开发者工具 CLI）用于冷启动与 onboarding 预载代理场景，详见 mini-program README *Cold-entry timing probe*。

对 `apps/mini-program` 来说，分包仍是**基于证据的加载决策**，不是默认追求结构复杂度。

- **默认顺序：** 普通分包 -> `preloadRule` -> 资源与首屏清理 -> 再评估是否值得上独立分包
- **主包约束：** tabBar 页面必须留在主包
- **优先对象：** 人格测试、结果页、profile-linked 辅助页，以及其他重资源但非 tabBar 的深链路页面
- **何时考虑独立分包：** 只有在普通分包和 preload 之后，目标页冷启动或首达时间仍明显超预算，并且收益足以覆盖额外 bootstrap 成本
- **JoyJoin 当前成本点：** `apps/mini-program/src/app.ts` 与 `apps/mini-program/src/providers/AuthProvider.tsx` 持有 app 级 providers；独立分包若落地，必须设计自举能力，不能默认依赖现有全局启动链
- **注意：** 异步分包/异步加载可以补充延迟加载，但不能绕过微信分包边界规则

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
4. **小程序分包评估**: 记录主包大小、目标页首达时间、`preloadRule` 是否命中，以及独立分包新增的 bootstrap / 重复资源成本

## 目标场景

- 注册流程: onboarding → 性格测试 → 资料填写 → 引导页 → 发现首页
- **Primary tier:** p75 5G 网络下，整体流程 TTI ≤ 1.5s
- **Degradation tier:** p75 4G 网络下，整体流程 TTI ≤ 2.5s

## Degradation Patterns

When implementing features that push Primary-tier hardware, always provide a fallback:

| Feature | Primary tier | Degradation fallback |
|---------|-------------|----------------------|
| Staggered entrance animations | Full stagger, 120Hz smooth | Reduced stagger or instant reveal |
| Particle / shader effects | Full fidelity | Disabled or static image replacement |
| Mascot intro animation | Animated WebP (~450–500 KB) | Static WebP fallback (~10 KB) via `prefers-reduced-motion` |
| High-res images | WebP Q85, full size | WebP Q60, downscaled |
| Real-time WebSocket features | Enabled | Polling fallback or deferred sync |
| Preload aggressive | Preload next 2–3 screens | Preload only next screen |

## Performance Guardrails (summary)

| Guardrail | Rule |
|-----------|------|
| Non-critical routes | Must use `React.lazy()` — no static imports in `App.tsx` |
| Admin code | Must not be imported into `apps/user-client` |
| Matching background | Reuse `matching/shared/matching-bg.svg` via `MatchingStateLayout` — never duplicate |
| Hero images | Use WebP + `decoding="async"`; avoid large PNG |
| Archetype assets | Preload primary image on test completion + results mount; spritesheet bundled locally; do not bulk-preload all 12 full-size images in the app-launch critical path; canvas draws WebP primary with CDN PNG fallback |
| Interest illustrations | 48 v2.0 interest cards are CDN-only; canonical `imageUrl` in `packages/shared/src/interests.ts`; resolve via `cdnAsset()` |
| Mascot sprite sheets | Bundle only 6 core states locally; remaining 14 states CDN-primary with local fallback on `onError` |
| Bundled icon density | `status`/`semantic`/`ui` tiers ship at `@1x`/`@2x`; `@3x` stripped at build to save package size |
| Asset prefetching | Gate on real activity state — do not prefetch for no-activity users. Primary tier may prefetch more aggressively. |
| Mini Program package loading | Keep tabBar pages in the main package; put heavy non-tab flows (onboarding, pool-registration, matching-status, icebreaker-session) in subpackages with `preloadRule`; justify independent subpackages with measured wins and a self-contained bootstrap plan; stay under ~1.88 MB compressed main package |
| Device capability gate | Use `getSystemInfo` / `benchmarkLevel` to detect tier at runtime; never assume uniform low-end |
