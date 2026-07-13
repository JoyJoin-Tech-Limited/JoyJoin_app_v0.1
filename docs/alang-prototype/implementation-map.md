# 闪现 NPC｜阿浪内部 Prototype — Implementation Map

> **实现校准（2026-07-12）**：最终 Prototype 使用
> `packages/shared/src/schema/_definitions_extended.ts`，持久化表为
> `alang_missions`、`alang_mission_progress`、`alang_story_archives`；9 个页面统一位于
> `pages/alang` subpackage。文中的早期伪代码仅保留设计背景，部署与回滚以本说明末尾及
> `docs/product/LAUNCH_CONFIG.md` 为准。

> 基于仓库审计报告（`repository-audit.md`）的落地实施蓝图。
> 所有路径均为真实仓库路径；不确定处标记为 `unknown`。
> 约束：仅新增文件/表，禁止重写现有核心页面。

---

## 1. 真实文件路径（复用基座）

### 1.1 前端复用点
| 复用目标 | 真实路径 | 复用方式 |
|---------|---------|---------|
| Discover 入口 | `apps/mini-program/src/pages/discover/index.tsx` | 新增 `AlangFeedCard` 插入列表底部（仿 `CityUnlockFeedCard`） |
| Profile 入口 | `apps/mini-program/src/pages/profile/index.tsx` | 新增菜单行（仿 `我的足迹` 行） |
| 区域筛选 UI | `apps/mini-program/src/components/discover/LocationFilterDrawer.tsx` | 复用 `PickerShell` + `SelectableTile` 样式语言 |
| 状态卡片 | `apps/mini-program/src/components/ui/StatusCard.tsx` | 复用空态/错误态/成功态 |
|  Xiaoyue 气泡 | `apps/mini-program/src/components/mascot/XiaoyueChatBubble.tsx` | 复用 mascot 对话组件 |
| 震动反馈 | `apps/mini-program/src/lib/utils/haptics.ts` | 直接调用 `haptics('light'/'medium'/'success')` |
| 埋点 | `apps/mini-program/src/lib/analytics/discoverAnalytics.ts` | 新建 `alangAnalytics.ts` 仿照其 BatchTracker 模式 |
| 路由常量 | `apps/mini-program/src/lib/onboarding/onboardingRoutes.ts` | 新增 `alangMission` / `alangStory` / `alangMap` 路径 |
| 子包配置 | `apps/mini-program/src/app.config.ts` | 新增 `pages/alang` subpackage |
| 预加载规则 | `apps/mini-program/src/lib/onboarding/onboardingRoutes.ts:186` | 新增 `pages/alang` 预加载规则 |

### 1.2 后端复用点
| 复用目标 | 真实路径 | 复用方式 |
|---------|---------|---------|
| 路由注册 | `apps/server/src/routes.ts` | 新增 `registerAlangRoutes(app)` |
| Feature Flag | `apps/server/src/lib/featureFlags.ts` | 新增 `alangEnabled: "ALANG_ENABLED"` |
| Auth 响应 | `apps/server/src/lib/buildAuthUserResponse.ts` | 并行 fetch `alangEnabled` 注入 `features` |
| 地理服务 | `apps/server/src/routes/domains/geo.ts` | 复用 `reverseGeocode` / `ipLocate` 做区域校验 |
| 测试模式 | `apps/server/src/lib/isSingleTestMode.ts` | 复用 `isSingleTestMode()` 做调试路由 gate |
| 测试 Admin | `apps/server/src/routes/domains/testAdmin.ts` | 新增 Alang 调试路由（force-node、reset-mission） |
| 日志 | `apps/server/src/lib/logger.ts` | 复用 `logger.info/warn/error` |
| DB 连接 | `apps/server/src/db.ts` | 复用 Drizzle + PostgreSQL |
| Schema 导出 | `packages/shared/src/schema/index.ts` | 新增表导出 |

### 1.3 共享包复用点
| 复用目标 | 真实路径 | 复用方式 |
|---------|---------|---------|
| API DTO | `packages/shared/src/api.ts` | 新增 `alang` 相关请求/响应类型 |
| 地理类型 | `packages/shared/src/api/geo.ts` | 复用 `ReverseGeocodeResponse` / `IpLocateResponse` |
| 区域数据 | `packages/shared/src/districts.ts` | 复用 `shenzhenClusters` 做区域校验 |
| 错误文案 | `packages/shared/src/copy/errorBaselines.ts` | 新增 Alang 专用错误基线 |

---

## 2. 建议新增文件

### 2.1 前端（Mini-Program）
```
apps/mini-program/src/
  pages/alang/
    event/                           # 任务列表/故事入口
    event-detail/                    # 任务详情
    config/                          # 任务配置
    search/                          # GPS 搜索
    dialogue/                        # 三轮对话
    companion/                       # 陪伴步行
    result/                          # 结果页
    story-detail/                    # 已收藏故事详情
    debug/                           # 内部调试面板
  components/alang/
    AlangDiscoverCard.tsx            # Discover 入口卡片
    AlangDiscoverCard.scss
  lib/alang/
    alangAnalytics.ts                # 埋点
    api.ts                           # API transport adapter
    useAlangGps.ts                   # GPS 生命周期、节流与稳定读数
    useAlangMission.ts               # 服务端状态恢复与页面路由
```

### 2.2 后端（Server）
```
apps/server/src/
  routes/domains/alang.ts           # 主路由：/api/alang/*
  services/alangContentService.ts   # JSON 内容管理（DB/文件）
  repositories/alangRepo.ts         # DB 查询封装
  lib/alang/
    alangGeoFence.ts                # 5m 到达判定 + 地理围栏
```

### 2.3 共享包（Shared）
```
packages/shared/src/
  schema/_definitions_extended.ts   # Alang 表定义（Drizzle pgTable）
  api/alang.ts                      # API DTO 类型
  alang/
    contentSchema.ts                # JSON 内容 Schema（Zod）
    missionTypes.ts                 # 任务/状态/节点类型定义
    constants.ts                    # 常量（5m 阈值、GPS 间隔等）
```

### 2.4 内容数据（JSON 驱动）
```
apps/server/content/alang/
  stories/
    demo-story.json                 # 示例故事（节点、选项、GPS 坐标）
```

---

## 3. 建议修改文件（最小侵入）

### 3.1 前端
1. **`apps/mini-program/src/pages/discover/index.tsx`**
   - 在活动列表前新增 `<AlangDiscoverCard />`
   - 条件渲染：`authUser?.features?.alangEnabled === true`

2. **`apps/mini-program/src/pages/profile/index.tsx`**
   - 在菜单列表中新增“我的故事”行（条件渲染 `alangEnabled`）

3. **`apps/mini-program/src/lib/onboarding/onboardingRoutes.ts`**
   - `MINI_PROGRAM_PAGE_PATHS` 新增 9 个 `alang*` 页面常量
   - `MINI_PROGRAM_SUBPACKAGES` 新增 `pages/alang` subpackage
   - `MINI_PROGRAM_PRELOAD_RULES` 新增 `pages/alang` 预加载（从 Discover 预加载）

4. **`apps/mini-program/src/app.config.ts`**
   - `subPackages` 新增 `pages/alang`（由 `onboardingRoutes.ts` 自动注入，通常无需手动改）

### 3.2 后端
1. **`apps/server/src/routes.ts`**
   - 新增 `import { registerAlangRoutes } from './routes/domains/alang'`
   - 在 `registerMatchingTestRoutes(app)` 之后调用 `registerAlangRoutes(app)`

2. **`apps/server/src/lib/featureFlags.ts`**
   - `FLAG_ENV_MAP` 新增 `alangEnabled: "ALANG_ENABLED"`

3. **`apps/server/src/lib/buildAuthUserResponse.ts`**
   - `Promise.all` 并行 fetch 中新增 `getFeatureFlag('alangEnabled', false)`
   - 注入 `features.alangEnabled`

4. **`packages/shared/src/schema/index.ts`**
   - 从 `_definitions_extended.ts` 导出新增表

5. **`packages/shared/src/api.ts`**（或 `api/alang.ts`）
   - 新增 Alang API 函数签名

---

## 4. 数据结构

### 4.1 数据库表（Drizzle pgTable）

```typescript
// packages/shared/src/schema/_definitions_extended.ts

export const alangMissions = pgTable("alang_missions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  slug: varchar("slug").notNull().unique(),          // 任务唯一标识
  title: varchar("title").notNull(),
  description: text("description"),
  contentJson: jsonb("content_json").notNull(),     // 故事节点数组
  targetLocation: jsonb("target_location").$type<{ lat: number; lng: number; radiusMeters: number }>(),
  status: varchar("status").notNull().default("draft"), // draft | active | archived
  isInternalOnly: boolean("is_internal_only").default(true),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const alangMissionProgress = pgTable("alang_mission_progress", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  missionId: varchar("mission_id").notNull().references(() => alangMissions.id),
  currentNodeId: varchar("current_node_id"),         // 当前故事节点
  nodeHistory: jsonb("node_history").$type<string[]>(), // 已访问节点 ID 数组
  gpsHistory: jsonb("gps_history").$type<Array<{ lat: number; lng: number; ts: number }>>(),
  status: varchar("status").notNull().default("in_progress"), // in_progress | arrived | completed | abandoned
  arrivedAt: timestamp("arrived_at"),
  completedAt: timestamp("completed_at"),
  abandonedAt: timestamp("abandoned_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_alang_progress_user").on(table.userId),
  index("idx_alang_progress_mission").on(table.missionId),
  index("idx_alang_progress_status").on(table.status),
]);

export const alangStoryArchives = pgTable("alang_story_archives", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  missionId: varchar("mission_id").notNull().references(() => alangMissions.id),
  progressId: varchar("progress_id").notNull().references(() => alangMissionProgress.id),
  title: varchar("title").notNull(),
  locationName: varchar("location_name"),
  completedAt: timestamp("completed_at").notNull(),
  finalMood: varchar("final_mood"),
  closingLine: text("closing_line"),
  summaryLine: text("summary_line"),
  nodeHistory: jsonb("node_history").notNull().$type<string[]>(),
  choicesMade: jsonb("choices_made").notNull(),
  companionLines: jsonb("companion_lines").$type<string[]>(),
  isDebugSession: boolean("is_debug_session").default(false),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_alang_archive_user").on(table.userId),
  index("idx_alang_archive_mission").on(table.missionId),
  uniqueIndex("uq_alang_archive_progress").on(table.progressId),
]);
```

### 4.2 JSON 内容 Schema（Zod）

```typescript
// packages/shared/src/alang/contentSchema.ts

import { z } from "zod";

export const storyNodeSchema = z.object({
  id: z.string(),
  type: z.enum(["narrative", "choice", "checkpoint", "arrival_gate", "ending"]),
  content: z.object({
    title: z.string().optional(),
    body: z.string(),
    imageUrl: z.string().optional(),
    audioUrl: z.string().optional(),
  }),
  choices: z.array(z.object({
    label: z.string(),
    nextNodeId: z.string(),
    condition: z.object({
      requiredNodeIds: z.array(z.string()).optional(),
      gpsRadiusMeters: z.number().optional(),
    }).optional(),
  })).optional(),
  gpsTrigger: z.object({
    lat: z.number(),
    lng: z.number(),
    radiusMeters: z.number().default(5),
  }).optional(),
  nextNodeId: z.string().optional(),                    // 自动推进（无选择时）
});

export const missionContentSchema = z.object({
  version: z.literal("1.0"),
  title: z.string(),
  description: z.string(),
  startNodeId: z.string(),
  nodes: z.array(storyNodeSchema),
  meta: z.object({
    estimatedDurationMinutes: z.number().optional(),
    difficulty: z.enum(["easy", "medium", "hard"]).optional(),
    tags: z.array(z.string()).optional(),
  }).optional(),
});

export type StoryNode = z.infer<typeof storyNodeSchema>;
export type MissionContent = z.infer<typeof missionContentSchema>;
```

---

## 5. API 设计

### 5.1 路由表

| Method | Path | 描述 | Auth |
|--------|------|------|------|
| GET | `/api/alang/missions` | 获取当前用户可用任务列表 | 需登录 |
| GET | `/api/alang/missions/:slug` | 获取任务详情（含内容 JSON） | 需登录 |
| POST | `/api/alang/missions/:slug/start` | 开始任务 | 需登录 |
| POST | `/api/alang/missions/:slug/progress` | 上报节点进度 | 需登录 |
| POST | `/api/alang/missions/:slug/gps` | 上报 GPS 坐标（用于到达判定） | 需登录 |
| POST | `/api/alang/missions/:slug/choice` | 提交选项 | 需登录 |
| GET | `/api/alang/missions/:slug/recover` | 恢复进行中的任务 | 需登录 |
| POST | `/api/alang/missions/:slug/complete` | 标记完成 | 需登录 |
| POST | `/api/alang/missions/:slug/abandon` | 放弃任务 | 需登录 |
| GET | `/api/alang/debug/status` | 调试：获取任务状态（内部） | 需 `isSingleTestMode()` |
| POST | `/api/alang/debug/force-node` | 调试：强制跳到节点 | 需 `isSingleTestMode()` |
| POST | `/api/alang/debug/reset` | 调试：重置任务进度 | 需 `isSingleTestMode()` |
| POST | `/api/alang/debug/mock-gps` | 调试：模拟 GPS 到达 | 需 `isSingleTestMode()` |

### 5.2 核心 DTO

```typescript
// packages/shared/src/api/alang.ts

export interface AlangMissionSummary {
  id: string;
  slug: string;
  title: string;
  description: string;
  status: "not_started" | "in_progress" | "arrived" | "completed" | "abandoned";
  progressPercent: number;
  currentNodeId?: string;
  estimatedDurationMinutes?: number;
  difficulty?: "easy" | "medium" | "hard";
  tags?: string[];
}

export interface AlangMissionDetail extends AlangMissionSummary {
  content: MissionContent; // JSON 驱动内容
  myProgress: {
    nodeHistory: string[];
    gpsHistory: Array<{ lat: number; lng: number; ts: number }>;
    arrivedAt?: string;
    completedAt?: string;
  };
}

export interface AlangProgressRequest {
  nodeId: string;
  metadata?: Record<string, unknown>;
}

export interface AlangGpsRequest {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp: number;
}

export interface AlangChoiceRequest {
  nodeId: string;
  choiceIndex: number;
}

export interface AlangArrivalResponse {
  arrived: boolean;
  distanceMeters: number;
  radiusMeters: number;
  nodeId: string;
}
```

---

## 6. 前端页面接入点

### 6.1 Discover 入口（`pages/discover/index.tsx`）

```tsx
// 在 CityUnlockFeedCard 下方插入
{(user as any)?.features?.alangEnabled && (
  <AlangFeedCard
    onTap={() => Taro.navigateTo({ url: '/pages/alang/index' })}
    missionCount={alangMissionCount} // 从 shell 或独立 query 获取
  />
)}
```

### 6.2 Profile 入口（`pages/profile/index.tsx`）

```tsx
// 在菜单列表中插入
{(user as any)?.features?.alangEnabled && (
  <View
    className='profile-page__menu-row'
    hoverClass='profile-page__menu-row--pressed'
    onClick={() => { haptics('light'); Taro.navigateTo({ url: '/pages/alang/index' }) }}
  >
    <View className='profile-page__menu-icon-well'>
      <JoyJoinIcon emoji='🗺️' size={44} className='profile-page__menu-icon' />
    </View>
    <Text className='profile-page__menu-label'>我的故事</Text>
    <View className='profile-page__menu-row-right'>
      <View className='profile-page__chevron profile-page__chevron--menu' />
    </View>
  </View>
)}
```

### 6.3 路由常量（`lib/onboarding/onboardingRoutes.ts`）

```typescript
export const MINI_PROGRAM_PAGE_PATHS = {
  // ... existing
  alangMission: 'pages/alang/index',
  alangMissionDetail: 'pages/alang/mission-detail/index',
  alangStory: 'pages/alang/story-reader/index',
  alangDebug: 'pages/alang/debug-panel/index',
} as const

export const MINI_PROGRAM_SUBPACKAGES = [
  // ... existing
  {
    root: 'pages/alang' as const,
    pages: ['index', 'mission-detail/index', 'story-reader/index', 'debug-panel/index'],
  },
]
```

---

## 7. 状态机

### 7.1 任务级状态机（服务端权威）

```
not_started ──start──► in_progress ──arrive──► arrived ──complete──► completed
                              │
                              ├──abandon──► abandoned
                              │
                              └──recover──► in_progress (从节点历史恢复)
```

### 7.2 节点级状态机（客户端 + 服务端同步）

```
[node_enter] ──► [content_rendered] ──► [choice_presented | gps_gate]
                     │
                     ├──choice──► [choice_selected] ──► [next_node]
                     │
                     └──gps_gate──► [polling_gps] ──► [arrived] ──► [next_node]
```

### 7.3 客户端本地状态（`lib/alang/alangMissionState.ts`）

```typescript
interface LocalMissionState {
  missionId: string;
  currentNodeId: string;
  nodeHistory: string[];
  isGpsPolling: boolean;
  lastGpsUpdate: number;
  isOffline: boolean;
  pendingSync: Array<{ type: 'progress' | 'gps' | 'choice'; payload: unknown }>;
}

// Storage key: `jj_alang_${missionId}`
// 恢复逻辑：启动时读取 Storage → 调用 `/api/alang/missions/:slug/recover` → 合并服务端状态
```

---

## 8. JSON 内容 Schema

### 8.1 文件位置
- **服务端**：`apps/server/content/alang/stories/*.json`
- **加载方式**：启动时加载到内存（Map<slug, MissionContent>），或按需从 DB `alangMissions.contentJson` 读取

### 8.2 示例内容（`demo-story.json`）

```json
{
  "version": "1.0",
  "title": "阿浪的初次登场",
  "description": "在深圳湾公园找到阿浪，听他讲述一个关于巧合的故事。",
  "startNodeId": "intro",
  "nodes": [
    {
      "id": "intro",
      "type": "narrative",
      "content": {
        "title": "一封匿名邀请函",
        "body": "你收到一条没有署名的消息：『今晚 7 点，深圳湾公园观景台，有人会告诉你一个秘密。』"
      },
      "nextNodeId": "choice_transport"
    },
    {
      "id": "choice_transport",
      "type": "choice",
      "content": {
        "body": "你决定怎么去？"
      },
      "choices": [
        { "label": "地铁", "nextNodeId": "metro_scene" },
        { "label": "打车", "nextNodeId": "taxi_scene" },
        { "label": "步行", "nextNodeId": "walk_scene" }
      ]
    },
    {
      "id": "arrival_gate",
      "type": "arrival_gate",
      "content": {
        "body": "你接近了目标地点。打开地图，找到阿浪。"
      },
      "gpsTrigger": {
        "lat": 22.518,
        "lng": 113.944,
        "radiusMeters": 5
      },
      "nextNodeId": "meeting_alang"
    },
    {
      "id": "meeting_alang",
      "type": "narrative",
      "content": {
        "title": "阿浪出现了",
        "body": "『你来了。』一个穿蓝色外套的人转过身。『我知道你会来，因为我也收到了同样的消息。』"
      },
      "nextNodeId": "ending"
    },
    {
      "id": "ending",
      "type": "ending",
      "content": {
        "title": "故事未完待续",
        "body": "阿浪递给你一张卡片，上面只有一个二维码。『下次，你会知道更多。』"
      }
    }
  ],
  "meta": {
    "estimatedDurationMinutes": 15,
    "difficulty": "easy",
    "tags": ["深圳湾", "初次体验", "阿浪"]
  }
}
```

---

## 9. GPS 与恢复逻辑

### 9.1 实时 GPS 封装（`lib/alang/alangGpsTracker.ts`）

```typescript
// 使用 wx.startLocationUpdateBackground 或 wx.startLocationUpdate
// 若权限不足，降级为 wx.getLocation 轮询（每 3 秒）

interface GpsTrackerConfig {
  intervalMs: number;      // 默认 3000
  desiredAccuracy: number; // 默认 10（米）
  onLocation: (loc: { lat: number; lng: number; accuracy: number; ts: number }) => void;
  onError: (err: unknown) => void;
}

export function startGpsTracker(config: GpsTrackerConfig): () => void;
export function stopGpsTracker(): void;
```

### 9.2 5 米到达判定（`lib/alang/alangDistance.ts`）

```typescript
export function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000; // 地球半径（米）
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function isArrived(userLat: number, userLng: number, target: { lat: number; lng: number; radiusMeters: number }): boolean {
  return haversine(userLat, userLng, target.lat, target.lng) <= target.radiusMeters;
}
```

### 9.3 中途退出恢复

1. **本地恢复**：
   - 进入 `pages/alang/index` 时，读取 `Taro.getStorageSync('jj_alang_active_mission')`
   - 若有进行中的 missionId，自动导航到 `mission-detail/index?missionId=...&recover=true`

2. **服务端恢复**：
   - 页面 mount 时调用 `GET /api/alang/missions/:slug/recover`
   - 服务端返回 `currentNodeId` + `nodeHistory`
   - 客户端合并本地 Storage 中的 `pendingSync` 队列，批量上报

3. **离线补偿**：
   - 所有 `progress` / `gps` / `choice` 操作先写本地 `pendingSync`
   - 网络恢复时按顺序批量发送
   - 发送成功后清空 `pendingSync`

---

## 10. 测试方案

### 10.1 单元测试

| 测试文件 | 目标 | 位置 |
|---------|------|------|
| `alangDistance.test.ts` | haversine 精度、边界值（5m、0m、100m） | `apps/mini-program/src/lib/alang/` |
| `alangContentSchema.test.ts` | Zod 校验：合法 JSON、缺字段、错误类型 | `packages/shared/src/alang/` |
| `alangMissionState.test.ts` | 本地状态机：start → progress → abandon → recover | `apps/mini-program/src/lib/alang/` |
| `alangGpsTracker.test.ts` | 模拟 `wx.onLocationChange` 回调 | `apps/mini-program/src/lib/alang/` |
| `alangMissionService.test.ts` | 服务端状态机：并发 start、重复 arrive | `apps/server/src/services/` |
| `alangGeoFence.test.ts` | 5m 判定、坐标系转换（gcj02 vs wgs84） | `apps/server/src/lib/alang/` |

### 10.2 集成测试

| 场景 | 步骤 | 验收标准 |
|------|------|---------|
| 完整任务流 | 1. 开始任务 → 2. 阅读节点 → 3. 选择选项 → 4. 模拟 GPS 到达 → 5. 完成 | 服务端 `status=completed`，客户端显示 ending |
| 中途退出恢复 | 1. 开始任务 → 2. 阅读到 node-3 → 3. 杀进程 → 4. 重新进入 | 恢复到 node-3，无数据丢失 |
| 离线补偿 | 1. 断网 → 2. 选择选项 → 3. 恢复网络 | `pendingSync` 清空，服务端状态正确 |
| 并发到达 | 1. 两个用户同时到达 5m 半径内 | 无 race condition，均标记 arrived |
| 调试强制推进 | 1. 调用 `/api/alang/debug/force-node` → 2. 客户端刷新 | 显示目标节点，状态一致 |
| 内容 JSON 热更新 | 1. 修改 `demo-story.json` → 2. 重启服务端 → 3. 客户端获取 | 新内容生效，旧进度不损坏 |

### 10.3 E2E 测试（WeChat DevTools）

- 使用 `mcp__wechat-devtools` 模拟：
  1. 扫码进入 Discover → 点击 Alang 卡片
  2. 地图页拖动选点 → 确认导航
  3. 模拟 GPS 移动（DevTools 位置模拟）→ 触发到达
  4. 阅读故事 → 选择选项 → 完成
  5. Profile 页查看“我的故事”历史

---

## 11. 分阶段实施顺序

### Phase 0：基础设施（1–2 天）
1. 新增 DB 表（`alangMissions`, `alangMissionProgress`, `alangStoryArchives`）
2. 生成 migration：`npm run db:generate -- --custom`
3. 新增 Feature Flag：`alangEnabled`
4. 新增服务端路由骨架：`/api/alang/*`（空实现，返回 501）
5. 新增前端 subpackage 骨架：`pages/alang/index`（空页面，显示“即将上线”）
6. 注册路由、subPackages、preloadRules

**验收命令**：
```bash
npm run guardrails
npm run test -w @joyjoin/server -- --run --reporter=verbose alang
npm run dev:server  # 访问 /api/alang/missions 返回 501（预期）
```

### Phase 1：内容系统 + 状态机（2–3 天）
1. 实现 `alangContentService.ts`（JSON 加载 + Zod 校验）
2. 实现 `alangMissionService.ts`（CRUD + 状态机）
3. 实现 `alangStoryService.ts`（节点推进 + 历史记录）
4. 实现服务端路由：GET/POST `/api/alang/missions/*`
5. 前端：任务列表页 `pages/alang/index.tsx`（接 API，展示卡片）
6. 前端：本地状态机 `alangMissionState.ts`（Storage 持久化）

**验收命令**：
```bash
npm run test -w @joyjoin/server -- --run --reporter=verbose alangMissionService
npm run test -w @joyjoin/server -- --run --reporter=verbose alangStoryService
# DevTools 中访问 pages/alang/index，显示任务列表
```

### Phase 2：地图 + GPS + 到达判定（2–3 天）
1. 实现 `AlangMapPicker.tsx`（WeChat `<map>` 封装）
2. 实现 `alangGpsTracker.ts`（实时 GPS）
3. 实现 `alangDistance.ts`（haversine + 5m 判定）
4. 实现 `alangGeoFence.ts`（服务端到达判定，防作弊）
5. 前端：任务详情页 `pages/alang/mission-detail/index.tsx`（地图 + 故事节点）
6. 前端：到达遮罩 `AlangArrivalOverlay.tsx`

**验收命令**：
```bash
npm run test -w @joyjoin/server -- --run --reporter=verbose alangGeoFence
# DevTools 模拟 GPS，移动到目标坐标 5m 内，触发到达动画
```

### Phase 3：故事阅读器 + 恢复（2 天）
1. 实现 `AlangStoryNode.tsx`（JSON-driven 渲染器）
2. 实现 `pages/alang/story-reader/index.tsx`
3. 实现中途退出恢复：`alangRecovery.ts`
4. 实现离线补偿：`pendingSync` 队列
5. 调试面板：`pages/alang/debug-panel/index.tsx`（force-node、reset、mock-gps）

**验收命令**：
```bash
# DevTools：开始任务 → 阅读 2 个节点 → 杀进程 → 重新进入 → 恢复到节点 2
```

### Phase 4：入口 + 埋点 +  polish（1–2 天）
1. Discover 页插入 `AlangFeedCard.tsx`
2. Profile 页插入“我的故事”菜单行
3. 实现 `alangAnalytics.ts`（事件列表：mission_start, node_view, choice_made, gps_arrived, mission_complete, mission_abandon, recover_success, recover_fail）
4. 服务端：调试路由 `/api/alang/debug/*`
5. 性能优化：地图组件 DPR 限制、低端机降级（`useDeviceTier`）
6. 无障碍：`aria-label`、减少动画（`prefers-reduced-motion`）

**验收命令**：
```bash
npm run check:full
npm run harness:gate
# DevTools：从 Discover 进入 → 完整走完全流程 → Profile 查看历史
```

---

## 12. 回滚方案

### 12.1 快速关闭（Feature Flag）
- 设置 `ALANG_ENABLED=false`（env）或 DB `feature_flags` 中 `alangEnabled=false`
- 客户端 `authUser.features.alangEnabled` 变为 `false`，所有入口隐藏
- 已进行中的任务数据保留在 DB，不影响现有功能

### 12.2 代码回滚
- 所有新增文件位于独立目录（`pages/alang/`, `lib/alang/`, `routes/domains/alang.ts`），schema 追加在 `_definitions_extended.ts`
- 回滚时只需：
  1. 从 `routes.ts` 注释 `registerAlangRoutes(app)`
  2. 从 `featureFlags.ts` 注释 `alangEnabled`
  3. 从 `buildAuthUserResponse.ts` 移除并行 fetch
  4. 从 Discover/Profile 注释入口组件
- 无需修改现有核心页面（Discover、Profile、Icebreaker、Matching 等）

### 12.3 数据回滚
- 若需彻底清理：
  ```sql
  DROP TABLE IF EXISTS alang_story_archives;
  DROP TABLE IF EXISTS alang_mission_progress;
  DROP TABLE IF EXISTS alang_missions;
  ```
- 或保留数据但冻结：`UPDATE alang_missions SET status = 'archived';`

### 12.4 紧急热修复
- 若地图组件导致崩溃：通过 `alangEnabled` flag 关闭后，用户无法进入 Alang 页面
- 若 GPS 轮询导致电量问题：服务端增加 `gpsPollingIntervalMs` 动态配置（DB 或 env），客户端读取后调整间隔

---

## 13. 附录：依赖与外部服务

| 服务 | 用途 | 已有配置 | 需新增 |
|------|------|---------|--------|
| 腾讯地图 WebService | 反地理编码 | `TENCENT_MAP_KEY` | 无需新增 |
| 腾讯地图 JS SDK | 地图组件（若使用） | 无 | 需申请 `TENCENT_MAP_JS_KEY`（若 `<map>` 不够） |
| WeChat `<map>` | 地图选点 | 无 | 无需额外 key |
| PostgreSQL | 任务状态存储 | 已有 | 新增表 |
| CDN | 故事图片/音频 | `joyjoinapp.com/static` | 上传故事素材 |

---

## 14. 未知项（待确认）

1. **阿浪内容生产流程**：谁负责撰写 JSON 故事？是否需要 Admin 后台编辑器？
2. **目标用户规模**：内部 Prototype 预期多少并发？是否需考虑水平扩展？
3. **与 Social Icebreaker 的交集**：阿浪是独立体验，还是作为 icebreaker 的前置/后置环节？
4. **地图坐标系精确要求**：`<map>` 组件使用 `gcj02`，与现有 `Taro.getLocation({ type: 'gcj02' })` 一致，但需确认目标坐标是否也使用 `gcj02`。
5. **离线模式需求**：地铁/公园无信号场景是否需要完整离线体验？
6. **音频/视频内容**：故事节点是否包含音频 narration？若包含，需评估 CDN 预加载策略。
