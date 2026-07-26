# 闪现正式版（多 NPC）｜阿浪 V1.7 — Active Implementation Map

> 当前版本：2026-07-26
> 产品基准：`JoyJoin_Master_PRD_V1.7_Codex执行版_强调Mockup未完全落地.docx`
> Scope ID：`FLASH-FORMAL-V1` + `ALANG-V17-VISUAL-ALIGNMENT`

## 0. 闪现正式版当前权威（2026-07-20 覆盖）

- 正式入口仍位于 Discover，但入口是静态卡片：不预取在线列表、不申请定位、不推送。正式页面为 `pages/alang/event`，同页展示“现在在线”和“我的任务”。
- 首批 5 位均为数字动物 NPC：阿浪（灰狼，周二/四/五）、栗子（水獭，周一/三/六）、默默（兔狲，周三/五/日）、拾柒（乌鸦，周二/六/日）、阿团（水豚，周一/四/日）。现场没有真人 NPC。
- 每个符合固定星期的 NPC 随机生成 1–2 个班次，单班 90–150 分钟，范围 09:00–21:00，同 NPC 班次间隔至少 90 分钟；生成器按上午/下午/晚上均衡空档，无法生成安全班次时允许 0 班且不展示占位。
- 次日草案由服务端生成，后台可编辑；未人工改动且仍通过校验的草案可自动发布。相遇地点、任务目的地和行政区分别建模，正式页面不显示未来排班。
- 搜索不下发隐藏地点坐标、地址、路线、精确距离或距离档位。用户每次主动点击只读取一次 GCJ-02；服务端使用固定版本、带来源与校验和的 DataV.GeoAtlas 深圳行政区 GCJ-02 边界拒绝香港及周边城市点，边界文件不进入 Taro 包，再以 50 米为相遇权威。按用户 + appearance 的 10 分钟 6 次预算由 PostgreSQL 原子计数并跨实例共享，不保存坐标。班次到点即结束；已解锁对话可继续 24 小时。
- 对话最多 2 个结构化问题，随后从人工审核任务库随机给出任务，每次相遇可换 1 次。正式库为 6 类 × 5 条共 30 条；运行时不调用 LLM。已完成模板按 `max(5%, 0.35^n)` 降权。
- **2026-07-26 任务体验覆盖：**30 条旧“到地点验收”任务改为 25 条无惩罚生活邀请 + 5 条数字 NPC 传话。每条生活邀请只归属 1 位符合人设的 NPC，并要求用户现在完成一个安全的最小动作；涉及户外时只在时间、天气和环境合适的条件下当天出发。电影任务直接使用用户已有想看片单或旧喜欢，不调用推荐系统。下一次真实解锁对应 NPC 时，服务端按用户选择的“做了、开始一点、没做、改变主意、换了别的”或电影专属结果返回不同的人设回应；NPC 传话也按原话、改述、未说、忘记或改变主意分别回应。任何结果都不扣分、不发奖励、不影响匹配或正式人格，不要求拍照、定位、消费或证明。目录同步会停用内置任务遗留的错误跨 NPC 关联，避免五位 NPC 共用同一任务。
- 邀请内容的确定性安全库是产品权威；个性化只在用户已同意的来源内调整权重。未来 AI 只能在审核骨架内选择或润色，不能自由生成危险、医疗、酒精、陌生人互动、强制消费或高压力任务；模型失败必须回退到审核内容。
- 用户最多同时持有 3 个任务、同 NPC 最多 1 个。未到达任务 7 天结束；提交反馈后进入 `ready_to_deliver` 并保留到之后一次同 NPC 相遇，交付必须使用不同且晚于反馈的新 encounter。
- 新生活邀请和 NPC 传话不要求目的地到达、进店、消费、拍照、扫码、评价或任何证明；下一次符合对象的 NPC 相遇仅做无惩罚回访。旧目的地任务 DTO 保留兼容读取，但不再由内置 30 条目录产生。
- Admin 闪现地点提供深圳城市公共空间运营模板：具体店铺和酒吧不得作为点位名称，只使用其所在的开放街区、外围广场、公共连廊、公共阅读区或商场公共空间。模板只预填运营文案与 NPC 建议，不携带可直接上线的坐标；运营必须重新通过腾讯地图选点、深圳行政区校验和人工安全审核。商场、书城或文化空间闭店闭馆后停用，不承诺永久免费或全天开放。
- Staging bootstrap 固定保障南山区、福田区各至少 2 个 `approved + enabled` 安全地点：腾讯 suggestion 成功则采用同区 API 数据；失败会保留错误日志并使用 verified fallback seed，随后由部署 SQL 健康检查硬门验证覆盖数量。该降级只服务 staging 初始化，不放宽后台人工审批的腾讯反查要求。
- 个性化默认关闭，总开关与人格、兴趣、宽泛行业、行政区、任务行为来源分别可控。拒绝定位则不能参加闪现，且绝不使用 IP 定位回退。
- 当前正式代码由 `routes/domains/alangFlash.ts`、`services/flashService.ts`、`services/flashScheduleService.ts`、`repositories/flashRepo.ts`、`schema/flash.ts` 与后台 `/admin/alang` 共同承载。`alangEnabled` 默认关闭；数据库迁移、seed、逐条人工审核、深圳边界许可确认、readiness、staging 及微信真机验收完成前不得开启。

旧阿浪故事状态机仍作为内部/兼容流程保留；下文涉及 5 米稳定到达、三轮旧剧情、archive 的条目仅描述旧 `missions/:slug` 流程，不得覆盖上述正式闪现契约。FUTURE 04 的“多 NPC 地图”仍不实现：正式版只提供当前在线列表与隐藏地点寻找，不新增探索地图。

## L1. 旧阿浪 V1.7 视觉参考边界

- ACTIVE 03：现有 Discover 闪现入口落为紧凑单 NPC 卡，不新增一级 Tab。
- ACTIVE 05：寻找页落为区域提示、静态雷达/真实距离信号、找到后说明和用户-only 辅助地图。
- APPROVED TARGET 06：“我的”落为身份舞台、真实潮流值/活动/连接/资料完成度、个人连续故事入口和设置；像素伙伴形象只用于新版 Profile。
- ACTIVE 07 只提供视觉语气参考。按 2026-07-15 产品决定，“我的故事”不再是阿浪/活动档案列表，而是仅本人可见、由真实经历按时间追加的连续故事。
- FUTURE 04 多 NPC 地图仍不实现。FUTURE 08 的 Word 完整方案不照搬；2026-07-15 产品决定仅授权新版 Profile 的“我的形象”最小闭环：12 人格像素伙伴、四槽穿脱、显式保存、活动装备池、碎片和碎片商店。
- REMOVED 09 探索地图不得新增、恢复或借图改导航。
- 事件详情、配置、对话、陪伴、结果没有 ACTIVE Mockup，必须以仓库现有 UI + PRD 正文为基准。
- 阿浪正式人物/场景图仍为 `awaiting-approved-art`；占位图必须继续显示“场景示意”。

## L2. 旧阿浪用户流程与服务端权威

```text
Discover 卡
  → 事件列表或事件详情
  → 搜索（只显示用户位置 + 距离）
  → 找到场景
  → 三段叙事选择
  → 陪伴（用户点击后可看步行路线）
  → 5 米稳定到达
  → 结果卡
  → 用户主动收录
  → 阿浪档案（事实来源）
  → 用户在“我的故事”主动点“更新故事”
  → 一次真实经历追加一章
```

每个页面 URL 只负责定位任务 `slug`，不决定剧情阶段。页面在前台恢复时读取 `GET /api/alang/missions/:slug` 的 `myProgress`，并按服务端 `stage/currentNodeId` 纠正陈旧页面。`stage=result` 与 `status=completed` 分开：结果卡必须先出现，只有用户点击“收录故事”才调用完成接口。

## 2. Mini Program 文件

| 能力 | 文件 |
| --- | --- |
| Discover 入口 | `apps/mini-program/src/components/alang/AlangDiscoverCard.tsx` |
| “我的”身份舞台、私人故事与“我的形象”入口 | `apps/mini-program/src/pages/profile/` |
| 齿轮“设置与服务”独立 workflow | `apps/mini-program/src/pages/profile-linked/settings/` |
| 私人连续故事 | `apps/mini-program/src/pages/profile-linked/personal-story/` |
| 我的形象/衣橱/碎片商店 | `apps/mini-program/src/pages/profile-linked/my-image/` |
| 装备客户端契约 | `apps/mini-program/src/lib/profile/equipmentApi.ts` |
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
| Alang DTO/坐标与测试点位校验 | `packages/shared/src/api/alang.ts`、`packages/shared/src/alang/missionTypes.ts`、`packages/shared/src/alang/testPointValidation.ts` |
| Geo DTO | `packages/shared/src/api/geo.ts` |
| 剧情 Schema | `packages/shared/src/alang/contentSchema.ts` |
| 私人连续故事 API/worker | `apps/server/src/routes/domains/personalStory.ts`、`jobs/personalStoryWorker.ts` |
| 私人连续故事事实源/生成 | `apps/server/src/repositories/personalStoryRepo.ts`、`services/personalStoryGenerationService.ts` |
| 装备/地点池 API | `apps/server/src/routes/domains/equipment.ts`、`services/equipmentRewardService.ts` |
| 装备/故事持久化契约 | `packages/shared/src/schema/equipment.ts`、`personalStory.ts` |

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
6. 生产环境即使误留 `ENABLE_SINGLE_TEST_MODE=true`，`/api/auth/user` 也不会下发客户端 test marker；复测 Reset 返回 403，其他 Alang Debug API 继续按安全策略隐藏为 404。
7. `APP_MODE` 未配置时按 production 处理，不允许 debug fail-open。

## 6. 到达判定与路线分工

- 到达判定：JoyJoin 服务端 Haversine + 固定 5 米半径 + 连续 3 个合格读数。
- 客户端距离只做展示层 EMA 平滑与 1 米迟滞；服务端原始距离和到达真值不受客户端平滑影响。
- 内容 JSON、数据库字段或 debug payload 中的 `radiusMeters` 都不能扩大固定 5 米半径。
- 路线终点和 GPS 到达判定共用 `resolveAlangArrivalTarget()`；内部复测必须优先使用当前 progress 的本轮点位且禁止回退 demo，非测试流程才保留任务/内容节点兼容回退。
- GPS 历史只保留稳定窗口，不保存完整行走轨迹。
- 内部复测的出现点到陪伴终点必须在 10–2,000 米内，推荐 100–300 米；当前定位到陪伴终点超过 2,000 米时返回配置异常，不展示超大距离，也不写入 GPS history。
- 正式搜索提示半径为 300 米；这不是陪伴步行要求，也不能用于扩大 5 米到达半径。
- 腾讯路线：只在陪伴页面用户点击“查看步行路线”后请求。
- 路线距离/ETA 是展示信息，不可替换 geofence 真值。
- 地图/路线/逆解析失败时，任务进度、GPS 上报和结果收录继续按各自状态运行。
- 结果卡日期优先使用服务端固化的 `arrivedAt/completedAt`，跨日恢复时不使用客户端当前日期重算。

## 7. 持久化兼容与数据库

`0067_add_alang_progress_test_points.sql` 给 `alang_mission_progress` 增加本轮 `target_location` 与 `companion_end_location` JSONB 字段。任务级 `alang_missions` 坐标仍是运营/非测试兼容值，内部复测配置不得写回全局任务。

迁移故意不回填旧 progress：旧 staging 行无法证明使用的是哪一轮配置，若从 demo mission 回填会再次制造跨城市终点。旧行因此被识别为配置异常，测试人员必须重置并重新设置两个点。新一轮 start 请求同时提交两个标准 `latitude/longitude` GCJ-02 坐标，recover、路线终点、5 米判定和 Mock 到达都读取同一条 progress。

`missionContentSchema`、`normalizeAlangCoordinate()` 和 GPS history parser 会在读取边界兼容旧 `{ lat, lng }` 数据，再向运行时输出标准字段。因此无需一次性数据回填。

### 回滚

1. 关闭 DB-backed `alangEnabled`（或 `ALANG_ENABLED=false`）可立即隐藏入口并使 Alang API fail closed。
2. 新增 progress 点位列允许为空，回滚应用版本不要求删列；不得用 demo 坐标批量回填旧测试 progress。
3. Geo 新接口是现有 `/api/geo` 的增量扩展；回滚应用版本不需要回滚数据库。
4. 旧 JSON 兼容读取必须保留到确认生产数据完成自然更新后，不能先删除。

## 8. 内部重复测试（P0）

同一内部测试账号可以在故事收录后清除当前阿浪任务的本轮测试数据，再从点位配置重新走完整流程。该能力不是普通用户功能，也不提供批量重置、跨用户重置或多轮历史列表。

### 权限与接口

- API：`POST /api/alang/debug/missions/:slug/reset`。
- 必须同时满足服务端 `alangEnabled=true`、非 production 环境和 `isSingleTestMode()=true`；缺失 `APP_MODE` 按 production 处理。
- 非 single-test 或 production 调用返回 403；mission 不存在/不可见返回 404；空状态重复调用仍返回 200。
- 用户身份只来自登录 session，不接受客户端 `userId`。响应固定为：`{ reset: true, deletedProgressCount, deletedArchiveCount }`。

### 事务与删除边界

`deleteMissionProgress()` 在单个数据库事务内先锁定并确认当前用户与指定 mission 的唯一 progress，再删除同时匹配 `progressId + userId + missionId` 的 archive，最后删除 progress。Archive 外键不级联，因此删除顺序不可交换；任一步失败都会整体回滚。没有 progress 时返回 `0/0`，不会扫描或删除孤儿 archive。

删除范围仅包含当前 progress 的本轮出现点/陪伴终点、`nodeHistory`、`choicesMade`、`gpsHistory`、阶段/状态/debugMarkers 及其对应 archive。其他用户、其他 mission、Blind Box、连接、足迹、正式活动和其他故事不在事务谓词内。不能仅按 `isDebugSession=true` 过滤，因为未使用 Mock GPS/Force Node 的正常内部复测也会生成需要清理的 archive。

### 客户端恢复为初始态

- 结果页仅在 `alangEnabled + appMode=test + completed + archiveId` 时显示次级操作“重新测试阿浪”。
- Debug 页显示 progress 状态、archive 是否存在和当前 story version；重置成功后显示“开始新一轮测试”。
- Reset 成功会取消并移除全部 `['alang', ...]` Query Cache、recover mutation、archive detail，并精确删除 `jj_alang_config_${slug}`。
- 结果页使用 `reLaunch` 进入阿浪配置页；Debug 页由“开始新一轮测试”进入同一配置页。旧页面栈、旧点位、选择、GPS 和最终情绪不会继承。
- Reset 期间用同步 ref + mutation pending 双重防重；失败保留当前页面并显示明确错误，不伪造成功。

### P0 需求追踪

| ID | 要求 | 实现证据 | 自动验证 | 状态 |
| --- | --- | --- | --- | --- |
| `RETEST-01` | 结果页快捷复测 | `pages/alang/result/` | result tests | PASS |
| `RETEST-02` | Debug 页完整重置/状态/version/重新开始 | `pages/alang/debug/` | debug tests | PASS |
| `RETEST-03` | 服务端 feature + single-test + production 权限 | `routes/domains/alang.ts` | debug gate/reset route tests | PASS |
| `RETEST-04` | 事务删除、归属限制、幂等和回滚 | `repositories/alangRepo.ts` | reset repository tests | PASS |
| `RETEST-05` | Query/mutation/local config 缓存清理 | `lib/alang/useAlangMission.ts` | cache helper tests | PASS |
| `RETEST-06` | 重置后重新配置并可再次 start/complete | Reset route + config reLaunch | route/result/debug tests | PASS |
| `RETEST-07` | 自动化测试覆盖 P0 安全与交互清单 | server/mini Alang test suites | Server Alang 66 + Mini Alang 64；Shared/Server/Mini typecheck；H5 1,381 modules；Weapp 869 modules | **功能/编译 PASS；既有主包体积门禁 BLOCK** |

### 陪伴页防卡死（2026-07-15）

- 根因：配置页曾只把点位写到 `jj_alang_config_*`，start API 与 progress 均不保存本轮终点；陪伴页又优先读取服务端任务级 `routeDestination`，于是恢复到 demo-story 的深圳默认终点并显示约 242 公里的真实 Haversine 距离。
- 修复：内部测试 start 必须携带本轮出现点和陪伴终点；服务端严格校验并保存到当前用户 + 当前 mission 的 progress。recover 和 companion 披露只使用这两个字段，缺失时 fail closed。
- 恢复态：点位缺失、非数值、0/0、越界、疑似经纬度颠倒、点位间小于 10 米或大于 2,000 米，以及当前定位距终点大于 2,000 米，均不进入正常距离 UI；显示“陪伴终点配置异常，请重新设置测试点位”。
- 跨页一致性：GPS、对话、companion 自动推进、Mock 到达和结果推进的成功响应都携带 `stage/currentNodeId`；客户端在导航前同步 mission Query Cache，避免目标页读旧阶段后回跳。陪伴阶段首次披露终点时，旧缓存只显示“正在恢复本轮陪伴终点”；网络失败提供重试，只有服务端成功复核后仍无终点才进入配置异常态。
- 测试工具：仅 `alangEnabled + single-test + 非 production` 时显示。重新配置会调用事务 reset、清除 Query/local cache 并 `reLaunch` 配置页；“模拟到达终点”复用 `POST /api/alang/debug/missions/:slug/mock-gps` 的 `{ mode: "arrive" }`，由服务端在已保存终点 3 米内生成连续 3 个稳定读数并写入 debug marker。
- 搜索页同样直接提供“模拟找到阿浪”，使用当前搜索节点调用既有 Mock GPS 能力；成功后刷新服务端进度并进入对话，不修改手机系统定位，也不直接完成任务。测试人员不需要真的走完搜索或陪伴距离。
- 安全：请求不接受 `userId`，只能读写登录用户的当前 mission；普通模式隐藏入口，服务端也拒绝 debug API。

### 配置页“开始测试”真机无反馈修复（2026-07-16）

- 真机静默根因不是坐标或 20 米距离校验：旧体验包中的启动处理器取得防重复锁后，诊断用 realtime logger 位于请求与 `finally` 保护之外。日志实现若在设备上抛错，start 请求不会发出且锁无法释放；失败分支的 warning logger 抛错时又会跳过页面错误反馈。
- 公共 `lib/utils/logger.ts` 现在对 manager 初始化和每次 info/warn/error 都实行 best-effort：任何日志实现异常都不得再阻断 Discover、搜索、对话选择、到达确认或结果收录。配置页仍保留最外层 `finally`，错误先写入页面持久状态再尝试 Toast/日志。
- 内部测试 start 由服务端在同一个请求中保存本轮两个 GCJ-02 点位并推进到 `search_gate`；客户端不再串行补发 progress 请求。start 成功后的 Query 列表刷新改为后台执行，不再让一次成功点击额外等待移动网络 GET。
- 旧 progress 返回 `ALANG_RECONFIG_REQUIRES_RESET` 时，配置页直接提供“清除旧进度”，调用现有事务 reset 后留在当前配置页，测试人员不用退出流程寻找 Debug 页。
- 回归测试模拟 manager 初始化/写日志抛错、重复点击、旧 progress、单请求直达 search 和正常 production 无 body 启动。正常 GPS、点位校验、腾讯地图和服务端 5 米到达权威均未修改。
- GitHub Actions 的 `miniprogram-ci upload` 只上传开发版，不会自动替换微信后台已选中的体验版；真机验收前仍必须把包含本修复的最新开发版手动设为体验版。

### 三轮对话自然化与受控内容发布（2026-07-16）

- 内容仍是人工审核、版本化的固定三轮分支，不接运行时 LLM、不开放自由输入，也不改变九个 choice index、节点 ID、`nextNodeId` 或 moodShift。`demo-story.json` 的批准版本由 `1.0` 升为 `1.1`。
- 找到场景同时展示阿浪第一句和环境旁白；选择后先在当前操作区完整展示该分支的阿浪回应，用户点“继续”后才出现下一问。第三轮回应结束后先展示陪伴开场，再由用户点“陪他走走”，不再 900ms 自动跳页。
- 移除 A/B/C、`第 N / 3 段`、`你选择`、`正在把选择交给阿浪`等问卷/系统语言；断点恢复只保留最近一次交流，并用“刚才聊到这里 / 你：…”恢复语境。
- 文案保持深圳湾、长椅、海风、等人和安静陪伴等已知事实，删去模板金句和动作重复，没有增加新的背景故事、人物关系或结果个性化声明。
- 运行时数据库 `alang_missions.content_json` 仍是内容权威。`seedDemoMissionIfNeeded()` 现在只对 `slug=alang-demo && isInternalOnly=true` 的内部任务按 semantic version 幂等同步；相同版本不写入，非内部任务拒绝覆盖，更新后立即清除该任务 5 分钟内容缓存。因此 staging 不再永久停留在首次 seed 的旧回答库。

## 9. 私人连续故事（产品决定覆盖旧 ACTIVE 07 数据模型）

- API：`GET /api/personal-story`、`POST /api/personal-story/update`、`GET /api/personal-story/update-status`；身份只来自登录会话。
- 事实源只有两类：非 Debug 且 completed 的阿浪档案；严格完成的真实盲盒。盲盒以本人的 group outcome 锁定分组，并额外要求本人已匹配、活动池与分组均非测试/未取消、活动时间已过，以及该活动本人的 `event_feedback.completedAt` 非空；group outcome 单独不足以证明完成参加。反馈文本/分数、姓名、GPS、聊天和客户端自由文本都不进入提示词。
- 用户只提交“更新故事”；服务端按经历发生时间从旧到新建立 durable job。一次真实经历对应一章，章节以 source 唯一约束追加，旧章节不覆盖、不删除。
- 标题固定为 `日期 · 活动类型`。MiniMax 是首选，DeepSeek 使用现有客户端做运行时回退；模型每次只编排一章，输出带 `factIds` 的结构化 paragraphs/clauses，只能选择服务端批准的连接短语。服务端要求全部待写事实恰好使用一次、保持时间顺序，并拒绝任何自由正文、未知实体/数字/地点/日期或语义错配；MiniMax 返回非空但无效时也会继续尝试 DeepSeek。两家均失败或均被拒绝时不插入替代章，已存在章节继续可读，下一次更新从缺失经历继续。
- `personalStoryEnabled=false` 时 Profile/阿浪结果不进入私人连续故事，服务端在访问新故事表前关闭整个 surface：GET 返回 503、POST 返回 403、status 返回 disabled。只有开关为 `true`、故事表已迁移且 AI provider 暂不可用时，已存在章节仍可由 GET 读取；更新返回 503，不覆盖或删除历史。
- 页面不显示“已生成/待续写”统计，不退化为活动流水账，不分享，只有进入页面后才展示章节状态。

## 10. 我的形象与装备（产品授权的 Profile-only 最小闭环）

- 12 个 canonical V4 动物人格分别使用全身拟人像素伙伴；透明人物层统一为 512×768 WebP 并从 CDN 加载，只用于新版 Profile/我的形象，不替换人格结果和分享资产。已批准的基础人物图自带安全初始服装，且不包含 UI、城市或霓虹背景；两个页面保留原有品牌背景，CDN 失败时使用 character-only fallback。
- Profile 主舞台使用暖白/暖米表面与轻紫品牌点缀，不使用紫色赛博城市背景。基础像素角色只依赖人格与 `profilePixelAvatarEnabled`；`outfit` 为空、装备请求尚未返回或当前没有穿戴时仍显示基础角色，不再错误回退旧低多边形素材。
- Profile 主页面只保留身份主舞台、真实潮流值、真实活动/连接/资料完成度、“我的形象”、“我的故事”和真实徽章。原“更多服务”及退出登录全部迁入齿轮打开的 `/pages/profile-linked/settings/index` 新页面；主页齿轮不再弹 ActionSheet。
- 四个独立槽：上装、下装、鞋履、配饰。页面内变更只修改草稿，用户点击“保存形象”后带 `expectedVersion` 持久化；穿脱、保存和库存均为服务端状态。正式单品分层 raster 获批并发布前，装备状态不叠加任何紫色几何块、code-native 覆盖层或其他伪造图形，画面继续显示穿着初始服装的基础角色。
- 每个人格首次进入幂等获得四件初始装备。真实活动奖励是永久保留、手动领取的抽取资格；测试阿浪/测试池不产生资格。
- 地点池绑定稳定 `venues.id`；盲盒与未来同餐厅活动共享池。阿浪使用 mission-owned pool。每池 4 普通 + 2 稀有，权重 80/20；全局连续三次未获得新品后，第 4 抽保证当前池未拥有单品（若仍有），当前池集齐时保底计数冻结。
- 重复普通/稀有装备分别转为 10/30 通用碎片；碎片商店普通/稀有价格为 40/120，不接现金、支付或会员权益。兑换使用幂等键。
- `profilePixelAvatarEnabled`、`equipmentRewardsEnabled`、`personalStoryEnabled` 三个服务端开关互相独立。数据库 migration 与 seed 必须先于开启任一新开关。

## 11. 验证基线

```bash
npm run typecheck -w @joyjoin/shared
npm run typecheck -w @joyjoin/server
npm run test -w @joyjoin/server -- --run src/__tests__/geoRoutes.test.ts src/__tests__/alangContent.test.ts src/__tests__/alangGeoFence.test.ts src/__tests__/alangDisclosure.test.ts src/__tests__/alangTargetResolver.test.ts src/__tests__/alangTestPointRoutes.test.ts src/__tests__/alangDebugRoutesGate.test.ts src/__tests__/alangResetRepo.test.ts src/__tests__/alangResetRoute.test.ts src/__tests__/buildAuthUserResponseAlang.test.ts
npm run test -w mini-program -- --run src/pages/alang src/lib/alang src/components/alang/AlangDiscoverCard.test.tsx
```

2026-07-15 已知验证快照：

- 5 个服务端个人故事/装备正确性专项文件共 47 项测试通过；这不替代最终全量 Server/Mini 专项门禁。
- `check-profile-pixel-assets.mjs` 验证 12 张 512×768 透明 WebP，共 473,844 bytes，单张均不超过 64 KiB；manifest/CDN 路径已接线，但远端上传和逐 URL HTTP 验证仍需成功的 CDN workflow 证明。
- migration journal 静态校验通过，71/71 migration 均已登记；该结果不等于 staging/production 已实际应用两份新 migration。
- H5 production build 通过（1,393 modules）。五张页面均已按 390×844 CSS viewport、2× 输出为 780×1688 完成 2026-07-15 最新复截图：Profile、Discover 阿浪卡、Search、我的故事和我的形象均为 F3。我的形象 clipping-aware 视觉扫描为 0 个阻断项；此前 sticky 保存栏与下装/鞋履标签的 2 处报告是滚动视口裁切误报。正式装备美术、设备/微信真机验证尚未完成，所有页面均不得提升为 F4。
- `git diff --check` 通过。微信真机、真实 provider、真实 PostgreSQL migration/并发 smoke 和最终 Weapp/package gate 仍是发布前条件。

必须额外在微信开发者工具/真机检查：定位首次授权、拒绝后设置恢复、iOS swipe-back、前后台恢复、polyline、弱网/超时、短屏安全区和 reduced motion。

## 12. V1.7 本地需求追踪矩阵

> 下列 ID 是仓库内追踪编号，用于把 Word 条款、实现证据和验收状态放在同一处，不替代 Word 原文。

| 本地 ID | V1.7 要求 | 主要实现证据 | 自动验证 | 状态 |
| --- | --- | --- | --- | --- |
| `V17-REF-01` | 执行 ACTIVE 03/05 + APPROVED 06；ACTIVE 07 数据模型和 Profile-only 形象按产品决定覆盖；不实现 FUTURE 04，不恢复 REMOVED 09 | 本文范围边界、现有路由/Tab | 文档映射、路由测试 | **PASS**：阿浪正式美术仍待审批 |
| `V17-UI-03` | Discover 单 NPC 紧凑入口、3 个说明 chip、单 CTA | `AlangDiscoverCard.tsx/.scss` | 组件测试 + `discover-alang-v17` 780×1688 全页截图 | **F3（已截图）**：目标卡区域无 Class A 阻断；正式阿浪图和微信真机仍阻断 F4 |
| `V17-UI-05` | 区域提示 → 雷达/距离 → 找到后说明；地图只显示用户 | `pages/alang/search/` | 定向测试 + `alang-search-v17` 780×1688 截图 | **F3（已截图）**：H5 结构通过；正式区域/找到后图、原生 Map 与定位真机仍阻断 F4 |
| `V17-UI-06` | “我的”暖白身份舞台、透明像素伙伴、真实潮流值/统计、故事与形象入口、齿轮独立设置页 | `pages/profile/`、`pages/profile-linked/settings/` | 数据策略/Profile/设置/装备测试 + `profile-v17` 同尺寸截图 | **F3（待本轮真机复验）**：已移除紫色赛博背景和主页服务列表；12 张 CDN 基础角色已逐项返回 200。微信 TabBar、安全区、staging flags 与多机型真机仍阻断 F4 |
| `V17-UI-07` | 仅本人可见的真实经历连续故事；手动更新、一次一章、历史保留 | `pages/profile-linked/personal-story/`、`/api/personal-story*` | Mini/Server personal-story 专项测试 + `personal-story-v17` 780×1688 截图 | **F3（最新复截图）**：主要视觉层级通过；真实 provider/staging 与多机型真机仍阻断 F4 |
| `V17-UI-08-OVERRIDE` | 12 人格像素形象、四槽穿脱/保存、活动装备池、保底、碎片商店 | `pages/profile-linked/my-image/`、`/api/equipment/*` | Mini/Server equipment 专项测试 + `my-image-v17` 780×1688 截图 | **F3（最新复截图）**：clipping-aware 扫描为 0 个阻断项；此前 sticky 保存栏与下装/鞋履标签的 2 处报告是滚动视口裁切误报。基础人物自带初始服装；未发布单品不显示伪造覆盖层，正式四槽分层 raster 仍待审批，设备验收未完成，因此不得提升为 F4 |
| `V17-AI-01` | MiniMax 主、DeepSeek 回退；结构化事实约束叙事，不虚构 | personal-story generation service/worker | provider/schema/grounding/worker tests | PASS |
| `V17-GEO-01` | 复用现有腾讯地图接入，不新增 SDK/provider/Key | `routes/domains/geo.ts`、`api/geo.ts` | `geoRoutes.test.ts` | PASS |
| `V17-SEC-01` | 搜索阶段隐藏目标，陪伴阶段才披露路线终点 | `alangDisclosure.ts`、`alangTargetResolver.ts` | disclosure/target resolver tests | PASS |
| `V17-ARRIVE-01` | 服务端固定 5 米并要求稳定读数 | `alangGeoFence.ts`、`constants.ts` | geofence/content tests | PASS |
| `V17-STATE-01` | 页面断点由服务端 `stage/currentNodeId` 恢复 | Alang 各阶段页、`useAlangMission.ts` | mini-program Alang tests | PASS |
| `V17-ARCHIVE-01` | 先展示结果，再由用户主动收录 | `result/index.tsx`、`POST .../complete` | result/server tests | PASS |
| `V17-PERF-01` | 阿浪子包保持轻量，不拖累主包 | `pages/alang` subpackage | 微信生产编译 + package-size | **ALANG PASS / MAIN BLOCK**：Alang 172.9KiB；主包 raw/zip 3.22MB，超过 2.00MB；总包 5.38MB，未在本轮处理范围外主包问题 |
| `V17-QA-01` | 真机定位/地图/弱网与五页截图验收 | `profile-v17`、`discover-alang-v17`、`alang-search-v17`、`personal-story-v17`、`my-image-v17` | 390×844 CSS viewport、2× 输出 780×1688；H5 不能替代真机 | **RE-CAPTURED / F4 BLOCKED**：最新复截图五页均为 F3；我的形象 clipping-aware 扫描为 0 个阻断项，此前 2 处 overlap 为滚动裁切误报。正式装备美术、微信真机、设备矩阵与真实 provider 尚未验收 |
