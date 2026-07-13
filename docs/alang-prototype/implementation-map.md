# 闪现 NPC｜阿浪 V1.5 — Active Implementation Map

> 当前版本：2026-07-13
> 产品基准：`JoyJoin_Master_PRD_V1.5_Codex执行版_已清理过时功能参考.docx`
> Scope ID：`ALANG-V15-PHASE-B`

## 0. 视觉参考边界

- ACTIVE 03：只约束现有 Discover 闪现入口，不新增一级 Tab。
- ACTIVE 05：约束寻找阿浪页的距离主视觉与辅助信息层级。
- ACTIVE 06/07：保留现有“我的”导航，并让阿浪档案进入现有“我的故事”。
- FUTURE 04 多 NPC 地图、FUTURE 08 伙伴/装备完整页本轮不实现。
- REMOVED 09 探索地图不得新增、恢复或借图改导航。
- 事件详情、配置、对话、陪伴、结果没有 ACTIVE Mockup，必须以仓库现有 UI + PRD 正文为基准。

## 1. 用户流程与服务端权威

```text
Discover 卡 / 我的故事
  → 事件列表或事件详情
  → 搜索（只显示用户位置 + 距离）
  → 找到场景
  → 三段叙事选择
  → 陪伴（用户点击后可看步行路线）
  → 5 米稳定到达
  → 结果卡
  → 用户主动收录
  → 故事档案
```

每个页面 URL 只负责定位任务 `slug`，不决定剧情阶段。页面在前台恢复时读取 `GET /api/alang/missions/:slug` 的 `myProgress`，并按服务端 `stage/currentNodeId` 纠正陈旧页面。`stage=result` 与 `status=completed` 分开：结果卡必须先出现，只有用户点击“收录故事”才调用完成接口。

## 2. Mini Program 文件

| 能力 | 文件 |
| --- | --- |
| Discover 入口 | `apps/mini-program/src/components/alang/AlangDiscoverCard.tsx` |
| 列表/详情 | `apps/mini-program/src/pages/alang/event/`、`event-detail/` |
| 内部配置 | `apps/mini-program/src/pages/alang/config/`（仅 single-test） |
| 搜索 | `apps/mini-program/src/pages/alang/search/` |
| 找到/对话 | `apps/mini-program/src/pages/alang/dialogue/` |
| 陪伴/路线 | `apps/mini-program/src/pages/alang/companion/` |
| 结果/档案 | `apps/mini-program/src/pages/alang/result/`、`story-detail/` |
| GPS 生命周期 | `apps/mini-program/src/lib/alang/useAlangGps.ts` |
| 任务 Query/Mutation | `apps/mini-program/src/lib/alang/useAlangMission.ts` |
| 资产审批 manifest | `apps/mini-program/src/lib/alang/alangAssets.ts` |
| 路由/子包 | `apps/mini-program/src/lib/onboarding/onboardingRoutes.ts` |

所有 Alang 页面位于 `pages/alang` subpackage。`app.config.ts` 声明 `scope.userLocation`、`getLocation`、`startLocationUpdate`、`onLocationChange` 所需隐私用途。

## 3. Server 与 Shared 文件

| 能力 | 文件 |
| --- | --- |
| Alang API/状态机 | `apps/server/src/routes/domains/alang.ts` |
| 坐标披露边界 | `apps/server/src/lib/alang/alangDisclosure.ts` |
| 路线/GPS 统一目标解析 | `apps/server/src/lib/alang/alangTargetResolver.ts` |
| 5 米稳定到达 | `apps/server/src/lib/alang/alangGeoFence.ts` |
| 内容解析/缓存 | `apps/server/src/services/alangContentService.ts` |
| 持久化 | `apps/server/src/repositories/alangRepo.ts` |
| 腾讯地图代理 | `apps/server/src/routes/domains/geo.ts` |
| Alang DTO/坐标 | `packages/shared/src/api/alang.ts`、`packages/shared/src/alang/missionTypes.ts` |
| Geo DTO | `packages/shared/src/api/geo.ts` |
| 剧情 Schema | `packages/shared/src/alang/contentSchema.ts` |

## 4. 地图接口

所有坐标均为 GCJ-02，字段名固定为 `latitude` / `longitude`。

| Method | Path | 用途 | 失败策略 |
| --- | --- | --- | --- |
| POST | `/api/geo/reverse-geocode` | 坐标转地点名/地址/行政区/最近 POI | 免登录但按 IP 60 次/分钟限流；腾讯失败时保留深圳行政区 bounds 降级 |
| POST | `/api/geo/ip-locate` | Discover GPS 拒绝时的城市级回退 | 免登录但与逆解析共享按 IP 配额；返回明确失败，不伪造城市 |
| POST | `/api/geo/places/suggest` | 内部点位配置的深圳地点联想 | 登录态 + 60 次/分钟/用户；失败仍可点地图 |
| POST | `/api/geo/places/search` | 当前点附近 POI 搜索 | 登录态 + 60 次/分钟/用户；失败仍可点地图 |
| POST | `/api/geo/walking-route` | 陪伴阶段的步行距离、ETA、polyline | 登录态 + 限流；超长点串拒绝；失败不影响 GPS/剧情 |

稳定错误码：`MAP_INVALID_REQUEST`、`MAP_NOT_CONFIGURED`、`MAP_UPSTREAM_TIMEOUT`、`MAP_UPSTREAM_ERROR`、`MAP_NO_ROUTE`。腾讯调用使用 4 秒超时、容量受限 TTL/LRU 缓存；walking polyline 最多 2,000 点且原始字符串最多 64KB。上游失败日志携带 `request_id`，便于关联请求链路。

### Key 与部署

- 只复用服务端 `TENCENT_MAP_KEY`；不得写入客户端或响应。
- `TENCENT_MAP_JS_KEY` 只属于 Admin MapPicker，本功能不使用。
- 没有新增地图 SDK、provider、Key 或 `/api/maps` 平行路由。

## 5. 坐标与保密不变量

1. `MissionContent` 返回客户端前删除 `meta.defaultTargetLocation`、`meta.defaultCompanionEndLocation` 和所有 `node.gpsTrigger`。
2. `routeDestination` 只在 `companion/arrived/closing/result/completed` 阶段返回。
3. 搜索页的原生 Map 只接收用户当前位置；不得传目标 marker、搜索圈或 polyline。
4. 本地 `jj_alang_config_*` 只在 `appMode=test` 时读取；生产/普通 staging 忽略旧调试缓存。
5. Public GPS 的 `targetOverride` 只在服务端严格 single-test gate 下生效。
6. 生产环境即使误留 `ENABLE_SINGLE_TEST_MODE=true`，`/api/auth/user` 也不会下发客户端 test marker；Alang Debug API 仍返回 404。
7. `APP_MODE` 未配置时按 production 处理，不允许 debug fail-open。

## 6. 到达判定与路线分工

- 到达判定：JoyJoin 服务端 Haversine + 固定 5 米半径 + 连续 3 个合格读数。
- 客户端距离只做展示层 EMA 平滑与 1 米迟滞；服务端原始距离和到达真值不受客户端平滑影响。
- 内容 JSON、数据库字段或 debug payload 中的 `radiusMeters` 都不能扩大固定 5 米半径。
- 路线终点和 GPS 到达判定共用 `resolveAlangArrivalTarget()`；持久化任务坐标优先，内容节点仅作旧数据兼容回退。
- GPS 历史只保留稳定窗口，不保存完整行走轨迹。
- 腾讯路线：只在陪伴页面用户点击“查看步行路线”后请求。
- 路线距离/ETA 是展示信息，不可替换 geofence 真值。
- 地图/路线/逆解析失败时，任务进度、GPS 上报和结果收录继续按各自状态运行。
- 结果卡日期优先使用服务端固化的 `arrivedAt/completedAt`，跨日恢复时不使用客户端当前日期重算。

## 7. 持久化兼容与数据库

本轮没有数据库 DDL 变化，也没有新增 migration。`target_location`、`companion_end_location`、`gps_history` 和 `content_json` 本来就是 JSONB；仅应用层把坐标字段统一为 `latitude/longitude`。

`missionContentSchema`、`normalizeAlangCoordinate()` 和 GPS history parser 会在读取边界兼容旧 `{ lat, lng }` 数据，再向运行时输出标准字段。因此无需一次性数据回填。

### 回滚

1. 关闭 DB-backed `alangEnabled`（或 `ALANG_ENABLED=false`）可立即隐藏入口并使 Alang API fail closed。
2. Geo 新接口是现有 `/api/geo` 的增量扩展；回滚应用版本不需要回滚数据库。
3. 旧 JSON 兼容读取必须保留到确认生产数据完成自然更新后，不能先删除。

## 8. 验证基线

```bash
npm run typecheck -w @joyjoin/shared
npm run typecheck -w @joyjoin/server
npm run test -w @joyjoin/server -- --run src/__tests__/geoRoutes.test.ts src/__tests__/alangContent.test.ts src/__tests__/alangGeoFence.test.ts src/__tests__/alangDisclosure.test.ts src/__tests__/alangTargetResolver.test.ts src/__tests__/alangDebugRoutesGate.test.ts src/__tests__/buildAuthUserResponseAlang.test.ts
npm run test -w mini-program -- --run src/pages/alang
```

必须额外在微信开发者工具/真机检查：定位首次授权、拒绝后设置恢复、iOS swipe-back、前后台恢复、polyline、弱网/超时、短屏安全区和 reduced motion。

## 9. V1.5 本地需求追踪矩阵

> 下列 ID 是仓库内追踪编号，用于把 Word 条款、实现证据和验收状态放在同一处，不替代 Word 原文。

| 本地 ID | V1.5 要求 | 主要实现证据 | 自动验证 | 状态 |
| --- | --- | --- | --- | --- |
| `V15-REF-01` | 只执行 ACTIVE 03/05/06/07；不实现 FUTURE 04/08；不恢复 REMOVED 09 | `alangAssets.ts`、现有路由/Tab | 文档映射、资源 manifest | **PARTIAL**：参考边界已落实；正式美术待审批 |
| `V15-GEO-01` | 复用现有腾讯地图接入，不新增 SDK/provider/Key | `routes/domains/geo.ts`、`api/geo.ts` | `geoRoutes.test.ts` | PASS |
| `V15-SEC-01` | 搜索阶段隐藏目标，陪伴阶段才披露路线终点 | `alangDisclosure.ts`、`alangTargetResolver.ts` | disclosure/target resolver tests | PASS |
| `V15-ARRIVE-01` | 服务端固定 5 米并要求稳定读数 | `alangGeoFence.ts`、`constants.ts` | geofence/content tests | PASS |
| `V15-STATE-01` | 页面断点由服务端 `stage/currentNodeId` 恢复 | Alang 各阶段页、`useAlangMission.ts` | mini-program Alang tests | PASS |
| `V15-ARCHIVE-01` | 先展示结果，再由用户主动收录 | `result/index.tsx`、`POST .../complete` | result/server tests | PASS |
| `V15-PERF-01` | 阿浪子包保持轻量，不拖累主包 | `pages/alang` subpackage | 微信生产编译 + package-size | PASS：Alang 135.6KiB；仓库主包 3.27MB 属全局既有门禁 |
| `V15-QA-01` | 三类真机、定位/地图/弱网与 ACTIVE 截图验收 | 外部验收清单 | 无法由本地自动化替代 | **BLOCKED EXTERNAL** |
