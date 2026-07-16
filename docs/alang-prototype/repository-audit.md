# 闪现 NPC｜阿浪 V1.7 — 当前实现差异审计

> 审计日期：2026-07-15
>
> 产品基准：`JoyJoin_Master_PRD_V1.7_Codex执行版_强调Mockup未完全落地.docx`
>
> Scope ID：`ALANG-V17-VISUAL-ALIGNMENT`
>
> 代码范围：Mini Program、Server、Shared；不改匹配、支付或现有 Tab 架构；只读取真实盲盒完成事实

## 结论

阿浪已具备服务端剧情状态机、5 米稳定到达、故事归档、断点恢复和当前页受控复测能力，但“路由存在/功能可用”不等于视觉验收完成。按 V1.7 Word、2026-07-15 产品覆盖决定与代码逐项比对，最终 H5 production build 为 1,393 modules；Profile、Discover 闪现卡、阿浪搜索页、私人连续故事和“我的形象”已完成五页同尺寸最新首轮复截图评审。本文按复截图记录 Fidelity，不把 H5 结果写成 F4 或真机证据。

未达到 F4 的共同原因是：微信原生 Map、TabBar、安全区、真机定位和多设备矩阵仍未验收；阿浪正式人物/场景图仍为 `awaiting-approved-art`；私人连续故事仍需 staging 真实 MiniMax/DeepSeek smoke。Profile 与“我的形象”最新复截图均为 F3；clipping-aware 扫描为“我的形象”记录 0 个阻断项，此前 sticky 保存栏与下装/鞋履标签的 2 处报告是标签已被滚动视口裁切后仍参与碰撞计算导致的误报。Profile 的 12 张 512×768 透明像素角色已完成本地资源校验，批准的基础角色已自带初始服装；穿脱、保存和库存仍是服务端状态。正式单品分层 raster 尚未审批时不显示紫色几何块、code-native 覆盖层或其他伪造装备图。

### Fidelity 判定口径

| 等级 | 判定 |
| --- | --- |
| F0 | 页面或入口未实现 |
| F1 | 功能已接入，但结构与目标差距明显 |
| F2 | 主要结构接近，视觉层级、资产或关键状态仍不完整 |
| F3 | 结构、数据与主要视觉层级基本一致；仍有正式资产或真机验收差异 |
| F4 | 正式资产、全部状态、同尺寸截图与微信真机均通过验收 |

> 本文不把 F1/F2 写成“已完成”。2026-07-15 最新复截图支持 Profile、Discover、Search、私人连续故事与我的形象均为 F3，且我的形象 clipping-aware 扫描为 0 个阻断项。正式装备美术、微信真机、设备矩阵及各页剩余发布条件通过前，不得提升到 F4。

## 阶段 A｜编码前差异矩阵

### 1. Profile / “我的”页（APPROVED TARGET 06）

| 审计项 | 编码前结论 |
| --- | --- |
| Current State | 旧版以浅色资料卡和功能列表为主；人格形象、成长数据、故事入口、徽章与服务入口没有形成一个与 V1.7 相同的身份舞台。`profileRedesignEnabled` 已存在，但视觉回滚与 V1.7 数据请求的边界需要收紧。 |
| Target Mockup | 按 2026-07-15 产品覆盖：12 个 canonical V4 动物分别使用仅限新版 Profile/“我的形象”的 512×768 透明全身拟人像素角色；角色层不带 UI、城市或霓虹背景，页面沿用现有暖白/紫色品牌界面。展示真实潮流值、活动数、连接数和资料完成度，并提供私人连续故事、“我的形象”、徽章、服务、设置和既有 TabBar。`profileRedesignEnabled=true` 展示新版；`false` 展示真实数据简洁页。 |
| Structural Gap | 旧阿浪档案卡和“装备筹备中”桥接入口不能满足目标；需要拆分为私人连续故事入口与真实“我的形象”入口，并让 `profilePixelAvatarEnabled`、`equipmentRewardsEnabled`、`personalStoryEnabled` 独立控制各自表面。 |
| Visual Gap | 需要在现有暖白/紫色 Profile 结构内让透明像素伙伴、真实潮流值进度、独立统计卡、私人故事横幅及“我的形象”入口形成清晰主次；不引入紫色赛博/霓虹城市舞台，也不能继续使用普通头像或旧档案列表作为视觉主轴。 |
| Asset Gap | 12 张 512×768 透明角色 WebP 已通过本地资源校验并写入 CDN manifest，远端上传/逐 URL 验证尚待成功 workflow；基础角色图已包含初始服装，页面有 character-only fallback。正式四槽 equipment raster 尚未审批/发布；未发布单品保持服务端穿搭状态但不绘制任何伪造装备层。阿浪人物、区域、找到后和结果场景正式图仍未获批，不能与 Profile 授权混用。 |
| Data Gap | 需要真实 gamification、活动、连接、资料完成度、本人衣橱/穿搭及私人故事数据；不能照抄 Mockup 样例。`profileRedesignEnabled=false` 时停止 Profile 专属请求，三个子开关仍必须互相独立。 |

### 2. Discover 闪现卡（ACTIVE 03）

| 审计项 | 编码前结论 |
| --- | --- |
| Current State | Discover 已有阿浪入口和真实任务状态，但旧卡片主要是一条隐私说明，比例、标题/副文案/CTA 层级及继续状态表达与 ACTIVE 03 不足以视为视觉落地。 |
| Target Mockup | 只校正现有 Discover 中的紧凑单 NPC 闪现卡：明确“闪现 Beta”、阿浪故事标题、副文案、三个说明 chip 和一个主 CTA；与正式活动卡区分，不让地图、距离或时间抢主视觉，不重做整页 Discover。 |
| Structural Gap | 缺少三段短说明、进行中优先文案与统一单 CTA；卡片内容层级需要压缩到一个可扫描入口，而不是任务详情或地图预览。 |
| Visual Gap | 卡片图文比例、留白、主标题权重和 CTA 面积与目标有差距；旧隐私条过长，不能承担 Target 中的轻量状态标签作用。 |
| Asset Gap | 正式阿浪人物/场景横图未获批。Word 参考中若出现多 NPC 城市地图，只能作为整体气氛参考；它与 FUTURE 04/REMOVED 09 冲突，不能复刻为功能或地图资产。 |
| Data Gap | 标题、进度和 CTA 必须来自真实 mission/myProgress；未开始与继续中需要分支，不能写死“继续”或伪造附近角色数量。 |

### 3. 阿浪搜索页（ACTIVE 05）

| 审计项 | 编码前结论 |
| --- | --- |
| Current State | 目标坐标已保密，原生 Map 只显示用户，距离与定位状态已有真实数据；但地图和功能状态仍偏工具化，区域横幅、距离主视觉、雷达层级和“找到后”说明没有完整对齐 Mockup。 |
| Target Mockup | “区域提示 → 静态雷达/真实距离与信号 → 找到后会发生什么 → 辅助地图”的顺序。距离数字为主视觉；腾讯地图只辅助确认用户所在位置；不显示精确目标 Marker、路线或搜索目标坐标。 |
| Structural Gap | 缺少首屏区域提示卡、静态非地理雷达、找到后行动说明及可控的辅助地图入口；异常/授权恢复需要留在主流程附近。 |
| Visual Gap | 真实距离和信号强度不够突出；地图容易抢占首屏；定位精度、靠近提示、CTA 与 5 米到达规则的层级需要重新组织。 |
| Asset Gap | 正式区域横幅与“找到后”阿浪场景图未获批；Word 中阿浪角色与南头古城插画不能直接从 Mockup 导出使用。 |
| Data Gap | 距离、精度、定位状态和服务端 stage 必须是真实值；搜索阶段响应不得包含 target/routeDestination。Mockup 的 `84m/300m` 仅为示例，不能成为写死数据。 |

### 4. 我的故事页（ACTIVE 07 视觉语气 + 2026-07-15 产品覆盖）

| 审计项 | 编码前结论 |
| --- | --- |
| Current State | 已有 archive 列表与详情跳转，但缺少真实汇总、筛选、时间线和“继续中的故事”层级；列表更接近任务记录，未充分表达用户经历路径。 |
| Target Mockup | 仅保留封面、时间线和“故事持续生长”的视觉语气。产品权威改为私人连续故事：surface 开启时由用户主动更新，一次真实经历追加一章；provider 故障不删除旧章节。 |
| Structural Gap | 旧 archive 列表不能承载 durable AI 更新、追加章节、失败保留历史或只有进入页面才显示状态的要求，需要独立 Profile-linked 页面和服务端 job。 |
| Visual Gap | 需要从活动卡/筛选统计改为连续小说封面、最后更新时间、单一更新动作、由旧到新的章节时间线和原位全文阅读。 |
| Asset Gap | 不新增多故事独立缩略图字段；当前封面使用 code-native 书页/星光视觉，不把 Word Mockup 当成可发布资产。 |
| Data Gap | 只允许服务端验证的非 Debug completed 阿浪与完整盲盒经历。盲盒以本人的 group outcome 锁定分组，并额外要求本人已匹配、非测试未取消、活动已结束且该活动本人的 `event_feedback.completedAt` 非空；group outcome 单独不足。不读取 GPS、姓名、聊天、反馈正文/分数或客户端关键词。 |

## 阶段 B｜实现后验收矩阵

| 页面 | 已一致项 | 剩余差异 | Placeholder / 场景示意 | 技术限制 | Fidelity |
| --- | --- | --- | --- | --- | --- |
| Profile / “我的” | 已形成身份舞台、12 人格透明像素伙伴、真实潮流值/等级、活动数、连接数、资料完成度、私人故事、我的形象、徽章、服务与设置；保留既有 TabBar。`profileRedesignEnabled=false` 显示真实数据简洁页并停止专属请求。 | 最新同尺寸复截图的结构、数据与主要视觉层级已通过 F3；微信真机仍待复核。 | 12 张 512×768 透明角色已完成本地校验和 CDN manifest 接线；远端发布未在本审计中确认，基础角色已含初始服装，图片失败使用 character-only fallback。 | 微信自定义 TabBar、安全区和真实长列表仍需真机；真实数据不会复制 Mockup 样例值。 | **F3（最新复截图）** |
| Discover 闪现卡 | 已落地紧凑单 NPC 卡、`闪现 Beta`、故事标题/副文案、三个说明 chip、未开始/继续中 CTA；与正式活动卡区分，卡内没有距离、时间、地图或目标坐标。 | 尚无获批阿浪人物/场景横图；Word 全屏参考中的多 NPC 地图构图没有复刻，因为属于明确排除范围。 | 当前使用通用礼盒角色场景，并显示“活动场景示意”。 | H5 仍不能验证微信原生 TabBar，且 Word 内嵌参考图本身不是统一设备尺寸。 | **F3（已截图）** |
| 阿浪搜索页 | 已按“区域提示 → 雷达/距离 → 找到后说明 → 辅助地图”排序；距离数字为主视觉，展示真实定位信号/精度；Map 只显示用户本人，搜索响应不含目标坐标，服务端 stage 仍纠正陈旧 URL。 | 正式南头古城/阿浪角色插画未获批；与 Mockup 的角色造型和场景质感仍有可见差异。 | 区域横幅和找到后插画分别标注“区域场景示意”“找到后场景示意”。 | H5 只能验证折叠地图入口，不能渲染和验收微信原生 Map、定位授权、前后台 GPS、5 米稳定到达；这些必须真机验证。 | **F3（已截图）** |
| 我的故事 | 已改为仅本人可见的连续小说：封面、最后更新时间、手动更新、从最早到最近的一次经历一章、原位展开全文；`personalStoryEnabled=true` 且 provider 暂不可用或更新失败时旧章继续可读，不显示“已生成/待续写”统计。开关为 `false` 时入口和接口在访问新表前关闭。 | 最新同尺寸复截图的主要视觉层级已通过 F3；staging 真实 provider 与多次断点更新 smoke 仍待完成。 | code-native 书页/星光封面；没有独立故事缩略图字段。 | 模型输出必须通过 no-embellishment 校验，事实稀少时章节会刻意短于普通小说。 | **F3（最新复截图）** |
| 我的形象 | 已实现 12 个透明全身拟人像素动物、四槽穿脱草稿、显式版本保存、初始装备、永久手动抽取、80/20 池、第 4 抽新品保底、碎片与无现金商店；沿用现有暖白/紫色 UI。 | 最新复截图经 clipping-aware scanner 验证为 0 个阻断项；此前 sticky 保存栏与下装、鞋履标签的 2 处报告是滚动视口裁切后的误报。正式四槽 equipment raster 尚未审批/发布，因此仍不能评为 F4。 | 基础角色使用 CDN manifest 路径 + character-only fallback，且已自带初始服装；装备状态保存在服务端，未发布单品不绘制伪造几何/代码覆盖层。 | 迁移和 seed 必须先于开关；新场地需重跑幂等 seed 或由管理流程创建池。 | **F3（最新复截图）** |

### F4 阻断项

1. 五张 390×844 CSS viewport、2× 输出的 780×1688 PNG 已完成最新复截图复核；Profile、Discover、Search、我的故事和我的形象均为 F3。我的形象 clipping-aware 扫描为 0 个阻断项，此前 2 处 sticky overlap 为滚动裁切误报。设计团队仍需批准阿浪事件横图、搜索区域图、找到后图、结果/故事图，并更新 manifest 状态；正式分层装备 raster 也仍待审批，获批前只显示自带初始服装的基础角色。
2. 在微信开发者工具及至少一台 iOS、一台 Android 上验证 TabBar、安全区、字体、长列表、定位授权、原生 Map、弱网和前后台恢复。
3. 正式数据联调后复核长标题、零章节、多章节、断点续写、provider 失败、装备抽取/保存和错误恢复状态。

> 已生成并完成最新复截图复核：`profile-v17`、`discover-alang-v17`、`alang-search-v17`、`personal-story-v17`、`my-image-v17`。五页统一使用 390×844 CSS viewport、2× device scale，输出 780×1688 PNG；Discover 保留上方页面层级和下方正式活动卡的全视口。截图位于仓库外；当前五页均为 F3，且不能替代设备验收。Word 参考图比例不同，不能靠拉伸伪造“同尺寸”。

## 其他功能、安全与复用状态

| 范围 | 当前状态 |
| --- | --- |
| 服务端状态权威 | `GET /api/alang/missions/:slug` 的 `myProgress`/archive 是阶段权威；搜索、对话、陪伴、结果均会从陈旧 URL 纠正到服务端阶段。 |
| 结果与归档 | `stage=result` 先展示结果，不自动归档；用户主动收录后生成 archive，刷新仍从服务端恢复。 |
| 同账号复测 | `POST /api/alang/debug/missions/:slug/reset` 在事务内只删除当前 acting user、指定 mission 的 progress 及其对应测试 archive；幂等返回删除数量，不能通过 body 传入其他 userId。 |
| Debug 权限 | Reset 在非 single-test、production 或 `APP_MODE` 缺失时返回 **403**；其他内部 Debug 路由继续按安全策略返回 **404**。服务端同时验证 `alangEnabled` 与 single-test 条件，不能只靠前端隐藏。 |
| 地图复用 | 继续使用 Taro/WeChat 原生 `<Map>` 和现有 `/api/geo`；腾讯 WebService 继续复用 `TENCENT_MAP_KEY`，没有新增 SDK、provider、Key 或第二套坐标转换。 |
| 坐标与到达 | 公共 DTO 使用 GCJ-02 `latitude/longitude`；旧 `{lat,lng}` 只在读取边界归一化。JoyJoin 服务端固定 5 米连续稳定判定仍是到达真值；腾讯路线只负责辅助距离/ETA。 |
| 搜索保密 | 搜索阶段不向客户端发送目标、剧情 GPS trigger 或陪伴终点，也不渲染目标 Marker/circle/polyline。`routeDestination` 只从 companion 阶段开始披露。 |

## 正式素材与场景示意清单

| 使用位置 | 当前资产状态 | 升级条件 |
| --- | --- | --- |
| Profile 像素人格 Hero | 12 张 Profile-only 512×768 透明全身拟人动物 WebP；本地校验 473,844 bytes；沿用现有暖白/紫色 UI；character-only code-native fallback | CDN workflow 上传并逐 URL 验证；不新增城市/霓虹场景 |
| Profile “我的故事”横幅 | code-native 私人书页/星光封面 | 不依赖多故事缩略图字段 |
| Discover 闪现卡 | `awaiting-approved-art`，标注“活动场景示意” | 获批阿浪事件横图 WebP |
| 搜索区域横幅 | `awaiting-approved-art`，标注“区域场景示意” | 获批区域图 WebP |
| 找到后说明卡 | `awaiting-approved-art`，标注“找到后场景示意” | 获批阿浪状态图 WebP |
| 我的形象地点装备 | 基础角色已含初始服装；穿搭状态真实保存，未发布单品不绘制任何假层 | 获批并发布后才登记按 archetype/item 的 CDN 透明 raster 分层图 |

## 明确不在 V1.7 本轮执行范围

- **FUTURE 04**：多 NPC 地图/附近角色地图。
- **FUTURE 08 原完整方案**：未照搬套装、付费商店、复杂伙伴系统或 Word 全屏细节；只实现 2026-07-15 明确授权的 Profile-only 最小形象/装备闭环。
- **REMOVED 09**：探索地图；不得恢复路由、导航、组件或引用 Mockup 地图来变相实现。
- 精确搜索路线、目标 Marker、多 NPC 探索、第二套地图 client/Key/坐标转换。
- 多故事独立缩略图字段、重复 archive 伪装复测、测试历史列表与批量重置。

## 仓库级已知门禁

- P0 复测阶段的微信编译快照为 868 个模块、Alang 子包 **158.7KiB**；V1.7 后续记录为 **172.9KiB**，两者均低于 1.8MB 子包门禁。最终提交仍以根任务最后一次 package check 为准。
- 当前最终干净提交的实际主包 raw 文件树为 **3.268MiB**；现有检查器漏算部分根文件后选取的 raw 为 **3.215MiB**，本地 Deflate 估算为 **1.928MiB**，尚未获得微信官方上传预检结论。正式状态仍为 BLOCK；最大来源是约 1.46MB 的共享 assets。该问题早于本轮阿浪视觉改动，需要按主包审计单独治理，不能通过删除 Alang 子包规避。
- `check-package-size.mjs` 已按每个子包分别比较上限，不再把所有子包的合计体积误报为某一个子包超限。

## 完成度全流程审计

五张 780×1688 PNG 已由 `profile-v17`、`discover-alang-v17`、`alang-search-v17`、`personal-story-v17`、`my-image-v17` 生成并完成最新复截图人工复核。结果为 Profile/Discover/Search/私人连续故事/我的形象均为 F3；我的形象 clipping-aware 扫描为 0 个阻断项。设备验证未完成，因此不预填 F4 或新的 Completeness 总分。

代码审阅已确认的非截图事实包括：服务端阶段恢复、搜索坐标保密、5 米到达权威、复测权限、私人故事追加边界、严格盲盒参与证明、Profile 回滚开关、透明角色 CDN/fallback，以及穿脱/保存/库存的服务端状态。批准的基础角色已自带初始服装；装备 raster 未审批时不再提供紫色几何或 code-native 可见降级。我的形象最新 clipping-aware 扫描为 0 个阻断项，此前 2 处 sticky overlap 是滚动区域裁切误报；长页裁切、角色占比、底部安全区和五页间一致性仍需真机复核。

### ROI 排序缺口

| 优先级 | 缺口 | 影响 | 工作量 | 象限 | 处理建议 |
| ---: | --- | ---: | ---: | --- | --- |
| 1 | 微信原生 Map、TabBar、安全区、授权/弱网和前后台恢复的 iOS + Android 真机矩阵 | 5 | 3 | Do first | 进入 F4 前执行；不以 H5 代替 |
| 2 | 阿浪事件横图、区域图、找到后图、结果/故事图仍未获批 | 5 | 4 | Schedule | 等设计审批后替换 manifest；不得自行生成正式素材 |
| 3 | 主包测量链和 2MB 余量 | 5 | 5 | Schedule / 独立项目 | 按 `docs/package-size/main-package-audit.md` 分批治理，不混入本轮业务行为 |
| 4 | 长标题、零章节、多章节、断点续写、provider 失败、故事开关关闭、装备抽取与保存冲突的 staging 真数据联调 | 5 | 3 | Do first | 上线前使用真实 provider、真实参与记录和多轮更新复核；开关关闭时验证入口/API 不访问新表 |
| 5 | 每故事独立缩略图 | 2 | 5 | Skip | 明确不在本轮范围，只保留后续 schema 建议 |

```text
           Impact ↑
           ┌─────────────────────┐
  Do first │ 真机矩阵 / 真数据态 │ 正式美术 / 主包治理  Schedule
           ├─────────────────────┤
Low-hanging│ —                   │ 独立缩略图字段       Skip
           └─────────────────────┘  Effort →
```

完成度结论：**五页最新复截图已完成，Profile/Discover/Search/私人连续故事/我的形象均为 F3；我的形象 clipping-aware 扫描为 0 个阻断项，此前 2 处 overlap 为滚动裁切误报。正式分层装备美术及微信真机/设备验收完成前，F4 仍不可宣称完成。**

## 性能审计

| 维度 | 分数 | 证据 |
| --- | ---: | --- |
| 流畅度 | 7/10 | 搜索页仅固定渲染 4 格信号条；私人故事为永久追加章节列表，需要继续进行长列表滚动和多章展开的真机性能验证。现有动画均提供 reduced-motion，暂无 Canvas 或非合成动画告警 |
| 速度 | 7/10 | Alang、私人故事与“我的形象”均位于子包；`profileRedesignEnabled=false` 时停止 gamification/equipment/personal-story 专属请求。H5 与 WeChat 已完成生产编译，但仍缺真机 TTI 轨迹 |
| 设备适配 | 7/10 | rpx、ScrollView、安全区、原生定位/Map 和 reduced-motion 路径齐全；仍待多机型验证 |
| 内存安全 | 7/10 | 本轮无 Canvas、长驻监听、定时器或大图数组；地图按用户点击展开，查询缓存有边界 |
| 网络韧性 | 6/10 | 五页具备加载/错误/重试，搜索定位具备权限/精度恢复；未完成 Slow 3G/4G 真机压测 |
| 包体积 | 2/10 | 最新已记录的 V1.7 Alang 子包为 172.9KiB，通过子包门禁；主包实际 raw 3.268MiB、检查器选取 raw 3.215MiB、本地 Deflate 估算 1.928MiB，官方预检未完成，正式 gate 不通过 |
| **合计** | **36/60** | **BLOCK：唯一低于 4 分的维度是既有主包门禁** |

自动收集器的两个提示均已人工排除：搜索页的 `.map()` 只渲染固定 4 根信号柱，不是 50+ 条列表；`profileConstants.ts` 是 tabBar Profile 的 helper，不是新主包页面。若只评价本轮新增/修改内容的包归属（Alang 172.9KiB；12 张 Profile WebP 为 CDN-only manifest 资源并由构建检查阻止进入 dist），范围内分数为 42/60（WARN）；仓库正式性能结论仍保持 **BLOCK**，不以范围说明掩盖主包问题。
