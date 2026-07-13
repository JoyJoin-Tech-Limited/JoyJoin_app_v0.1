# 闪现 NPC｜阿浪内部 Prototype — 仓库审计报告

> 审计范围：JoyJoin 全仓库（mini-program / server / shared / schema）
> 审计日期：2026-07-11
> 约束：仅调查与报告，零代码修改

---

## 1. 真实文件路径确认

### 1.1 去发现 / Discover 页面
- **主页面**：`apps/mini-program/src/pages/discover/index.tsx`（913 行，主 orchestrator）
- **样式**：`apps/mini-program/src/pages/discover/index.scss`
- **配置**：`apps/mini-program/src/pages/discover/index.config.ts`
- **依赖组件**：
  - `apps/mini-program/src/components/discover/OracleCard.tsx` — 活动卡片
  - `apps/mini-program/src/components/discover/LocationFilterDrawer.tsx` — 区域筛选抽屉
  - `apps/mini-program/src/components/discover/CityPickerSheet.tsx` — 城市选择器
  - `apps/mini-program/src/components/discover/CityUnlockFeedCard.tsx` — 城市解锁入口
  - `apps/mini-program/src/components/HeroPromoBanner.tsx` — 顶部横幅
  - `apps/mini-program/src/components/VirtualList/index.tsx` — 虚拟列表
  - `apps/mini-program/src/components/ui/StatusCard.tsx` — 空态/错误态卡片

### 1.2 “我的”页面（Profile Tab）
- **主页面**：`apps/mini-program/src/pages/profile/index.tsx`（498 行）
- **样式**：`apps/mini-program/src/pages/profile/index.scss`
- **子页面（subpackage）**：
  - `apps/mini-program/src/pages/profile-linked/edit-profile/index.tsx`
  - `apps/mini-program/src/pages/profile-linked/rewards/index.tsx`
  - `apps/mini-program/src/pages/profile-linked/invite/index.tsx`
  - `apps/mini-program/src/pages/profile-linked/terms/index.tsx`
- **共享组件**：
  - `apps/mini-program/src/components/profile/ProfileArchetypeHero.tsx`
  - `apps/mini-program/src/components/profile/InterestChipCloud.tsx`
  - `apps/mini-program/src/components/profile/ProfessionDisplayField.tsx`

### 1.3 “我的故事”入口与详情页
- **搜索结果**：仓库中不存在任何名为 `story`、`stories`、`我的故事`、`narrative`、`剧情` 的页面或组件。
- **结论**：该功能不存在，需从零新建。

### 1.4 地图组件
- **搜索结果**：仓库中不存在任何 WeChat `<map>` 组件、腾讯地图 JS SDK 封装、或高德地图封装。
- **已有地理能力**：
  - `apps/mini-program/src/components/discover/LocationFilterDrawer.tsx` — 纯文本区域筛选（无地图）
  - `apps/server/src/routes/domains/geo.ts` — 服务端反地理编码（腾讯地图 WebService API）
  - `apps/server/src/services/ipGeolocationService.ts` — IP 定位服务
- **结论**：无地图组件，需新建。

### 1.5 定位权限与实时定位逻辑
- **客户端**：
  - `apps/mini-program/src/pages/discover/index.tsx:247` — `Taro.getLocation({ type: 'gcj02' })` 单次获取
  - 权限拒绝处理：第 268–289 行，区分 `deny` / `timeout` / `error`
  - IP 回退：`ipLocate(apiRequest)` 第 291–313 行
- **服务端**：
  - `apps/server/src/routes/domains/geo.ts` — `/api/geo/reverse-geocode` 与 `/api/geo/ip-locate`
- **结论**：仅有单次 GPS 获取（非实时），无后台持续定位或 watch 逻辑。

### 1.6 距离计算逻辑
- **客户端**：无 haversine 或任何距离计算代码。
- **服务端**：无距离计算代码。
- **已有地理数据**：`packages/shared/src/districts.ts` 包含深圳各区的 bounding box（用于区域归属判断，非距离）。
- **结论**：无距离计算能力，需新建。

### 1.7 内部测试账号或 Feature Flag
- **Feature Flag 系统**：
  - `apps/server/src/lib/featureFlags.ts` — DB-backed + env fallback，17 个已知 flag
  - 客户端读取：`authUser.features.*`（由 `buildAuthUserResponse.ts` 注入）
- **测试模式**：
  - `apps/server/src/lib/isSingleTestMode.ts` — `ENABLE_SINGLE_TEST_MODE` / `APP_MODE=test`
  - `apps/server/src/services/singleTestService.ts` — 虚拟用户 + 单人调试局
  - `apps/server/src/services/matchingTestService.ts` — 匹配测试（bot 填充）
  - `apps/mini-program/src/components/dev/SingleTestBanner.tsx` — Discover 页调试横幅（`appMode === 'test'`）
- **Dev 工具路由**：`apps/server/src/routes/domains/devTools.ts` — `/api/dev/*`（创建 admin/用户、绕过测试等）
- **结论**：已有完善的测试账号与 feature flag 基础设施，可直接复用。

### 1.8 Server 路由入口
- **注册中心**：`apps/server/src/routes.ts` — 所有路由注册于此
- **已有路由列表**（与 Alang 可能相关）：
  - `registerGeoRoutes(app)` — 地理
  - `registerDevToolRoutes(app)` — 开发工具
  - `registerTestAdminRoutes(app)` — 测试管理
  - `registerSingleTestRoutes(app)` — 单人测试
  - `registerMatchingTestRoutes(app)` — 匹配测试
  - `registerAnalyticsRoutes(app)` — 埋点
  - `registerAuthRoutes(app)` — 认证
- **结论**：新增 Alang 路由需在此注册。

### 1.9 数据库 Schema / Migration
- **Schema 定义**：`packages/shared/src/schema/_definitions.ts`（1910 行，主表）
- **扩展定义**：`packages/shared/src/schema/_definitions_extended.ts`（1659 行，扩展表）
- **导出索引**：`packages/shared/src/schema/index.ts`
- **已有相关表**：
  - `users` — 用户主表（含 `isTestBot`, `appMode` 等）
  - `eventPools`, `eventPoolGroups`, `eventPoolRegistrations` — 活动池
  - `userLocationSnapshots`, `userLocationAggregates` — 用户位置快照（已有，但未用于实时追踪）
  - `featureFlags` — 功能开关
  - `socialIcebreakerSessions` — 破冰会话
- **Migration 目录**：`apps/server/migrations/`（阿浪迁移为 `0062_military_spirit.sql`）
- **结论**：Prototype 新增 `alangMissions`, `alangMissionProgress`, `alangStoryArchives` 三张表。

### 1.10 Session 或任务状态保存机制
- **客户端状态**：
  - `Taro.setStorageSync` / `Taro.getStorageSync` — 本地存储（如 `discover_last_location`）
  - TanStack Query + `persistentCache.ts` — 查询缓存持久化（4h TTL，75KB cap）
- **服务端状态**：
  - `express-session` + `connect-pg-simple` — 会话存储于 PostgreSQL
  - 各业务表自有状态字段（如 `eventPoolRegistrations.matchStatus`）
- **结论**：无专门的任务/剧情状态机表，需新建。

### 1.11 现有 JSON 配置加载机制
- **客户端**：
  - `apps/mini-program/src/pages/onboarding/assets/archetypes/archetype-spritesheet.json` — 精灵图配置
  - `apps/mini-program/src/lib/utils/routePreloadAssets.ts` — 路由级 CDN 预加载配置
  - `apps/mini-program/src/lib/utils/onboardingPreload.ts` —  onboarding 资源预加载
- **服务端**：
  - 无独立 JSON 配置文件加载机制；数据均来自 DB 或 env var
  - `packages/shared/src/districts.ts` — 深圳区域数据（TS 模块，非 JSON）
  - `packages/shared/src/interests.ts` — 兴趣分类（TS 模块）
- **结论**：服务端无动态 JSON 配置加载器，需新建或复用现有 TS 模块模式。

---

## 2. 能力存在性判断

| 能力 | 状态 | 证据 |
|------|------|------|
| 内部账号可见入口 | ✅ 已存在 | `SingleTestBanner`（`appMode === 'test'`）+ `isSingleTestMode()` |
| 地图拖动选点 | ❌ 不存在 | 无 `<map>` 组件、无腾讯地图 JS SDK 封装 |
| 实时 GPS 更新 | ❌ 不存在 | 仅单次 `Taro.getLocation`，无 `wx.onLocationChange` |
| 5 米到达判定 | ❌ 不存在 | 无距离计算逻辑 |
| 中途退出恢复 | ⚠️ 部分存在 | 客户端有 `persistentCache.ts`（查询缓存），但无任务级状态恢复 |
| 故事完整回看 | ❌ 不存在 | 无故事/剧情相关页面或数据模型 |
| 测试重置 | ✅ 已存在 | `cleanupSingleTestData()` + `/api/test/single-test/reset` |
| 调试手动推进 | ✅ 已存在 | `/api/test/social-icebreaker/:id/force-phase`（TestAdmin） |
| 内容 JSON 驱动 | ⚠️ 部分存在 | 客户端有 JSON 配置（spritesheet、preload），服务端无动态 JSON 内容驱动 |
| 现有埋点与日志机制 | ✅ 已存在 | `discoverAnalytics.ts`（前端）+ `logger.ts`（后端）+ `telemetry` 路由 |

---

## 3. 风险识别

### 3.1 禁止重做的现有 UI
- **Discover 页面**（`pages/discover/index.tsx`）：已高度工程化（913 行），含虚拟列表、区域筛选、城市解锁、Promo Banner、GPS 自动检测。Alang 入口应作为新增卡片/横幅插入，禁止重写页面框架。
- **Profile 页面**（`pages/profile/index.tsx`）：已 redesign（2026-06-16），含 hero、成就、菜单行。Alang 入口应作为新增菜单行插入，禁止重写。
- **Custom Tab Bar**（`native-custom-tab-bar/index.js`）：已历经 10+ 轮 hardening，任何改动需极度谨慎。
- **LocationFilterDrawer / CityPickerSheet**：已稳定，可直接复用样式语言（`PickerShell` + `SelectableTile`）。

### 3.2 只能接数据、不能改版的页面
- **Event Detail**（`pages/event-detail/index.tsx`）：只读展示，Alang 不应介入。
- **Pool Registration**（`pages/pool-registration/index.tsx`）：注册流程，Alang 不应介入。
- **Matching Status**（`pages/matching-status/index.tsx`）：匹配状态机，Alang 不应介入。
- **Icebreaker Session**（`pages/icebreaker-session/index.tsx`）：核心破冰流程，Alang 不应介入。
- **Squad Unboxing**（`pages/squad-unboxing/index.tsx`）：揭晓流程，Alang 不应介入。

### 3.3 可能被影响的现有流程
- **Auth / Login**：若 Alang 需要独立登录态（如内部测试账号），需评估与现有 WeChat 登录的冲突。
- **Feature Flags**：新增 `alangEnabled` flag 需加入 `FLAG_ENV_MAP` 和 `buildAuthUserResponse.ts` 的并行解析。
- **Analytics**：新增 Alang 事件需加入 `discoverAnalytics.ts` 或新建 `alangAnalytics.ts`，避免污染现有事件命名空间。
- **Database Migrations**：新增表使用显式 migration。Staging 不会自动执行 DDL；部署前必须对 `postgres-staging` 手动执行 `psql "$DATABASE_URL" -f apps/server/migrations/0062_military_spirit.sql`。
- **Package Size**：WeChat 主包 2MB 限制。新增页面需评估是否放入 subpackage。

### 3.4 是否需要新增数据库表或 Migration
- **是**。至少需要：
  - `alang_missions` — 任务定义（JSON 驱动内容）
  - `alang_mission_progress` — 用户任务进度（状态机、GPS 坐标、完成时间）
  - `alang_story_archives` — 完成后的故事档案（路径、选择、收尾文案）

### 3.5 跨平台问题
- **macOS 路径**：仓库使用 Windows 路径（`D:/Projects/...`），但代码中使用 Unix 路径（`/assets/...`）。无已知跨平台问题。
- **环境变量**：
  - `TENCENT_MAP_KEY` — 腾讯地图 WebService Key（已有）
  - 若新增地图组件，需确认是否需要 **腾讯地图 JavaScript Key**（`TENCENT_MAP_JS_KEY`）— 目前仅 admin portal 使用，mini-program 未使用。
- **WeChat 地图组件**：`<map>` 组件需要 `MapContext` 和 `getCenterLocation`，与现有 Taro 版本兼容需验证。
- **旧配置**：无遗留 `hometown` 等已删除字段的引用风险。

---

## 4. 不确定项（标记为 unknown）

| 项 | 说明 |
|----|------|
| 阿浪内容创作流程 | 无文档或代码提及“阿浪”或“Alang”，内容生产流程未知 |
| 目标用户规模 | 内部 Prototype 的预期并发/用户量未知 |
| 是否需独立 Admin 后台 | 阿浪任务配置是否需要 Admin UI 未知 |
| 与现有 Social Icebreaker 的交集 | 阿浪是否作为 icebreaker 的前置/后置环节未知 |
| 地图组件精确坐标系 | 是否使用 `gcj02`（国测局）或 `wgs84` 未知；现有代码使用 `gcj02` |
| 离线模式需求 | 阿浪是否需支持无网络场景未知 |

---

## 5. 审计总结

- **复用基础强**：测试账号体系、feature flag、埋点、GPS 单次获取、区域筛选 UI 均已成熟。
- **缺失核心能力**：地图组件、实时 GPS、距离计算、故事状态机、JSON 内容驱动 均需新建。
- **侵入性可控**：通过新增菜单行/卡片入口、新增 subpackage 页面、新增 DB 表实现，不改动现有核心流程。
- **最大风险**：WeChat 包体积（2MB 限制）和地图组件在低端机上的性能表现。
