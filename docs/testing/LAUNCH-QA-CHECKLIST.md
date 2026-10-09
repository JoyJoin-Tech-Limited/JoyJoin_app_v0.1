# JoyJoin Launch QA Checklist — v2（一次过总表）

> **版本：** v2 · 2026-10-06（商业化小天才 × launch-readiness 合并版，含 A/B/C 增量）
> **定位：** 工程侧上线门。与 `docs/testing/BETA-LAUNCH-TEST-CHECKLIST.md`（tester 手工走查）互补，不互相替代。
> **裁决原则：** 上线门只有三扇 — **钱路（支付/退款/权益）**、**审核路（微信提审姿态 + 文案）**、**回滚路（flag/镜像/DB 可逆）**。其余全部降级 P1/P2。
> **证据纪律：** 每条 P0 必须留证据（命令输出、DB 行、URL、截图），落盘 `.git/.orchestration/launch-qa/<date>/`。不接受「本地能跑」。
> **Repo 落点、命令已于 2026-10-06 对照仓库核实；无法从仓库确知的标「待验证」。**

---

## §0 使用说明

- 每项格式：`[ ] 检查项 — 命令/路径 — PASS 标准`
- FAIL 处理：P0 立即停发；P1 带缺陷上线需 ops 签字；P2 列入 follow-up。
- 修复路由：支付语义 → `payment-entitlement-authority` skill；flag → `feature-flags-launch-config`；文案 → `joyjoin-brand-guidelines`。不得在本表执行中私改语义。
- 完成后填写 §21 证据登记表，随 release 归档。

---

## §1 P0 — 静态门与构建完整性

- [ ] `npm run guardrails` — 全绿（secrets、legacy 标识符、import 边界、emoji、BEM class coverage、页面状态居中、subpackage 样式门、budget-tier 守卫）
- [ ] `npm run dep-check` — root 无 dependencies/devDependencies
- [ ] `npm run typecheck` — 全 workspace 0 error
- [ ] `npm run lint` — 0 error
- [ ] `npm run test -w @joyjoin/server` — 全绿；重点确认 `registrationErrorCodes.test.ts`、`fkCascadeDeleteContract.test.ts`、`adminRbacCoverage.test.ts`、`testAdminAuth.test.ts`、`districtCatalogContract.test.ts` 均 PASS
- [ ] `npm run test -w mini-program` — 全绿（含 `brandFont.test.ts`）
- [ ] `npm run check:full` — release commit 上重跑一次，聚合门全绿
- [ ] `npm run harness:gate` — 5-pillar 门 PASS
- [ ] `npm run orchestration:validate` — PASS
- [ ] `npm run design:audit:changed` + `npm run audit:visual` — 0 error（渲染层遮挡/布局缺陷）
- [ ] `npm run bundle-size:check` — 通过
- [ ] `npm run check:package-size -w mini-program` — zip ≤ 2MB（WeChat 硬限）
- [ ] `npm run check:compiled-package-size -w mini-program` — 子包体积均在限内（与上条互补）
- [ ] `npm run validate:miniscript-story` — exit 0（离线 QC）
- [ ] `npm run validate:flash-story` — exit 0（即使 Flash 暗发布，剧情资产不得带病）

## §2 P0 — 数据库与迁移安全

- [ ] `npm run db:journal-check` + `npm run db:verify` — schema 与目标库一致（**staging 和 production 各跑一次**）
- [ ] 服务器对目标库冷启动无 `validateDbSchema()` fail-fast（`apps/server/src/db.ts`）— 观察启动日志
- [ ] 所有 `apps/server/migrations/*.sql` 已在目标库手工执行（staging/production 不自动跑 DDL；逐条记录 `psql "$DATABASE_URL" -f <file>`）
- [ ] budget-tier 迁移 0093（venues 重打标）+ 0094（registrations 重打标）已应用；读侧归一化在役（`venueAssignmentService`）
- [ ] 场地供给白名单核对（**阻塞发布**，`docs/design/budget-tier-t0-signoff-checklist-20260916.md`）：深圳 `dining_150_below`/`dining_150_200`/`dining_300_500` 无餐厅 = 未列白名单档位必须补齐场地；弥所/Bruma/Max 为 `ASSUMED_PENDING_VERIFICATION`，上线后用真实菜单复核
- [ ] 每个已开放测试池的 `dateTime` 被该档位 ≥1 个 venue slot 覆盖（否则 `地点待定`）
- [ ] `pricing_settings` 已 seed（`seed_pricing_plans_20260805.sql`）；悦聚月卡/悦聚季卡/三连局包/六连局包/单场局票 名称与价格 DB 驱动一致
- [ ] Profile V1.7 两个迁移（`20260715010000_add_equipment_personal_story.sql`、`20260715011000_seed_equipment_catalog_pools.sql`）**要么已应用，要么三个子 flag 保持 false** — 二选一，禁止中间态
- [ ] 生产 DDL 前有 DB 快照；DDL 先于停止引用旧列的代码部署（三段式纪律）
- [ ] **恢复演练（不只备份）：** 从最近一次 DB 快照实际 restore 到一次性数据库并 `db:verify` — 备份没 restore 过 = 没有备份
- [ ] 测试池清理走 `cascadeDeleteByIds`（`apps/server/src/lib/fkCascadeDelete.ts`），无手工子表清单
- [ ] **生产数据卫生：** Discover 公开 feed 过滤 `is_test_pool`（`userEventPools.ts:159-161` 已核实 ✓）；补查无 mock 场地/mock 用户经 `seed:test-data`/`seed:mock-data` 泄漏进生产

## §3 P0 — 钱路（支付 / 权益 / 退款）

**环境姿态**
- [ ] `PAYMENTS_ENABLED=true`；全部 `WECHAT_PAY_*` 已设（`docs/product/LAUNCH_CONFIG.md`）
- [ ] `WECHAT_PAY_APP_ID === WECHAT_APPID`（不一致时生产启动直接失败 — 必须启动成功）
- [ ] `WECHAT_PAY_APIV3_KEY` 恰 32 字节；`WECHAT_PAY_PLATFORM_CERT` 为合法 PEM 或 base64 PEM（证书/公钥两种模式均可）
- [ ] **平台证书有效期 > 上线后 90 天**（轮换自动化是已知 follow-up，先人工盯到期日）
- [ ] staging：`APP_MODE=staging` + `TEST_PAYMENT_PRICE_IN_CENTS=1` 真金测试；`MOCK_PAYMENTS=true` 走秒付 mock
- [ ] 生产 env 无 `TEST_PAYMENT_PRICE_IN_CENTS` 泄漏

**全链路（staging 真机 + production 小额真单）**
- [ ] 报名 → `POST /api/payments/create` → `Taro.requestPayment` → 支付成功 → 验证页轮询 → 报名落库（金额、plan 名、优惠券抵扣逐项核对）
- [ ] Webhook：`POST /api/webhooks/wechat-pay` 签名验证 + 时间戳 >5min 拒绝（非 dev）；重复 webhook 幂等（只 fulfil 一次）
- [ ] 漏 webhook 兜底：`POST /api/payments/:wechatOrderId/reconcile` 幂等，返回 `{status, fulfilled}`
- [ ] 幂等：双击支付、重复 create、webhook+reconcile 并发 — 无重复扣款/重复报名
- [ ] 支付取消/超时：pending_order 留存，重入可重试或取消（`PendingOrderResume` 桥）
- [ ] **悬空 pending 订单：** 无服务端过期 sweep（已核实 `payments.ts` 无 expiresAt 逻辑）— 验证 JSAPI 超时（~2h）后用户重进不被 `PendingOrderResume` 卡死、可重新下单
- [ ] `PAYMENTS_DISABLED` 杀开关行为：客户端显示维护态而非裸 503
- [ ] 限流：`paymentEndpointLimiter` 10/min → 429 + Retry-After
- [ ] 优惠券：`POST /api/coupons/validate` 有效/过期/重复用；WELCOME50 banner 展示与自动选中；**社区统计数字全部 DB-backed，零虚构**
- [ ] 权益：订阅/活动包/单场票 entitlement 校验正确；credit 核销与取消回滚（FK 500 已修复路径）
- [ ] 退款：`POST /api/admin/payments/:id/refund` 成功 + `adminAuditLogger` 留痕
- [ ] `npm run smoke:auto-refund -w @joyjoin/server` — Trigger A（场次取消）+ Trigger B（未成行）全绿、credits 恢复、幂等、自清理
- [ ] 安心补位暗发布核验：`preRevealRefundEnabled=false` 时 pre-reveal 取消走 legacy；`noRefundAfterReveal=false`；两 flag 默认关
- [ ] `scripts/check/payment-smoke-test.mjs` 对目标环境跑通（用法见脚本内说明）
- [ ] **本批 `repositories/paymentsRepo.ts` 有改动 — 以上幂等/退款/webhook 三项必须用新代码重跑，不沿用旧证据**

## §4 P0 — 认证 / Onboarding / 身份

- [ ] 真机微信一键登录：`jscode2session` → session cookie（`COOKIE_DOMAIN` 正确）→ `/api/auth/user` 返回 `nextStep`
- [ ] `nextStep` 全状态矩阵：未测人格 → personality-test；资料未全 → setup/extended/review；完成 → discover；客户端零自算
- [ ] 游客匿名测评快照恢复（`joyjoin_v4_assessment_session`）冷启动 `reLaunch` 回测评；已完成不恢复
- [ ] 欢迎回来页（7 天 seen 重置）逻辑正确；`restartOnboarding` flag 状态符合预期
- [ ] 401 会话过期：清 query cache → 回落地页，无死循环
- [ ] `authEndpointLimiter` 20/min 生效
- [ ] 生产安全面：`ALLOW_PRODUCTION_AUTH_DEBUG` 未设、`ENABLE_DEV_AUTH_TOOLS` 未设、`/api/test/**` 全部要求鉴权（`testAdminAuth.test.ts` 兜底）
- [ ] 管理端登录走 `admin_accounts`；生产 legacy `users.isAdmin` 路径已禁用；禁用账号下一请求即被拦
- [ ] 隐私协议/用户条款为 2026-08-18 版（排桌词汇 + 条件式 AIGC 条款）；提审表单勾选「采集隐私」
- [ ] `/api/auth/user` 的 `features.*` 与 DB flag 一致（抽 5 个关键 flag 对账）
- [ ] **本批 `middleware/auth.ts`、`repositories/usersRepo.ts`、`routes/domains/auth.ts`、`mini-program/src/lib/api/authSession.ts` 均有改动 — 本节全部矩阵在 staging 重跑，不沿用旧证据**

## §5 P0 — 用户注销与个人信息删除（确认缺口 · 新增）

> **现状（2026-10-06 核实）：** 全仓仅 `packages/shared/src/legal/joyjoinTermsZh.ts:139` 一条「联系开发者申请注销，十五个工作日内处理」。**无 in-app 注销入口、无服务端注销路由。** 微信对带登录小程序的审核趋严，且第一个注销申请若无流程即事故。

- [ ] 决定姿态并记录：self-serve 注销页 vs 人工受理通道（**建议 v1 = 人工通道 + 台账，不阻塞上线**）
- [ ] 人工注销 runbook 落盘（`docs/runbooks/`）：受理入口（客服/邮箱）、身份核验步骤、删除范围（用 `cascadeDeleteByIds` 级联，注意 drizzle-only FK 需先手工删）、支付/订单记录依法保留边界、15 个工作日 SLA 台账格式（**2026-10-06 已落盘 `docs/runbooks/account-deletion.md`，待 staging 演练 + legal 留存裁定**）
- [ ] 演练一次：对 1 个测试用户走完整注销 — 级联无 23503 残留、会话立即失效（复用 `revokeUserSessions`）、台账登记完整
- [ ] 隐私指引/条款中的注销路径描述与实际流程一致

## §6 P0 — 核心旅程 E2E（单测试池 + 真池各一遍）

- [ ] 落地 → 测评（12 原型 V4）→ 结果页（分享海报开关按 `personalityShareEnabled`）→ discover
- [ ] Discover 区域过滤：cluster 映射经 `getClusterIdByDistrictName`（区级名），live 计数与 feed 一致，零场次不给假 0，pending 芯片走救援弹窗
- [ ] 报名：正常、满员（`POOL_FULL`，测试池豁免）、窗口外、重复报名、未完成 onboarding — 每个错误都带 machine-readable `code` 且客户端文案正确
- [ ] 单测试 `/start` `/reset` 后注册缓存正确 bust（`bustRegistrationCaches`），matching-status 不显示「未报名」
- [ ] 排桌：admin 触发 → pending → matched（WS `pool_matched` 无刷新跳变）→ reveal → 组详情/桌友卡/`TablemateDetailSheet`
- [ ] 场地：正常分配 / 未分配 `venue_tbd` 琥珀卡 + WeCom 告警
- [ ] Duo：邀请 → 双方报名绑定 → 原子 2 座位；不可放置 → 整组顺延 → 场次未成行退款
- [ ] 取消：匹配前/后 policy 由服务端 `cancelPolicy` 决定，客户端文案与退款行为一致（两 flag 关闭 = legacy 精确复刻）
- [ ] 盲盒/组队拆盒路径 + `event-detail?id=blindBoxEventId` 跳转；写 `events.id` FK 的路由先过 `resolveCanonicalEventId`（feedback/connections）
- [ ] 活动当天：活动详情/票据页/集结房间（若暗发布则入口不可达且不报错）
- [ ] Icebreaker：`/start` → 全 phase 推进 → recap；`npm run smoke:icebreaker-waves -w @joyjoin/server`（6 人 bot 全链路 + medal honesty + `_HL` promptVersion）
- [ ] 连接/反馈：提交成功；`/api/participants` 正常；无 `/chats` 残留入口
- [ ] 全旅程零白屏：每个 tab 页 loading/empty/error 三态可重试（Discover/Events/Connections）

## §7 P0/P1 — 排桌与场地引擎

- [ ] `npm run simulate:gate` — 质心隔离 100%
- [ ] 6D 权重正确；`ENABLE_SEMANTIC_SIMILARITY` 生产姿态记录（文档称 2026-05-09 起已开 = 7D，**待 ops 复核当前值**）
- [ ] `poolMatchingService` 确定性：同输入两次跑分组一致
- [ ] 容量硬约束（`seatingCapacity < groupSize` → score 0）；budget 归一化读写两侧匹配；`budgetAdjacencyEnabled` 保持 OFF（需 dual-run 后才可开）
- [ ] 性别平衡 hard/soft 模式行为符合 admin 配置；duo 硬单元规则（MAX 1 duo/组、duo 内对不计组质量）
- [ ] 重跑匹配幂等：无重复组、无孤儿用户（`matchStatus` 边界）
- [ ] Match Compass：`preference_lock_at` 前可调，锁定后只读；strictness 只影响组队不改 pair score
- [ ] 阈值变更纪律：只在两次 match run 之间改（`PUT /api/admin/matching-thresholds` 全局生效）
- [ ] **district 目录契约（新增，本批改动）：** admin `cityDistricts.ts` 建池可选 district 与小程序 `getClusterIdByDistrictName` 映射同源（`districtCatalogContract.test.ts` 锁死）— 防 2026-09-30「按商圈名匹配 → 静默过滤为零」重演
- [ ] **venueDataQuality（新增，本批改动）：** `lib/venueDataQuality.ts` — 脏数据场地在 admin 保存侧与分配侧行为明确（拦截 or 告警），`venueDataQuality.test.ts` 绿
- [ ] 压力模拟 runbook 走过一遍（`docs/runbooks/matching-stress-simulation.md`）

## §8 P1 — 通知、实时与调度器

- [ ] `npm run verify:subscribe-templates` — 3 模板 ID/字段 key 与微信线上 API 一致
- [ ] 模板映射：报名结果（排桌完成 XOR 退款）、活动状态（当天早 XOR 候补，带场地）、活动评价（T+1）
- [ ] `subscribe_grant_result` 计量；`subscribe_message_sends` 唯一约束幂等（同 user+moment+pool 不重发）
- [ ] `subscribeRemindersEnabled` 杀开关可关；调度窗（T-3h..T-12h / T+20h..T+30h）正确
- [ ] 推送文案纯服务性，零营销词
- [ ] WS：连接/心跳/重连；`ROOM_*` 5s 离场宽限、2s poke 节流；断线后 3s 轮询兜底仍工作（**本批 `websocket.ts`/`useWebSocket.ts` 有改动 — staging 重测**）
- [ ] 通知中心未读数/已读语义正确；admin 广播留审计
- [ ] **调度器健康（新增）：** `subscribeReminderScheduler.ts`（10min tick）、`venueTbdRetryScheduler.ts`、`socialIcebreakerSweep.ts`（TTL 清扫 + recap dwell 补写）— 重启后无重复跑/无漏跑、各有杀开关、日志可见
- [ ] **时区正确性（新增）：** 调度窗口基于 `lib/eventDateTime.ts`（+8h、`getUTC*`），跨设备/服务器时钟不漂移；禁止跨时钟比较 `updatedAt`（2026-08-13 设备时钟漂移教训）

## §9 P0 — 小程序打包与微信提审（一次过 runbook）

**打包**
- [ ] `npm run build:weapp -w mini-program` 成功（自动跑 `validate:wechat-app-config`，scope.* ≤30 字）
- [ ] `npm run verify:subpackage-styles -w mini-program` — 无缺失选择器、**无任何非空 `sub-common.wxss`**
- [ ] `npm run verify:upload-assets -w mini-program` + `npm run validate:assets -w mini-program` 通过
- [ ] 新增捆绑资产目录已加入 `project.config.json` `packOptions.include` 白名单（漏加 = 设备端静默缺失）
- [ ] tab bar：`centerHub` 有非空 `iconPath` 且出现在 `MINI_PROGRAM_TAB_BAR_CONFIG_ITEMS`（否则 `switchTab:fail`）
- [ ] CDN manifest 每个 localPath 存在；avatar sourceAssetCount 与 jq 断言一致；本批新 hash 资产已随 workflow 上传
- [ ] 404 不可缓存（nginx `@static404`）未被回归；`cdnAsset()` 无双重包裹

**提审姿态（零代码，管理后台）**
- [ ] 所有 `SOCIAL_*_LLM_ENABLED` + `SMART_PROFESSION_V1_ENABLED` = false；`ALANG_ENABLED=false`；`PAYMENTS_ENABLED=true` 且线上 ≥1 个 open「体验场」池可走完报名→支付→排桌
- [ ] 服务类目 = 生活服务（非社交/婚恋）；隐私指引声明位置采集；服务器域名 `*.joyjoinapp.com` 白名单
- [ ] 文案纪律扫描：mini-program + shared copy + server 通知文案无 匹配/社交/灵魂/撮合/AI 等禁用词（机器标识符与 `exceptions.ts` 保留项除外）
- [ ] AIGC 角标 fail-closed：LLM 杀开关关闭时角标确实不渲染（且此时确无 AI 内容）
- [ ] **诱导分享前置扫描（新增）：** 逐屏审计 — 分享不做为解锁/使用前置条件；无「分享后可见」文案；海报分享失败不阻塞主流程
- [ ] 提审备注用 `docs/runbooks/wechat-review-submission.md` §6 原文；提交 workflow `api_target=production`
- [ ] 法律 AC-14 sign-off 已完成
- [ ] 提审版本 = staging 验收通过的同一 commit（main → staging 成功后才上传开发版）
- [ ] **版本回退预案（新增）：** 记录当前线上版本号 + 上一稳定版本号；新版本被拒/崩溃时 mp.weixin.qq.com 版本回退步骤写进 runbook
- [ ] **品牌字体（新增，本批改动）：** `brandFont.ts` + 删除 early 字体文件 — **真机**验证动态文本不回落 PingFang（2026-10-05 同-family 覆盖坑；模拟器不可信）

## §10 P0 — Feature Flags 与回滚

- [ ] flag 真相：DB 行 > env 回退，5s LRU；admin 页 super_admin + `FEATURE_FLAG_UPDATED` 审计
- [ ] 发布列车 BLOCKING（开任何 flag 前，`docs/operations/release-train-gameplay-flags-202609.md` §2）：`LIE_DETECTIVE_MODE` 生产/staging unset 或 v1；`PERSONALITY_DICE_CHOOSE_MODE_ENABLED` env 姿态确认；`SOCIAL_ICEBREAKER_ENABLE_AUCTION` 姿态确认；基线 SQL 已快照；客户端版本门已上线
- [ ] 暗发布清单在生产**保持 false**（逐一对账 admin/feature-flags）：`alangEnabled`、`flashStoryActionsEnabled`、`gatheringRoomEnabled`、`preRevealRefundEnabled`、`noRefundAfterReveal`、`budgetAdjacencyEnabled`、`icebreakerGroupBeatsEnabled`、`miniscriptEvidenceVoteV2Enabled`、`auctionV2Enabled`、`matchNeverMeetSentinel`、`matchChemistryCalibrationEnabled`、`matchingPuzzlePreludeEnabled`、`socialSquadComposedHeroEnabled`、`profilePixelAvatarEnabled`、`equipmentRewardsEnabled`、`personalStoryEnabled`
- [ ] 客户端硬编码门核验：`PAYMENT_RITUAL_V2_ENABLED` 仍为 false（或前置 4 项全部满足）
- [ ] Kill drill（staging 演练，逐条计时）：每个 LIVE flag 从后台置 false → ≤5s 生效 → <1min 完成
- [ ] 快照语义：进行中会话不被 flag 切换改写（lie/dice/auction/miniscript 阶段快照）
- [ ] 回滚动作可执行性：release-train §5 每条按 flag 走查

## §11 P0 — Admin / RBAC / 审计

- [ ] `viewer` 对全部写端点 403（`adminRbacCoverage.test.ts` + 手工抽 3 个路由）
- [ ] 敏感动作全审计：退款、封禁、flag 变更、考勤覆盖、密码重置
- [ ] 管理端财务/用户/活动池/反馈/通知/数据洞察页在 production 数据量下无 500（**本批这批 admin 页面全部有改动 — 逐页冒烟**）
- [ ] 事件池创建/编辑/关闭 → Discover 可见性联动正确；无 DELETE 端点是已知设计（状态流转）
- [ ] **`revokeUserSessions.ts`（新增未跟踪文件）验收：** ① 被**所有** ban/disable/注销路径调用，不是只接一处；② 补契约/单测（防 N1 类「以为有保护实际没有」事故）；③ 顺带关 R-05 — admin 账号 disable 后存量会话清理也走此路径（**2026-10-06 已实现：4 路径接线 + `revokeUserSessionsContract.test.ts` 21/21；待 hunk 隔离与全量复跑**）
- [ ] **反馈闭环（新增）：** 用户反馈提交 → `AdminFeedbackPage` 可见 → 处理留痕；反馈入口在用户端可达
- [ ] 事故 runbook 就绪：`docs/runbooks/admin-incident-handling.md`

## §12 P0 — 安全与运维姿态

- [ ] 无 committed secrets；guardrails secrets 检查绿
- [ ] 单副本契约：API 服务 max replicas = 1（rate limit/abuse/inference cache 均为进程内）
- [ ] Webhook 签名与时间戳校验（非 dev）；`NODE_ENV=production` 下无堆栈泄漏（统一错误信封）
- [ ] CORS/会话 cookie 域正确；`SESSION_SECRET` ≥32 字符
- [ ] 应急面：`docs/runbooks/emergency-auth-surfaces.md` 已读，生产 override 关闭
- [ ] 重启后烟雾（每次部署后）：`GET /api/readyz` 200、auth 限流抽测、staging 支付 create 成功
- [ ] CVM 内存护栏：API `mem_limit 2g` + `--max-old-space-size=1536`；staging 同；无 OOM 重启
- [ ] **session 表健康（新增）：** `connect-pg-simple` 过期会话清理正常；ban 洪峰下 sessions 表不膨胀（配合 §11 `revokeUserSessions` 验证）
- [ ] **内容安全（新增）：** 用户可写文本面（昵称、签名、职业自由文本、活动反馈、Duo 留言）逐一确认过敏感词/审核层；`abuseDetection.ts` 阈值在 open 注册下不过松（单副本契约内）

## §13 P1 — 可观测性与上线窗口指标

- [ ] `GET /api/health` / `/api/readyz` / `/api/metrics` 可达且内容正确；readyz 已接合成监控
- [ ] 告警 runbook 可用（`docs/runbooks/alerting.md`、`observability.md`）；WeCom 通道测试一条
- [ ] 合成探针 `scripts/synthetic/happy-path-probe.mjs` 对目标环境跑通（用法以脚本内为准）
- [ ] 上线 48h 观察窗指标：支付成功率、报名漏斗、`joyjoin_ai_calls_total{outcome="fallback"}` ≤ 基线+2pp、每 phase dwell 退化 ≤15%、零 copy/AIGC 投诉
- [ ] `npm run check:glow-honesty -w @joyjoin/server` 在 flag 开启环境中 = 100%（暗发布期预期 NO_DATA/exit 0）
- [ ] 日志规范：请求处理器无 `console.*`；admin 操作可检索
- [ ] 部署管道：main→staging 成功记录、GHCR/TCR pull 正常、失败自动回退旧镜像/nginx
- [ ] **分析事件契约（新增）：** `discoverAnalyticsAllowlistContract.test.ts` 绿；新事件（`coverage_empty_tap`/`coverage_adjacent_accept`/`pending_expand`/`flash_search_started`/`subscribe_grant_result`）在 server 白名单内且 metadata 无 PII；支付 ritual 事件走专用 `/api/analytics/payment`；`kpiEndpointLimiter` 30/min

## §14 P1 — 邀请 / 裂变链路（新增整条业务线）

- [ ] `invitations`（活动级，`expiresAt`/`invitationType`）vs `referral_codes`（永久）双表消歧：注册时 `invitationCode` 先查 invitations 再查 referral_codes
- [ ] `pendingReferralCode` 跨登录归因不丢失；`invitation_uses` 与 `referral_conversions` 双表防自推、防重复
- [ ] Duo 邀请：`POST /api/pools/:id/duo-invites` 幂等、过期 = `preference_lock_at`；公开端点 `GET /api/duo-invites/:code` 限流生效
- [ ] 分享卡片落地页参数（`?invitationCode=`）在落地页正确透传（`pages/index/index`）
- [ ] **本批 `routes/domains/referrals.ts` 有改动 — 本节重测**

## §15 P1 — 性能与设备适配

- [ ] 跑 `performance-audit` skill 出 PASS/WARN/BLOCK 报告（冷启动 fan-out、低端机 tier、内存）
- [ ] 真机：iOS + Android 各一台走完「落地→测评→报名→支付」；低端机（benchmark ≤15）tab bar/动效降级生效
- [ ] `prefers-reduced-motion` 全局生效；ScrollView 内 `scrollIntoView` 错误滚动正确；swipe-back 后 CTA 不卡死（`useResetOnShow`）
- [ ] 关键页截图归档：`npm run screenshot:landing` / `screenshot:discover-area` / `screenshot:pool-registration` / `screenshot:event-ticket-payment` / `screenshot:gathering-room`（对照基线无回归）
- [ ] 字体两级加载正确（minimal 66KB 本地 + full 621KB CDN 500ms defer，family 名不同 — 与 §9 真机项联动）
- [ ] **弱网（新增）：** 2G/offline 下 `preloadOnboardingAssets` 跳过、落地页不白屏、支付失败可重试

## §16 P1 — 内容与文案 QA

- [ ] 🔴 品牌硬规则：无 emoji、无 gradient CTA、无虚构数字、错误文案 CJK
- [ ] 服务端错误码契约：所有用户可见 4xx/5xx 带 `code`；未映射 code 回落中文 message（无英文泄漏）
- [ ] 空态/加载态/错误态使用品牌组件，非裸 spinner
- [ ] 微信审核词汇表全量扫描（`docs/runbooks/wechat-review-submission.md` §2 表）
- [ ] AIGC 角标只在真实 AI 内容出现时渲染
- [ ] 所有「待验证」假设有记录：弥所/Bruma/Max 价格、semantic flag 姿态、生产 env 变量

## §17 P0 — Dirty-Worktree 回归专区（2026-10-06 快照）

> 73 个未提交改动直接命中上线关键面。**以下改动面的既有 QA 证据全部作废，须用新代码重跑。**

| 改动面 | 文件 | 必重跑章节 |
|---|---|---|
| 认证/实时层（P0） | `middleware/auth.ts`、`usersRepo.ts`、`auth.ts`、`authSession.ts`、`websocket.ts`、`useWebSocket.ts` | §4 全矩阵 + §8 WS |
| 支付仓储（P0） | `repositories/paymentsRepo.ts` | §3 幂等/退款/webhook |
| 全局样式 token（P0 视觉） | `_variables.scss`、`_utilities.scss` | `audit:visual` + 全部 `screenshot:*` + 真机五 tab |
| 品牌字体（P0 真机） | `brandFont.ts` + 删 early 字体 | §9 字体项（真机） |
| district 契约（P0） | `cityDistricts.ts` + `districtCatalogContract.test.ts` | §7 district 项 |
| venue 数据质量（P1） | `venueDataQuality.ts` + 测试 | §7 venueDataQuality 项 |
| referrals（P1） | `routes/domains/referrals.ts` | §14 全节 |
| admin 页面群（P1） | 11 个 admin-client 页面 + `adminEventPools.ts`/`adminUsers.ts`/`adminOperations.ts` | §11 逐页冒烟 |
| 会话吊销（P0 新文件） | `lib/revokeUserSessions.ts` | §11 验收三项 |
| 小程序页面群（P1） | discover/events/connections/notifications/profile/matching-status/icebreaker-session/pool-group-detail/center-hub/gathering-room 等 | §6 旅程 + §15 截图 |
| 海报生成群（P1） | `profilePoster.ts`、`squadTableCardPoster.ts`、`mingCardImage.ts`、`momentsPosterFactory.ts` | 各海报生成/保存/分享冒烟 |

## §18 P0 — 本地化雷达（四城）

| 城市 | QA 状态 | 上线动作 |
|---|---|---|
| **深圳** | Launch-primary；区级过滤仅 南山/福田 cluster；venue 白名单有缺口 | **P0**：补齐 `dining_150_below/150_200/300_500` 场地或明确不开放该档；核 Tencent Map key 两条（`TENCENT_MAP_KEY`/`TENCENT_MAP_JS_KEY`） |
| **北京/上海/广州** | **待验证**（repo 内无城市级 launch 证据） | 若无池/无场地：确保 UI 不承诺、Discover 不出现空城入口；核 `city_unlock_progress` 状态机 |
| **全城** | 支付价格 DB 驱动（`pricing_settings`），无城市差价逻辑 | 未来分城定价先过 `payment-entitlement-authority` |

## §19 P0 — 硬停发清单（出现即 NO-GO）

1. 支付 create/webhook/reconcile 任一链路失败或重复扣款
2. `WECHAT_PAY_APP_ID ≠ WECHAT_APPID` 或生产启动校验失败
3. 生产 env 有 `ALLOW_PRODUCTION_AUTH_DEBUG=1` / `ENABLE_DEV_AUTH_TOOLS`
4. 任一暗发布 flag 在生产为 true
5. `verify:subpackage-styles` 失败或存在非空 `sub-common.wxss`
6. `db:verify` 失败 / 服务器 schema drift fail-fast
7. 文案扫描命中审核禁用词且无例外记录
8. `guardrails` / `test -w @joyjoin/server` / `harness:gate` 任一红
9. 任一 LIVE flag 无法 <1min 关停
10. 单副本契约被破坏（replicas > 1 且未上 Redis）
11. **用户注销无受理流程（§5 未关闭）**
12. **`revokeUserSessions` 未接全 ban/disable 路径或无测试（§11 未关闭）**

## §20 执行顺序与交接

- **执行顺序：** §1 → §2 → §3 → §9 → §10（并行 §4/§5/§6）→ §11/§12 → §17 随各章联动 → 其余 P1。
- **交接：** 修复类 → `@backend-engineer` / `@taro-engineer`；支付语义 → `payment-entitlement-authority`；flag → `feature-flags-launch-config`；最终判定 → `@verifier` + `@qa-agent` + Launch Readiness Agent（go/no-go），最后 `@auto-eval` 收口。
- **上线 48h 门：** 支付成功率、报名→支付转化、fallback 率 ≤ 基线+2pp、dwell 退化 ≤15%、退款正确率 100%、glow 诚实率 100%、审核零打回。

---

## §21 证据登记表

> 每条 P0 一行；证据 = 命令输出文件 / DB 查询结果 / URL / 截图路径，存 `.git/.orchestration/launch-qa/<date>/`。

| § | 检查项 | 环境 | 执行人 | 证据路径 | 结果 | 日期 |
|---|---|---|---|---|---|---|
| §1 | guardrails 全绿 | local | | | ☐ PASS ☐ FAIL | |
| §1 | server tests 全绿 | local | | | ☐ PASS ☐ FAIL | |
| §2 | db:verify staging | staging | | | ☐ PASS ☐ FAIL | |
| §2 | db:verify production | production | | | ☐ PASS ☐ FAIL | |
| §2 | 恢复演练 | staging | | | ☐ PASS ☐ FAIL | |
| §3 | 支付全链路（真金 ¥0.01） | staging | | | ☐ PASS ☐ FAIL | |
| §3 | smoke:auto-refund | local/dev DB | | | ☐ PASS ☐ FAIL | |
| §4 | 认证矩阵重跑（dirty 改动后） | staging | | | ☐ PASS ☐ FAIL | |
| §5 | 注销演练 + runbook 落盘 | staging | | | ☐ PASS ☐ FAIL | |
| §6 | 核心旅程 E2E | staging | | | ☐ PASS ☐ FAIL | |
| §6 | smoke:icebreaker-waves | local/dev DB | | | ☐ PASS ☐ FAIL | |
| §8 | 订阅模板校验 | production | | | ☐ PASS ☐ FAIL | |
| §9 | build:weapp + 包体 + 子包样式 | local | | | ☐ PASS ☐ FAIL | |
| §9 | 提审姿态（LLM 关/体验场开） | production | | | ☐ PASS ☐ FAIL | |
| §9 | 字体真机验证 | device | | | ☐ PASS ☐ FAIL | |
| §10 | 暗发布 flag 全 false 对账 | production | | | ☐ PASS ☐ FAIL | |
| §10 | Kill drill 逐条计时 | staging | | | ☐ PASS ☐ FAIL | |
| §11 | revokeUserSessions 接线+测试 | local | | | ☐ PASS ☐ FAIL | |
| §11 | admin 页面群冒烟 | production | | | ☐ PASS ☐ FAIL | |
| §12 | 单副本契约 attested | production | | | ☐ PASS ☐ FAIL | |
| §17 | Dirty-worktree 专区全部重跑 | staging | | | ☐ PASS ☐ FAIL | |
| §18 | 深圳 venue 白名单补齐或关闭档位 | production | | | ☐ PASS ☐ FAIL | |

**Go / No-Go 签字：**

| 角色 | 姓名 | 签字 | 日期 |
|---|---|---|---|
| Engineering Lead | | | |
| Product Lead | | | |
| Operations Lead | | | |
| Legal（AC-14） | | | |
