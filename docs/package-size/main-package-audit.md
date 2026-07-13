# 微信小程序主包体积审计

> 审计日期：2026-07-13
>
> 审计对象：`apps/mini-program` 当前工作区的微信生产构建产物
>
> 审计性质：只读；本报告没有迁移、删除或替换任何业务资源
>
> 阿浪边界：以 V1.5 清理版为准，不新增阿浪功能，不实现 FUTURE 04/08，不恢复 REMOVED 09

## 1. 结论摘要

当前构建的“3.27 MB”需要先校正口径：

| 口径 | 文件数 | 字节 | MiB | 结论 |
| --- | ---: | ---: | ---: | --- |
| 现有 `check-package-size.mjs` 选取范围 | 215 | 3,427,498 | 3.269 | 这是原始文件总和，不是真实 zip |
| 实际主包文件树（包含 `custom-tab-bar`） | 224 | 3,483,782 | 3.322 | 原始体积，超过 2 MiB |
| 本机 .NET Deflate 估算（包含 `custom-tab-bar`） | 224 | 2,032,312 | 1.938 | 低于 2 MiB，但只剩 64,840 B 余量 |

本机没有 `zip` 命令。现有检查器压缩失败后会回退到原始目录体积，却仍把结果标成 `Main package (zip)`，因此构建日志中的“3.27 MB compressed”并不成立。另一方面，Deflate 结果也不是微信官方上传结果；最终裁决必须由微信开发者工具或 `miniprogram-ci` 的真实上传预检给出。在官方复核之前，本报告仍把主包状态标为 **BLOCK：测量链不可靠且压缩余量过小**。

阿浪子包本次生产构建为 36 个文件、139,979 B（136.7 KiB），远低于 1.8 MiB 子包门禁。主包问题不是阿浪子包代码本身造成的，主要来源是根级共享 bundle 与被复制到根 `assets/` 的资源。

## 2. 审计方法与边界

主包文件树按以下规则计算：

1. 读取 `dist/app.json`，排除 6 个 `subPackages.root`：`pages/onboarding`、`pages/profile-linked`、`pages/icebreaker-session`、`pages/matching-status`、`pages/pool-registration`、`pages/alang`。
2. 保留根级运行时文件、其余 `pages/*`、根级 `assets/*` 和 `custom-tab-bar/*`。
3. 逐文件统计原始字节，并用 SHA-256 查找完全相同的重复内容。
4. 另以 .NET Deflate 生成压缩估算。该值只用于判断数量级和安全余量，不代替微信官方测量。

现有检查器还漏算了 `custom-tab-bar` 的 55,841 B，以及 3 个 `custom-wrapper.*` 文件的 443 B。审计采用包含它们的实际主包边界。

## 3. 主包最大 30 个文件

下表按原始字节降序排列。“可迁”只表示依赖边界允许，当前没有执行迁移。

| # | 文件 | 字节 | 分类 | 依赖判断 / 建议 |
| ---: | --- | ---: | --- | --- |
| 1 | `common.js` | 802,007 | 共享 JS | 主包真实共享依赖；不能直接搬走，应拆窄 API barrel 与全局入口后按 bundle diff 验证 |
| 2 | `taro.js` | 212,611 | JS runtime | Taro 核心，不能迁移 |
| 3 | `common.wxss` | 138,223 | 共享样式 | 多主包页面真实依赖；按页面拆样式，不能整体复制到子包 |
| 4 | `vendors.js` | 100,941 | JS runtime | React/Taro 等依赖，不能直接迁移 |
| 5 | `assets/fonts/Alimama/AlimamaFangYuanTiVF-Thin-minimal.woff2` | 68,032 | 字体 | `app.ts -> loadBrandFonts()` 首屏真实依赖；深度方案可评估 CDN/更小字形集 |
| 6 | `base.wxml` | 66,570 | 共享模板 | Taro 基础模板，不能直接迁移 |
| 7 | `assets/mascot/xiaoyue-coach.webp` | 65,182 | 图片 | 主包 `city-unlock` 使用 coach 状态；不能直接迁移 |
| 8 | `pages/discover/index.js` | 65,014 | JS | tabBar 页面，必须在主包；应拆除不必要的静态依赖 |
| 9 | `assets/mascot/xiaoyue-listening.webp` | 64,186 | 图片 | 由全局 manifest/预加载链保留；可在状态使用审计后改 CDN 或随子包 |
| 10 | `assets/lovart/alang-found-scene-placeholder.webp` | 60,006 | 图片 | 仅阿浪子包使用；可迁阿浪子包或与相同占位图去重 |
| 11 | `assets/lovart/alang-event-card-placeholder.webp` | 60,006 | 图片 | Discover ACTIVE 03 真实依赖；必须留主包或经审批后走 CDN |
| 12 | `assets/lovart/alang-result-placeholder.webp` | 60,006 | 图片 | 仅阿浪子包使用；可迁阿浪子包或与相同占位图去重 |
| 13 | `assets/xiaoyue-expressions/xiaoyue-home-welcome.webp` | 49,356 | 图片 | Landing 与 Discover 真实依赖，不能直接迁移 |
| 14 | `assets/mascot/xiaoyue-idle.webp` | 48,050 | 图片 | 全局 manifest/预加载链；可按状态拆分或 CDN 化 |
| 15 | `pages/squad-unboxing/index.js` | 43,768 | JS | 非 tab 页；中等方案可归入 matching 子包，须完整回归导航和深链 |
| 16 | `pages/discover/index.wxss` | 41,865 | WXSS | tabBar 页面真实依赖 |
| 17 | `pages/blind-box-payment/index.js` | 41,715 | JS | 非 tab 页；可归入支付/活动子包 |
| 18 | `pages/event-ticket-payment/index.js` | 39,444 | JS | 非 tab 页；可归入支付/活动子包 |
| 19 | `assets/xiaoyue-expressions/xiaoyue-loading-system.webp` | 38,944 | 图片 | 全局 Loading 与 onboarding fallback 使用；可评估 CDN-first 小 fallback |
| 20 | `pages/squad-unboxing/index.wxss` | 31,348 | WXSS | 随 squad 页面迁移；本轮不改其现有 dirty 文件 |
| 21 | `pages/blind-box-payment/index.wxss` | 30,431 | WXSS | 随支付页面迁移 |
| 22 | `assets/mascot/xiaoyue-thinking.webp` | 28,096 | 图片 | 全局 manifest/预加载链；可按状态拆分或 CDN 化 |
| 23 | `pages/event-ticket-payment/index.wxss` | 24,570 | WXSS | 随支付页面迁移 |
| 24 | `assets/lovart/puzzle/lovart-puzzle-piece-02-20260701-v1.webp` | 24,556 | 图片 | 仅 matching-status 使用，可直接迁现有 matching 子包 |
| 25 | `assets/lovart/puzzle/lovart-puzzle-piece-05-20260701-v1.webp` | 24,230 | 图片 | 仅 matching-status 使用，可直接迁现有 matching 子包 |
| 26 | `assets/lovart/puzzle/lovart-puzzle-piece-04-20260701-v1.webp` | 22,958 | 图片 | 仅 matching-status 使用，可直接迁现有 matching 子包 |
| 27 | `custom-tab-bar/__tests__/tabBarBehavior.test.ts` | 22,178 | 调试/测试产物 | 明确错误入包；copy 时必须排除 `__tests__` |
| 28 | `assets/lovart/puzzle/lovart-puzzle-piece-03-20260701-v1.webp` | 22,150 | 图片 | 仅 matching-status 使用，可直接迁现有 matching 子包 |
| 29 | `pages/profile/index.wxss` | 21,312 | WXSS | tabBar 页面真实依赖 |
| 30 | `assets/mascot/xiaoyue-welcome.webp` | 20,838 | 图片 | 全局 manifest/预加载链；可按状态使用情况拆分 |

六张 matching puzzle 图片合计 130,504 B，另外两张虽未进入 Top 30，也应作为同一迁移单元处理。

## 4. 分类统计

### 4.1 互斥文件类型

| 分类 | 文件数 | 字节 | 占实际主包 |
| --- | ---: | ---: | ---: |
| JS + WXS | 26 | 1,463,536 | 42.01% |
| 图片 | 129 | 1,448,017 | 41.56% |
| WXSS | 21 | 376,702 | 10.81% |
| 字体 | 2 | 82,052 | 2.35% |
| WXML | 21 | 72,800 | 2.09% |
| JSON | 23 | 15,051 | 0.43% |
| 意外进入产物的 TypeScript | 2 | 25,624 | 0.74% |
| **合计** | **224** | **3,483,782** | **100%** |

图片细分为 115 个 WebP（1,349,934 B）和 14 个 PNG（98,083 B）；当前主包没有 SVG。路径桶为：根运行时 1,354,700 B、`assets` 1,534,232 B、主包页面 539,009 B、`custom-tab-bar` 55,841 B。

### 4.2 交叉分析项

以下指标会与上表重叠，用于定位原因，不能再次相加：

| 分析项 | 字节 | 说明 |
| --- | ---: | --- |
| 共享组件/模板 bundle | 1,007,651 | `common.js`、`common.wxss`、`base.wxml`、`comp.*`、`custom-wrapper.*` |
| Taro/vendors runtime | 315,197 | `taro.js`、`vendors.js`、`babelHelpers.js`、`utils.wxs` |
| 完全重复内容 | 121,292 | 三张相同阿浪占位图 + Taro 生成的相同 WXML |
| source map | 0 | 未发现 `.map` |
| 测试/调试源码污染 | 25,624 | `custom-tab-bar/__tests__/*.test.ts` |

## 5. 重复、错误引用与可压缩项

### 5.1 完全重复

- 三张阿浪占位图的 SHA-256 都是 `5FB2B63BCA417045F038D43E832E7945233FD2008435D516AA16FBAFF547D064`，每张 60,006 B。保留一份即可表达当前“正式美术待审批”的状态，重复开销为 120,012 B。后续正式素材仍必须走审批，本审计不生成、不替换美术。
- 17 个主包页面的 `index.wxml` 各 80 B 且内容相同，重复开销 1,280 B。这是 Taro 生成模板，不应手工删除，收益也可以忽略。
- 构建有 tab 图标“覆盖同名 emitted file”的警告，但最终目录只有一份对应文件；这是 copy/emit 冲突，不是当前物理字节重复。应在构建配置中消除双来源，避免未来内容不一致。

### 5.2 明确错误产物

`config/index.ts` 把整个 `src/native-custom-tab-bar/` 原样复制到生产目录，连同：

- `custom-tab-bar/__tests__/tabBarBehavior.test.ts`：22,178 B
- `custom-tab-bar/__tests__/tabBarStructure.test.ts`：3,446 B

共 25,624 B。它们不是运行时依赖，可以在后续最低风险修复中从 copy 输入排除。

### 5.3 图片、字体与 JSON

- 115 个图片已经是 WebP。优先级应是“纠正包归属、去重、按需/CDN”，不是再次盲目转码。
- tabBar 的 PNG 路径由 `app.json` / 原生 tabBar 直接使用，不应改成 WebP 或 SVG；只能做无损压缩、调色板和尺寸复核。
- auction PNG（23,233 B）只服务 icebreaker 子包，迁包比转格式更低风险。
- QR、品牌标识和 tabBar notch 是主包真实依赖；QR 应保持无损，不建议 SVG 化。
- 两个字体共 82,052 B。Alimama 已是 minimal subset；进一步优化应先统计真实字符集，或改为 CDN `loadFontFace`，并保留系统字体 fallback。
- JSON 仅 15,051 B，不是主要矛盾；其中精灵 manifest 有运行时用途，不值得为体积手工压缩字段。

## 6. app.json、tabBar 与静态依赖链

### 6.1 页面归属

`dist/app.json` 当前把 17 个页面放在主包。以下 5 个在 `tabBar.list`，必须保留主包：

- `pages/discover/index`
- `pages/events/index`
- `pages/connections/index`
- `pages/profile/index`
- `pages/center-hub/index`

`center-hub` 虽由自定义中间按钮展示，仍必须登记在 `tabBar.list`，否则 `switchTab` 会失败。`pages/index` 是启动页，也应留主包。`login` 与其余 10 个非 tab 页可以评估重新分包，但必须保持路由、冷启动、深链和支付恢复行为。

`preloadRule` 只决定何时预下载子包，不会把子包代码移入主包。`lazyCodeLoading: requiredComponents` 也不会自动切断 React/ESM 的静态 import。

### 6.2 全局静态链

`src/app.ts` 静态引入以下链，因而进入根级共享 bundle：

- `lib/api/api.ts`、`authSession` 与自动登录；
- 支付待处理恢复；
- `AuthProvider`、`DynamicAccentProvider`、`AchievementProvider`；
- `AchievementPopup`、`TabBarStateBridge`；
- 品牌字体加载；
- CDN 与 onboarding 资源预加载器。

这些并非都能直接搬到子包。可优化点是把非首屏预加载延后到空闲/对应页面，并将宽 API 文件拆成 auth、shell、events、payment、alang 等领域入口。

### 6.3 五个 tab 页强制进入主包的组件

| 主包页 | 主要静态链 | 判断 |
| --- | --- | --- |
| Discover | `HeroPromoBanner`、`VirtualList`、`OracleCard`、Location/City sheets、`SingleTestBanner`、`AlangDiscoverCard`、`LandingPage` | `AlangDiscoverCard` 是 ACTIVE 03 真实依赖；`LandingPage` 重复链需重点拆审 |
| Events | `FootprintOracleCard`、`EventSummaryCard`、倒计时/事件展示、milestone | tab 真实依赖 |
| Connections | `ArchetypeHead`、`XiaoyueEmptyState`、`JoyJoinIcon`、`Card` | tab 真实依赖 |
| Profile | `ArchetypeHead`、Button/Card、milestone、payment entry、阿浪入口 | tab 真实依赖；profile-linked 页面本身已在子包 |
| Center hub | `matchingNavigation`、`RichListCard`、Loading、`PageMorphWrapper` | tab 真实依赖 |

五页还共同引用 `lib/api/api.ts`、`prefetchEngine.ts`、`persistentCache.ts`、`onboardingRoutes.ts`、auth/session、`useCustomTabBarSync`、Loading/JoyJoinIcon 和 `@shared/api`。其中 `@shared/api` 是宽 barrel，`common.js` 已达 802,007 B。应先增加 bundle stats/metafile，再把调用改成领域 subpath；不能在没有差异证据时假设 tree-shaking 已经移除所有无关域。

Discover 还静态 import `../index/LandingPage`。该链继续引入 `PhaseIconCarousel`、`TestLoginSheet`、anonymous onboarding 与 landing 样式，和“未登录回独立 landing”的路由意图存在重复。拆除时需要轻量过渡态，避免认证解析期间闪屏，因此属于中等改造，不列入直接删除。

## 7. 资源迁移判定

### 7.1 可直接迁入现有子包

| 内容 | 原始字节 | 目标 | 备注 |
| --- | ---: | --- | --- |
| 6 张 matching puzzle WebP | 130,504 | `pages/matching-status` | 仅 matching-status 使用 |
| auction 3 张 PNG | 23,233 | `pages/icebreaker-session` | 仅 Auction phase 使用 |
| `custom-tier-icon.webp` | 1,698 | `pages/icebreaker-session` | 仅 tier selector 使用 |
| `status-waiting.webp` | 3,690 | `pages/icebreaker-session` | 当前明确直接引用在 icebreaker；迁前再跑动态 icon registry 检查 |
| `icon-calendar.webp` | 6,418 | `pages/pool-registration` | 当前明确由 pool registration 使用 |
| 阿浪 found/result 占位图 | 120,012 | `pages/alang` 或去重 | 仍保持占位状态；event-card 占位图留主包 |

`icon-location.webp`（4,478 B）同时由 pool-registration 与阿浪使用，不应只迁入一个子包。可选择 CDN，或在两个子包各放一份；体积决策应以实际压缩结果为准。

category/intent icons 主要服务 onboarding，但经 `JoyJoinIcon` 动态注册表可能被主包调用；迁移前必须跑使用追踪，不能仅凭目录名移动。

### 7.2 被主包页面真实依赖，不能直接迁移

- 5 个 tabBar 页面和启动页；
- tabBar PNG、notch、中心 logo；
- `alang-event-card-placeholder.webp`（Discover ACTIVE 03）；
- `xiaoyue-home-welcome.webp`（Landing/Discover）；
- `xiaoyue-coach.webp`（主包 city-unlock）；
- 当前全局品牌字体；
- Taro/runtime、全局 providers、认证与支付恢复链；
- 被两个以上主包入口共同使用的 UI 组件与样式。

### 7.3 可重新分包但不是“直接移动资源”

以下非 tab 页面可按领域重划：payment-verification、blind-box-payment、event-ticket-payment、event-detail、event-feedback、event-coordination、squad-unboxing、pool-group-detail、center-tab-empty、city-unlock。`login` 需要单独验证冷启动与认证回跳。

页面迁移会改变 app 配置、路由/深链、预加载和共享 chunk，必须分批完成。组队揭晓当前已有用户未提交改动与已知类型/测试问题，本轮不触碰；这里只记录未来包划分建议。

## 8. 三档优化方案

### A. 最低风险：稳定低于 2 MiB

目标：先让官方压缩结果低于 2 MiB，并保留至少 200 KiB 余量；不改变业务行为。

1. 修正体积检查器：跨平台生成真实压缩包；压缩器不可用时明确报“raw”，不能伪装成 zip；把 `custom-tab-bar` 与所有根文件纳入主包。
2. copy 排除 `custom-tab-bar/__tests__`，减少 25,624 B 原始体积。
3. 三张相同阿浪占位图去重，或把 found/result 随阿浪子包放置；最多减少主包 120,012 B，且不改变占位美术。
4. 把 puzzle、auction、custom-tier、pool calendar 等纯子包资源迁入现有子包。上述高置信资源与测试污染合计可从主包移出约 311,179 B 原始体积。
5. 每一小批都执行生产构建、微信开发者工具预览、页面直达和 CDN fallback 回归；达标后停止，不顺带做大规模页面迁移。

这组操作主要调整构建归属，不改剧情、支付、匹配或组队揭晓行为，是首选方案。

### B. 中等改造：重划页面与共享组件

目标：把主包压缩结果稳定到约 1.6–1.7 MiB，并降低 `common.js`。

1. 移除 Discover 对完整 `LandingPage` 的重复静态链，保留轻量认证过渡态。
2. 把 `@shared/api` 和 `lib/api/api.ts` 改为领域 subpath/import；用构建 metafile 对比 `common.js`，只保留有量化收益的拆分。
3. 建立 payment/event-flow 子包；将支付页、活动详情/反馈/协调页成组迁移。
4. 将 squad-unboxing、pool-group-detail 归入 matching 领域子包；等用户现有组队揭晓改动独立收口后再做。
5. 审查共享 UI：只有被两个以上主包入口使用的组件留 common；页面专用组件和样式跟随页面。

### C. 深度优化：CDN、按需加载与组件拆分

目标：主包压缩结果不高于约 1.5 MiB，为后续功能保留至少 500 KiB 余量。

1. 非首屏 mascot 状态、大图和可恢复图标改 CDN-first，仅保留极小可靠 fallback；tabBar 和关键首屏资源仍本地化。
2. 字体按字符集进一步子集化或 CDN `loadFontFace`，保留系统字体 fallback 和弱网策略。
3. 取消 `app.ts` 启动时全量 onboarding/CDN 预热，改为网络条件 + idle + 下一跳预测的按需预取。
4. 将宽 icon registry 拆成主包最小表与子包扩展表，避免动态路径迫使整套本地图标留根目录。
5. 在 CI 增加 bundle metafile/依赖可视化，以及“禁止 `__tests__`、`.map`、纯子包资产进入根目录”的门禁。

不建议把 `common.js` 整体复制到子包；那会制造重复打包。React/Taro 动态 import 也不能替代微信页面分包设计，必须以真实构建产物验证。

## 9. 验收门槛与后续事项

任何优化实施都至少满足：

- 微信开发者工具或 `miniprogram-ci` 确认主包压缩体积和总包体积；
- 5 个 tab 页面、启动/登录、支付恢复和全部深链可直达；
- 每个子包单独低于 1.8 MiB；
- `git diff --check`、小程序测试与生产构建通过；
- 弱网/CDN 失败仍有可接受 fallback；
- 不改变正式阿浪美术的“待审批占位”状态。

多故事独立缩略图字段不在本轮实现范围。后续若正式素材与内容模型获批，可在内容 schema 中增加每故事独立缩略图，并同步 CDN manifest、fallback 与历史内容兼容；当前仅保留此建议，不新增字段。
