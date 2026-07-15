# 闪现 NPC｜阿浪 V1.7 — Active Implementation Map

> 当前版本：2026-07-15
> 产品基准：`JoyJoin_Master_PRD_V1.7_Codex执行版_强调Mockup未完全落地.docx`
> Scope ID：`ALANG-V17-VISUAL-ALIGNMENT`

## 0. 视觉参考边界

- ACTIVE 03：现有 Discover 闪现入口落为紧凑单 NPC 卡，不新增一级 Tab。
- ACTIVE 05：寻找页落为区域提示、静态雷达/真实距离信号、找到后说明和用户-only 辅助地图。
- APPROVED TARGET 06：“我的”落为身份舞台、真实潮流值/活动/连接/资料完成度、个人连续故事入口和设置；像素伙伴形象只用于新版 Profile。
- ACTIVE 07 只提供视觉语气参考。按 2026-07-15 产品决定，“我的故事”不再是阿浪/活动档案列表，而是仅本人可见、由真实经历按时间追加的连续故事。
- FUTURE 04 多 NPC 地图仍不实现。FUTURE 08 的 Word 完整方案不照搬；2026-07-15 产品决定仅授权新版 Profile 的“我的形象”最小闭环：12 人格像素伙伴、四槽穿脱、显式保存、活动装备池、碎片和碎片商店。
- REMOVED 09 探索地图不得新增、恢复或借图改导航。
- 事件详情、配置、对话、陪伴、结果没有 ACTIVE Mockup，必须以仓库现有 UI + PRD 正文为基准。
- 阿浪正式人物/场景图仍为 `awaiting-approved-art`；占位图必须继续显示“场景示意”。

## 1. 用户流程与服务端权威

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

## 9. 私人连续故事（产品决定覆盖旧 ACTIVE 07 数据模型）

- API：`GET /api/personal-story`、`POST /api/personal-story/update`、`GET /api/personal-story/update-status`；身份只来自登录会话。
- 事实源只有两类：非 Debug 且 completed 的阿浪档案；严格完成的真实盲盒。盲盒以本人的 group outcome 锁定分组，并额外要求本人已匹配、活动池与分组均非测试/未取消、活动时间已过，以及该活动本人的 `event_feedback.completedAt` 非空；group outcome 单独不足以证明完成参加。反馈文本/分数、姓名、GPS、聊天和客户端自由文本都不进入提示词。
- 用户只提交“更新故事”；服务端按经历发生时间从旧到新建立 durable job。一次真实经历对应一章，章节以 source 唯一约束追加，旧章节不覆盖、不删除。
- 标题固定为 `日期 · 活动类型`。MiniMax 是首选，DeepSeek 使用现有客户端做运行时回退；模型每次只编排一章，输出带 `factIds` 的结构化 paragraphs/clauses，只能选择服务端批准的连接短语。服务端要求全部待写事实恰好使用一次、保持时间顺序，并拒绝任何自由正文、未知实体/数字/地点/日期或语义错配；MiniMax 返回非空但无效时也会继续尝试 DeepSeek。两家均失败或均被拒绝时不插入替代章，已存在章节继续可读，下一次更新从缺失经历继续。
- `personalStoryEnabled=false` 时 Profile/阿浪结果不进入私人连续故事，服务端在访问新故事表前关闭整个 surface：GET 返回 503、POST 返回 403、status 返回 disabled。只有开关为 `true`、故事表已迁移且 AI provider 暂不可用时，已存在章节仍可由 GET 读取；更新返回 503，不覆盖或删除历史。
- 页面不显示“已生成/待续写”统计，不退化为活动流水账，不分享，只有进入页面后才展示章节状态。

## 10. 我的形象与装备（产品授权的 Profile-only 最小闭环）

- 12 个 canonical V4 动物人格分别使用全身拟人像素伙伴；透明人物层统一为 512×768 WebP 并从 CDN 加载，只用于新版 Profile/我的形象，不替换人格结果和分享资产。已批准的基础人物图自带安全初始服装，且不包含 UI、城市或霓虹背景；两个页面保留原有品牌背景，CDN 失败时使用 character-only fallback。
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
| `V17-UI-06` | “我的”身份舞台、透明像素伙伴、真实潮流值/统计、故事与形象入口、设置 | `pages/profile/` | 数据策略/Profile/装备测试 + `profile-v17` 780×1688 截图 | **F3（最新复截图）**：结构、数据与主要视觉层级基本一致；微信 TabBar、安全区与多机型真机仍阻断 F4 |
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
