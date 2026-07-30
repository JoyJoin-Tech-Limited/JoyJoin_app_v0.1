# 街头盲盒正式版：数据库与上线顺序

正式街头盲盒使用独立的 `flash_*` 表，不复用、改名或删除旧阿浪原型的
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
3. 显式运行 `npm run seed:flash -w @joyjoin/server`。该命令只写入 5 个内置种子 NPC（仅作为初始目录，不构成数量上限）、
   30 个 `pending_review` / inactive 任务草案及 NPC—任务文案；不会写地点，也不会
   假装任务已被真人审核。
4. 运营后台逐条审核任务，录入并批准深圳相遇地点、任务目的地、开放星期/时段，
   建立 NPC—相遇地点、任务—NPC、任务—目的地关联。批准动作必须留管理员审计日志；
   服务端腾讯地图反查必须返回深圳且行政区一致，不能使用矩形 bounds 降级结果代替批准。
5. 确认 staging/production 已配置服务端 `TENCENT_MAP_KEY`，并由法务确认腾讯地图逆地理
   编码的必要告知、隐私政策和数据处理安排。正式街头盲盒只接受明确来自 Tencent、城市为深圳
   且行政区属于深圳允许集合的结果；Key 未配置、超时、上游失败、fallback、字段缺失或
   非深圳均 fail closed。除向腾讯地图 HTTPS API 完成当次逆地理编码所必需的上游传输外，
   Key 和原始用户坐标不得写入客户端、数据库、日志、审计、分析、JoyJoin 业务 URL 或
   客户端 query key。
6. 运行 `npm run check:flash-readiness -w @joyjoin/server`。只有输出 `ready: true`
   才能继续；该命令不写数据库，并要求每一位 active NPC 都有批准相遇地点和至少一个
   已人工审核、已激活、已关联批准目的地的候选任务，同时校验腾讯地图服务端 Key 门禁。
7. 保持 `ALANG_ENABLED=false` 做一次次日草案生成和发布演练；确认 09:00–21:00、
   每班 90–150 分钟、同 NPC 间隔至少 90 分钟、每 NPC 最多两班、地点不重叠。
8. 最后在 staging 打开 `alangEnabled`，完成用户端 50 米到达、24 小时对话恢复、
   7 天任务、跨次交付、私信交付后 30 天且提交后最晚 37 天删除的全链路验收，再小流量开生产。

## 失败与回滚

- 新表未迁移：用户 API 固定返回 `FLASH_SCHEMA_NOT_READY`，不降级到旧阿浪数据。
- 内容或地点未完成审核：固定返回 `FLASH_CATALOG_NOT_READY`。
- `TENCENT_MAP_KEY` 未配置：readiness 固定失败，用户 API 不得开放；运行时逆地理编码不是
  明确的 Tencent 深圳结果时，本次请求 fail closed，不得退回本地 bounds、IP 或客户端城市。
- 已批准地点的坐标、地址、开放时段或角色绑定被修改：自动退回 inactive draft；已知
  不安全的任务目的地被停用/拒绝时，关联未完成任务在同一事务内改为 `withdrawn`。
- 关闭 `alangEnabled` 会立即阻断正式街头盲盒入口和用户 API；后台维护任务仍会清理到期
  私信与任务，不依赖功能开关。
- 回滚应用代码时保留新增表；不要删除表或清空用户任务。旧服务不会访问它们。
