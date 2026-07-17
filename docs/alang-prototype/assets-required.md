# 阿浪 V1.7 — 正式视觉资产清单

> 状态日期：2026-07-15
> 当前结论：**正式资产尚未批准。** 代码只使用带“场景示意”标签的 bundled WebP 占位图。

运行时 manifest：`apps/mini-program/src/lib/alang/alangAssets.ts`。批准状态从 `awaiting-approved-art` 改为 `approved` 之前，页面不会尝试把计划中的 CDN 文件当成正式图。

## 资产 manifest

| Asset ID | 页面/状态 | Word 视觉参考 | 比例 | 文案安全区 | 计划 CDN 路径 | 当前 fallback |
| --- | --- | --- | --- | --- | --- | --- |
| `alang-event-card-hero-v1` | Discover / event / event-detail | Discover 为 ACTIVE 03；event/detail 沿用现有 UI | 16:9 | 左侧保留文案区；人物/事件焦点在右侧 | `/assets/alang/alang-event-card-hero.webp` | `/assets/lovart/alang-event-card-placeholder.webp` |
| `alang-found-scene-v1` | found_scene / dialogue | ACTIVE 05 的找到后区域 | 5:6 | 底部 28% 保留叙事区 | `/assets/alang/alang-found-scene.webp` | `/assets/lovart/alang-found-scene-placeholder.webp` |
| `alang-companion-atmosphere-v1` | companion | **无 ACTIVE 图**；现有 UI + 第 13 章正文 | 9:16 | 中部保持安静，供距离/同行文案阅读 | `/assets/alang/alang-companion-bg.webp` | `/assets/lovart/alang-found-scene-placeholder.webp` |
| `alang-result-hero-v1` | result / story archive | result 无 ACTIVE 图；故事档案展示参考 ACTIVE 07 | 15:8 | 留出大面积低细节文字区 | `/assets/alang/alang-result-hero.webp` | `/assets/lovart/alang-result-placeholder.webp` |

运行时 manifest 的每一项还固定记录 `targetSize`、`characterVersion`、`allowedVariations`、`forbiddenVariations`、`exportSpec` 与 `approver`。这些字段必须随最终视觉审批一起复核，不能只替换 URL。

## 交付硬规则

- WebP 主文件；每张需通过真机可读性和压缩质量检查。
- 阿浪在四张图中的年龄、发型、服装、体态和色彩气质必须一致。
- 不把悦仔/Xiaoyue 代替阿浪；阿浪是独立城市人物。
- 图内禁止写死标题、按钮、距离、地点、二维码或动态状态文字。
- 禁止在图中提前暴露搜索精确坐标、地图 pin 或陪伴路线。
- 关键人物和场景焦点必须避开 manifest 的文案安全区。
- 只有设计/产品明确批准后才可把 `approvalStatus` 改为 `approved`。
- FUTURE 04/08 与 REMOVED 09 不得作为这四张素材的构图来源。

## 批准后的接入步骤

1. 将源文件放入 CDN asset pipeline 对应源目录，不放进主包。
2. 把四个文件加入 `apps/mini-program/scripts/cdn-asset-manifest.json`。
3. 保持 `alangAssets.ts` 的 asset ID、比例、安全区和路径不变；只更新批准状态。
4. 运行 `npm run validate:assets -w mini-program`、`npm run check:package-size -w mini-program` 和 WeChat 构建。
5. 上传 CDN 后在 staging 真机验证；CDN 失败必须仍能回退到 bundled 占位图。

## 当前占位图限制

三张现有 Lovart WebP 是通用 JoyJoin 礼盒/场景占位物，不是阿浪人物设定，也不满足 Word 锁定稿的最终视觉品质。它们仅用于结构、布局、断网和错误态验证，不能出现在“视觉资产已完成”的验收结论中。

## V1.7 Profile 与故事缩略图边界

- Reference 06 的 Profile 已按 2026-07-16 产品决定升级为 Profile-only V2 纸娃娃系统。本地交付精确包含 12 张 512×768 基础身体与 48 张裁边透明初始装备层；基础身体固定穿贴身背心与安全短裤，装备层由 manifest placement 锚定，同一文件兼作衣橱缩略图。发布文件使用内容哈希路径 `/assets/profile-pixel/v2/archetypes/<id>/body-front-v2.<hash>.webp` 与 `/assets/profile-pixel/v2/equipment/starter/<id>/<slot>/layer-v2.<hash>.webp`，具体 URL 由运行时 manifest 提供。未来装备则登记在 `assets-source/profile-pixel-v2/equipment-items.json`，由同一构建流程动态生成和发布。这只证明本地资源和发布接线完整，远端状态仍必须以 CDN workflow 的逐 URL HTTP 验证为准。
- 用户对 Profile 像素形象的自主设计授权不等于批准阿浪正式人物/场景图；阿浪资产仍必须按本清单单独审批。
- Reference 06 的 Word 完整伙伴/套装方案仍不照搬；当前授权范围是 Profile-only 四槽换装、活动装备池、保底、碎片与碎片商店。四槽透明初始装备层已接入可复用 paper-doll contract；穿脱、库存与显式保存继续使用真实服务端状态，任意槽清空后仍显示不可脱的安全内搭。新增衣服不允许扩张为按角色×搭配组合的整图矩阵，只登记单件透明 layer、placement 与 depth。
- Reference 07 当前没有每段故事独立缩略图字段或已批准素材。“我的故事”已改为私人连续书页，不再渲染活动/阿浪档案卡；封面使用 code-native 书页/星光视觉，多故事独立缩略图只保留为后续建议。
- Search 顶部区域横幅、找到后场景以及阿浪 result/archive-detail 场景仍使用现有 manifest fallback；任何正式替换都必须走审批。“我的故事”私人连续书页使用独立 code-native 封面，不读取这些阿浪 fallback，也不恢复活动档案总览。
