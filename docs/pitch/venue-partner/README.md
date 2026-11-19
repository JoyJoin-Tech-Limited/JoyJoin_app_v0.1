# 场地伙伴产品速览（Venue Partner Pitch Kit）

给餐厅 / 酒吧 / 咖啡店等场地合作方做产品介绍时使用的一页式画册。

- `index.html` — 可打印的 10 页画册（A4 横向），直接用浏览器打开即可全屏演示或 `⌘P` 转 PDF
- `venue-partner-deck.pdf` — 已渲染的 PDF（A4 横向，10 页）
- `shots/` — 画册引用的 7 张小程序真实界面截图

## 七张截图对应场地最关心的七个问题

| # | 文件 | 问题 | 说明 |
|---|------|------|------|
| 01 | `shots/01-discovery.png` | 客从哪里来 | 发现页：区域、档期、人均、成局进度一屏可见 |
| 02 | `shots/02-budget-band.png` | 客单价从哪来 | 报名第一步必须选人均区间，四档与门店价位标签对应 |
| 03 | `shots/03-table-six.png` | 一桌几个人 | 排桌后六张卡 + 确定日期 + 已落定门店与地址 |
| 04 | `shots/04-arrival.png` | 会不会放鸽子 | 集结房间 6/6 确认出席，可登记晚到 |
| 05 | `shots/05-flow.png` | 到店怎么走 | 活动详情「怎么参加」四步 + 现场安排 + FAQ |
| 06 | `shots/06-icebreaker.png` | 谁带气氛 | 破冰在客人手机上运行，门店不派人力 |
| 07 | `shots/07-footprint.png` | 之后留下什么 | 活动后足迹与评价沉淀，支撑复购 |

## 重新生成

截图由 H5 构建 + Playwright 抓取（见 skill `mini-program-screenshot-workflow`）：

```bash
TARO_APP_API_BASE_URL=http://localhost:5001 TARO_APP_ENABLE_STORY_MODE=true \
  npm run build:h5 --workspace=mini-program

node scripts/mock-h5-server.mjs            # 端口 5001，同时静态托管 dist
SCREENSHOT_PORT=9000 node scripts/screenshot-server.mjs
# 浏览器打开 http://localhost:9000/<generator-name>.png
```

已用到的 generator：`discover-oracle-cards`、`squad-unboxing-revealed-allup`、
`gathering-room-all-confirmed`、`event-detail-*`、`icebreaker-warmup-topic-settled`、
`events-footprint-revealed`。预算页与六人桌揭晓页为一次性 Playwright 抓取
（故事态 `__story=revealed-allup&groupId=group-screenshot-006`）。

重新渲染 PDF：

```bash
# 在仓库根目录执行，playwright 需要从根 node_modules 解析
node -e "…"   # 或用 scripts/screenshot-server.mjs 的 withBrowserPage 直接 page.pdf()
```

## 对外发送前必须替换的内容

- 截图中的姓名、门店、日期、金额均为 **演示数据**（`scripts/mock-h5-server.mjs` fixture），
  画册末页已注明，但当面讲解时应说明。
- 第 10 页「合作框架」全部标记为 `待确认`：合作方式、结算比例、首批档期、
  每场桌数、人均落位、退改条款。**不要口头承诺具体佣金比例**——
  `venues.commission_rate` 的默认值（`PRODUCT_REQUIREMENTS.md:2275`）是系统默认值，不是报价。
- 未包含管理后台的场地管理界面截图（需运行服务端 + super_admin 账号）。
  如果对方要看「我们怎么管你的档期」，可后续补 `admin-client` 的场馆页截图。
