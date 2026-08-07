# 闪现正式版：数据库与上线顺序

> 2026-08-07 当前覆盖：正式流程已从随机任务链切换为《没有名字的旧物》15 单元故事链。下文涉及 30 条任务、目的地和交付的步骤仅用于既有历史表兼容，不再构成新版本开放门槛。

## 2026-08-07 故事链上线顺序

1. 只读确认生产库现有 `flash_*` 表和迁移日志，审阅并手动执行 `20260807010000_flash_story_season.sql`。迁移只新增六张故事表和 `flash_encounters.story_episode_id`，不删除旧任务表或历史数据。
2. 保持 `alangEnabled=false` 部署代码。确认五位内置 NPC 已存在后执行迁移中的幂等第一季 seed；seed 生成 15 个 reviewed 单元和 15 个故事碎片，但季保持 draft。
3. operator+ 在 `/admin/alang` 的“第一季故事”逐单元检查角色人设、动物行为、关系线和动画。没有正式眨眼帧时 `blinkAssetUrl` 必须为空。
4. 15 个单元全部审核后，由 operator+ 显式发布故事季；发布动作写管理员审计。旧已发布季会转为 archived。
5. 运行 `npm run check:flash-readiness -w @joyjoin/server`。新门槛要求 1 个已发布季、15 个已审核单元、至少 5 位角色覆盖、所有 active NPC 有批准相遇地点，以及深圳边界资产与许可通过。
6. 在 staging 完整走通：在线列表 → 选择 NPC → 直接打开前台地图 → 10 米到达 → 故事单元 → 选择 → 碎片 → 同幕任意顺序补齐五人 → 自动进入下一幕 → 15/15 季终。重复提交不得重复发碎片或重复推进。
7. 微信真机检查前台定位停止、长文本滚动、低端机动画、`prefers-reduced-motion`、后台编辑/审核/发布和版本冲突后，再小流量开启生产 `alangEnabled`。

回滚只需关闭 `alangEnabled` 或归档当前季；新增表和旧任务历史都保留。不得为了回滚删除故事表、任务表或用户进度。

## 旧任务链上线记录（历史兼容）

正式闪现使用独立的 `flash_*` 表，不复用、改名或删除旧阿浪原型的
`alang_missions`、`alang_mission_progress`、`alang_story_archives`。这是纯新增
（expand-only）变更，旧版本服务不会读取新表。

## 为什么仓库暂不包含迁移 SQL

`database-migration-safety` 要求写迁移前通过 Postgres MCP 只读确认线上表、约束、
索引和行数。本次工作环境没有 Postgres MCP，因此只提交 Drizzle schema，不能把本地
假设冒充线上事实。连接线上只读检查后，才可按仓库流程生成并审阅 additive migration。

## 上线顺序（不得跳步）

1. 用 Postgres MCP 核对线上 schema；生成只新增 `flash_*` 表、索引和 check constraint
   的迁移。迁移需事务化、可重复执行，并在 staging 先验证。当前 schema 共 15 张表；
   地点审核字段包含 `last_reviewed_at/reviewed_by`，任务交付需包含
   `delivery_encounter_id` 及对应索引/外键；隐藏地点寻找预算使用
   `flash_locate_budgets`，按用户与班次唯一并仅保存计数/时间，不保存坐标。
2. 先部署迁移，再部署仍保持 `ALANG_ENABLED=false` 的应用代码。
3. 显式运行 `npm run seed:flash -w @joyjoin/server`。该命令写入 5 个内置种子 NPC（仅作为初始目录，不构成数量上限）、
   30 个 `pending_review` / inactive 任务草案及 NPC—任务文案。`APP_MODE=staging`
   时还会自动初始化南山区、福田区各 2 个 verified 公共空间：优先使用腾讯地图
   suggestion 返回的同区数据；腾讯未配置、超时、返回错误（包括 status 121）或没有
   同区候选时，记录错误并回退到仓库内经过运营核验的固定 GCJ-02 seed。该 fallback
   仅用于 staging bootstrap，不改变后台正式审批仍需腾讯真实反查的规则。
4. 运营后台逐条审核任务，录入并批准深圳相遇地点、任务目的地、开放星期/时段，
   建立 NPC—相遇地点、任务—NPC、任务—目的地关联。批准动作必须留管理员审计日志；
   服务端腾讯地图反查必须返回深圳且行政区一致，不能使用矩形 bounds 降级结果代替批准。
5. 由法务/运营确认固定版本深圳边界仅在 JoyJoin 私有服务端使用的许可依据，再将
   `FLASH_SHENZHEN_BOUNDARY_APPROVED_SHA256` 设置为已审核资产的 runtime semantic SHA-256
   （当前为 `b691faa581d9330e6dc738dcd11421958ca2d4ddea271b656a56237f9fa6fb0b`）。
   仓库作者的 MIT 声明不能单独替代上游地图数据权利确认；未确认或 hash 不一致时
   readiness 必须包含
   `shenzhen_boundary_license_not_approved`，不得继续。
6. 运行 `npm run check:flash-readiness -w @joyjoin/server`。只有输出 `ready: true`
   才能继续；该命令不写数据库，并要求每一位 active NPC 都有批准相遇地点和至少一个
   已人工审核、已激活、已关联批准目的地的候选任务，同时校验边界文件完整性与许可门。
7. 保持 `ALANG_ENABLED=false` 做一次次日草案生成和发布演练；确认 09:00–21:00、
   每班 180–300 分钟（3–5 小时）、同 NPC 间隔至少 90 分钟、每 NPC 最多两班、地点不重叠。
8. 此条为旧任务链历史记录，不再执行；当前上线验收以前文“直接地图 → 10 米相遇 → 故事 → 碎片 → 季终”为准。

部署脚本在 seed 后执行地点硬门：`flash_encounter_locations` 中必须同时满足
`approval_status='approved'` 与 `is_active=true`，且南山区、福田区分别不少于 2 条；
否则部署以非零状态退出。后台地点生命周期展示为
`draft → need_map → pending_review → approved → active`，其中 `need_map` 是尚未完成
地图选点的模板态，`active` 是已审核且已启用的运行态。

## 失败与回滚

- 新表未迁移：用户 API 固定返回 `FLASH_SCHEMA_NOT_READY`，不降级到旧阿浪数据。
- 内容或地点未完成审核：固定返回 `FLASH_CATALOG_NOT_READY`。
- 深圳边界文件完整性失败或许可未确认：readiness 固定失败，用户 API 不得开放。
- 已批准地点的坐标、地址、开放时段或角色绑定被修改：自动退回 inactive draft；已知
  不安全的任务目的地被停用/拒绝时，关联未完成任务在同一事务内改为 `withdrawn`。
- 关闭 `alangEnabled` 会立即阻断正式闪现入口和用户 API；后台维护任务仍会清理到期
  私信与任务，不依赖功能开关。
- 回滚应用代码时保留新增表；不要删除表或清空用户任务。旧服务不会访问它们。
