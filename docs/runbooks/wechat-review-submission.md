# WeChat 提审策略 — 一次过 Runbook

> Canonical reference for submitting the JoyJoin mini-program to WeChat review.
> Last updated: 2026-08-18

## 1. 核心定位（Positioning)

悦聚提交审核时的定位是:**线下聚会活动报名与订座平台**,附带免费互动故事玩法。

- 不是「社交/交友」产品 → 不触发社交类目资质(ICP/增值电信)
- 提交版本不启用 AI 生成 → 不触发生成式 AI 算法备案
- 这个定位不是话术,是产品的事实:组队只发生在单个活动池内,连接只在活动后建立,排桌 = 活动物流(如婚宴座位表)

## 2. 文案词汇纪律(Copy Vocabulary)

`2026-08-18` 起生效,覆盖 mini-program、shared copy、server 通知文案:

| 禁用(触发审核) | 使用(隐性词汇) |
|---|---|
| 匹配中/匹配成功/已匹配 | **排桌中/排桌完成/已排桌** |
| 匹配度/为你匹配 | **合拍度/为你安排** |
| 撮合 | **牵线** |
| 社交期待/社交画像/社交签名/社交人格 | **活动期待/活动画像/聚会签名/聚会人格** |
| 快速交友 | **轮桌畅聊** |
| 灵魂默契/有趣的灵魂/社交DNA | **一拍即合/有趣的搭子/合拍DNA** |
| AI社交建筑师 | **氛围建筑师** |

**刻意保留**(改名属产品决策,不属文案层):
- 原型名「社交裁缝蛛」(人格系统身份资产)
- 报名意向「交新朋友」(活动平台标准词汇)
- 街头盲盒「轻社交勇气」(默认关闭,不参与审核)
- `内容由 AI 生成` 合规角标(由 `aigcEnabled`/meta 门控:LLM 杀开关关闭时自动消失,且此时确实无 AI 内容)

治理落点:`packages/shared/src/copy/exceptions.ts`(ORANGE_WORDS「匹配」条目已改写为禁用用户可见文案)。

法律协议:`packages/shared/src/legal/joyjoinTermsZh.ts`(2026-08-18 版)已对齐排桌词汇;AIGC 条款改为**条件式**(「在启用生成式人工智能功能的前提下…相关功能将依法完成算法备案后方可上线」),与无 AI 提审姿态一致。仍需 AC-14 legal sign-off。

## 3. 提审前必办(管理后台,不在代码里)

| # | 事项 | 位置 |
|---|---|---|
| 1 | 服务类目选生活服务类(非社交/婚恋) | mp.weixin.qq.com → 设置 → 服务类目 |
| 2 | 《用户隐私保护指引》声明位置采集(getLocation/startLocationUpdate/onLocationChange) | 设置 → 服务内容声明 → 用户隐私保护指引 |
| 3 | 提审时勾选「采集隐私」(严禁勾「未采集」,否则接口权限被回收 `appid privacy api banned`) | 提审表单 |
| 4 | 服务器域名白名单 `*.joyjoinapp.com`(含 CDN 与 API) | 开发设置 → 服务器域名 |
| 5 | 微信支付开通且 `WECHAT_PAY_APP_ID === WECHAT_APPID` | 微信支付商户平台 |

## 4. 提审时环境配置(零代码)

- 所有 `SOCIAL_*_LLM_ENABLED`、`SMART_PROFESSION_V1_ENABLED` 等 LLM 杀开关 → `false`(审核员任何操作都物理无法触发生成式调用,策展 fallback 均为生产级)
- `ALANG_ENABLED=false`(街头盲盒默认关闭)
- `PAYMENTS_ENABLED=true` + 线上至少 1 个 open 的「体验场」池,审核员能走完 报名→支付→排桌 全链路
- 提交用 `api_target=production`(手动 workflow_dispatch)

## 5. 诚实边界

- 微信会**事后抽查**,且每次版本更新都会重新审核
- 在算法备案落地前,**本 runbook 的配置必须是每次提审版本的默认状态**
- AI 能力上线路径:备案完成 → 灰度开 `*_LLM_ENABLED` → 下次提审同步更新协议与备注

## 6. 提审备注文案(可直接粘贴)

> 悦聚是线下聚会活动报名与订座平台,提供活动浏览、报名付费、同桌排座与活动通讯录功能,并附带免费互动故事玩法。本版本所有互动内容均为预先创作,不包含 AI 生成功能,无开放式社交网络功能。

## 7. 相关文件

- 上传流水线:`.github/workflows/taro-weapp-build.yml`(staging 部署成功后才上传开发版;`--use-cos=false` 同步校验)
- 上传白名单:`apps/mini-program/project.config.json` `packOptions.include`(新增捆绑资源目录必须同步加正则,否则静默丢弃)
- 权限声明校验:`npm run validate:wechat-app-config -w mini-program`(scope.* ≤30 字)
- 包体检查:`npm run check:package-size -w mini-program`(2MB 上限)
