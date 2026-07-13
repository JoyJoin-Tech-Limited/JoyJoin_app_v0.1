# 闪现 NPC｜阿浪 V1.5 — 当前实现差异审计

> 审计日期：2026-07-13
> 产品基准：`JoyJoin_Master_PRD_V1.5_Codex执行版_已清理过时功能参考.docx`
> Scope ID：`ALANG-V15-PHASE-B`
> 代码范围：Mini Program、Server、Shared；不改盲盒、匹配、支付、现有 Tab 架构

## 结论

阿浪已不是“待从零实现”的 Prototype。当前代码具备服务端剧情状态机、5 米稳定到达、故事归档、Discover/Profile 入口和单人测试门禁。V1.5 本轮在此基础上补齐腾讯地图 POI/逆解析/步行路线、阶段级坐标保密、服务端断点恢复，并只按 ACTIVE 03/05/06/07 校正对应页面。没有 ACTIVE Reference 的页面以仓库现有 UI 和正文规范为准。

正式人物/场景插画尚未获批；页面当前只显示明确标注的占位图，不能对外宣称视觉资产完成。

## Current → Target Delta Matrix

| 范围 | 修改前 | Word V1.5 目标 | 2026-07-13 状态 |
| --- | --- | --- | --- |
| Discover 入口 | 已有基础入口卡，视觉和任务选择不稳定 | ACTIVE 03；沿用现有 Discover 结构，优先继续进行中任务 | 已完成：进行中优先、单 CTA、Beta/隐私说明；未重做 Discover 或新增 Tab |
| 事件列表/详情 | 基础列表；普通用户可能进入内部点位配置 | 无 ACTIVE Mockup；复用仓库 UI；正式用户直接进入寻找 | 已完成：普通用户逐条合法推进服务端节点后进入搜索；只有单人测试可进配置页 |
| 搜索 | 距离 + 基础地图；本地调试坐标可能残留 | ACTIVE 05；距离为主；地图只显示用户本人 | 已完成：无阿浪 marker/circle/polyline；旧测试缓存仅在严格测试模式生效 |
| 对话 | 通用聊天气泡 | 无 ACTIVE Mockup；角色与文字优先、固定选项、不得成为通用聊天机器人 | 已完成：移除通用聊天气泡；服务端进度恢复；未引入自由 AI 对话 |
| 陪伴 | 只显示终点区域，无真实步行路线 | 无 ACTIVE Mockup；复用现有页面，用户点击后才显示路线、距离、ETA | 已完成：仅 companion 及以后阶段返回终点；点击后调用腾讯步行路线；失败不阻断 5 米判断 |
| 结果/归档 | 结果与归档存在，但完成态恢复依赖档案列表 | 先看结果卡，再主动收录；未收录结果可恢复 | 已完成：`stage=result` 不自动归档；完成响应返回 `archiveId`；刷新继续服务端进度；结果日期取服务端到达/完成时间 |
| 状态权威 | 多数页面读服务端进度，搜索页存在陈旧 URL 风险 | `myProgress`/archive 是唯一权威 | 已完成：搜索、对话、陪伴、结果均用服务端阶段纠正陈旧页面 |
| 地图服务 | 逆解析 + IP 定位 | 复用腾讯地图，补 POI/联想/步行路线 | 已完成：沿用 `TENCENT_MAP_KEY` 与 `/api/geo`，未新增 SDK/provider/Key；POI/路线按用户限流，登录前逆解析/IP 定位共享按 IP 限流 |
| 坐标契约 | Alang JSON 混用 `lat/lng` 与 `latitude/longitude` | GCJ-02；统一 `latitude/longitude` | 已完成：运行时/API 统一；持久化旧 JSON 在解析边界兼容归一化 |
| 调试安全 | Debug API 已有测试门禁，客户端配置仍需 fail-closed | 普通用户不可到达内部点位配置 | 已完成：`APP_MODE` 未设置也按 production；生产残留 single-test env 不下发 test marker；非测试 Debug API 返回 404 |
| 我的 / 我的故事 | 已有入口与阿浪故事详情 | ACTIVE 06/07；保留导航与成长档案结构，只接真实数据 | 已完成：复用既有 Profile/故事入口；未重做“我的”，未修改伙伴/装备完整页 |
| 视觉参考治理 | 历史图混有当前、未来和废弃概念 | 只有 ACTIVE 03/05/06/07 可执行；04/08 FUTURE，09 REMOVED | 已完成：未新增多 NPC 地图、伙伴装备页或探索地图；无 ACTIVE 图的页面不再标成 Reference 延展 |
| 视觉资产 | 三张通用占位图 | 按 manifest 接入获批资产；placeholder 不算完成 | **未完成**：已有 manifest、安全区与 Reference 状态，但批准状态仍为 `awaiting-approved-art` |

## 复用与不变项

- 复用原生 Taro/WeChat `<Map>` 渲染，不引入腾讯地图 Mini Program SDK。
- 复用服务端腾讯 WebService Key：`TENCENT_MAP_KEY`。
- JoyJoin 的 5 米、连续稳定点位判断仍是到达真值；腾讯路线只负责展示路线、距离和 ETA。
- 搜索阶段不会向客户端发送搜索目标、剧情 GPS trigger 或陪伴终点。
- 剧情进度与档案继续持久化在 `alang_mission_progress`、`alang_story_archives`。
- 未修改 Blind Box、Center、Profile 主架构、Tab、匹配算法、支付或数据库 DDL。
- 明确排除 FUTURE 04 多 NPC 地图、FUTURE 08 伙伴/装备完整页与 REMOVED 09 探索地图。

## 尚待外部验收

1. 设计团队提供并批准四类正式 WebP 资产；批准前保留“场景示意”标签。
2. 在微信开发者工具和至少一台 iOS、一台 Android 真机验证定位授权、实时定位、原生 Map polyline、弱网和后台恢复。
3. 部署环境确认 `TENCENT_MAP_KEY` 的 WebService 白名单/配额；不得把 Key 下发到小程序。

## 仓库级已知门禁

- 微信生产编译已成功完成 864 个模块；Alang 子包为 135.6KiB，低于 1.8MB 门禁。
- 当前主包仍为 3.27MB，超过 2MB；最大来源是 1.46MB 的共享 assets。该问题早于本次 Alang 改动，需要单独进行跨功能 CDN/主包瘦身，不能通过删除 Alang 子包规避。
- `check-package-size.mjs` 已修正为逐个子包比较上限，不再把所有子包的合计体积误报为单个子包超限。
