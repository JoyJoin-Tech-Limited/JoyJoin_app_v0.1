# 迁机 Runbook — CVM → 轻量应用服务器 4C8G（2026-10-23）

> 触发：原腾讯云 CVM `1.12.243.104` 已过期，续费 ¥700/月；站点当前全站不可用（`/api/health` 超时）。
> 决策：迁到**腾讯云轻量应用服务器 4C8G 通用型（专业）**，¥245/月，广州地域，**月付**。
> 成本：−65%（¥8,400/年 → ¥2,940/年）。
> 时间窗：**必须 2026-10-30 前收尾**。11/2–11/8 提审周禁止任何服务器变更（审核未过即整体顺延至 11/16，见 `docs/deliberations/2026-10-12-launch-timetable-cold-start.md`）。

> **2026-11-20 执行记录（actual）**：本次实际迁到**轻量 2C4G 通用型（进阶）**，广州，¥100/月（100GB SSD / 7Mbps / 1000GB 月流量），3 个月预付（备案资源要求）。原 CVM `1.12.243.104` 未续费，于 **2026-11-21 15:52** 到期。新机 `joyjoin-lighthouse` / **`43.138.185.90`**。生产 DNS `@/www/api/admin` 已于 2026-11-20 18:58 切到新 IP；`staging/staging.admin` 暂留旧机。CI pin、GitHub `SERVER_IP`、nginx `/ws`、static 404 已更新。生产栈（api/admin/postgres/granite）已在新机运行；staging 暂未迁移。
> **2C4G 运行规则**：staging 空闲即停；staging 关闭语义维（`ENABLE_SEMANTIC_SIMILARITY=false`，并清空 `EMBEDDING_BASE_URL`）；保留 prod granite + 语义维；2GB swap + 内存 85% 告警；Node heap 1536MB。内存紧张时原地升配 4C8G（保留公网 IP）。
> **本文以下 4C8G 方案为 2026-10-23 的历史决策记录，不再代表当前目标。**

---

## 0. 为什么要 4C8G，而不是更便宜的 2C4G

原机同时跑 **生产栈 + 完整 staging 栈**：

| 栈 | 组件 | 内存 |
|---|---|---|
| prod | `joyjoin-api`（`mem_limit 2g`，`--max-old-space-size=1536`） | ≤2 GB |
| prod | `postgres:16`（无 mem_limit） | ~0.4 GB |
| prod | `granite-embedding`（无 mem_limit，torch 常驻） | ~1 GB |
| prod | `joyjoin-admin` + 宿主机 nginx | ~0.1 GB |
| staging | `joyjoin-api-staging` 2g / `granite-embedding-staging` 1g / `postgres-staging` 384m / `admin-staging` 128m | reservation≈3 GB |

2C4G 只能装「生产单栈且关掉语义维」，而轻量**只支持升配、不支持降配** —— 先买小再升配等于再迁一次机（换 IP、换白名单）。因此本次一次选对 4C8G，降配决策推到 11/16–11/22（P5 扩量门同窗口），用真实 metrics 说话。

规格对照（腾讯云轻量，2026-10-23 产品页）：

| 套餐 | 规格 | SSD | 带宽 | 流量 | 月付 |
|---|---|---|---|---|---|
| 通用型（进阶） | 2C4G | 100 GB | 7 Mbps | 1000 GB | ¥100 |
| **通用型（专业）** | **4C8G** | **180 GB** | **12 Mbps** | **2000 GB** | **¥245** |
| 锐驰型 | 4C8G | 120 GB | 200 Mbps 峰值 | 无限 | ¥230 |

> 磁盘门槛：`deployment/scripts/deploy-production.sh` 的 `disk_guard()` 要求 ≥8 GiB 空闲 + ≥20000 inodes；180 GB 远超。
> 构建全部在 GitHub runner 完成，CVM 只 `docker pull` → 新机无需编译内存。

---

## 1. 第 0 步：判定原机处于哪个阶段（先做，10 分钟）

登录腾讯云控制台 → 云服务器 / 轻量 → 实例列表 → 看 `1.12.243.104` 的状态：

| 控制台状态 | 含义 | 走哪条分支 |
|---|---|---|
| 运行中 / 已到期 / 已隔离（约 7 天隔离期） | 数据仍在磁盘，续费可恢复 | **Branch A（抢救）** |
| 已退还 / 已回收 / 列表里没有 | 数据已销毁，不可恢复 | **Branch B（重建）** |

两条分支在新机准备（§4）之后完全汇合。

---

## 2. Branch A — 抢救原机数据

**目标：只花一次 ¥700（续 1 个月），把「无法从仓库重建」的东西全部导出，此后不再续费。**

```bash
# 1. 控制台续费 1 个月后起机，确认 SSH 可用
ssh -i ~/.ssh/OpenCode.pem root@1.12.243.104 'docker ps --format "{{.Names}}\t{{.Status}}"'
```

```bash
# 2. 在旧机上打包（在 /root 下执行，产物放 /root/rescue）
set -euo pipefail
mkdir -p /root/rescue/{db,etc,cdn,repo}
cd /root/JoyJoin/deployment                    # 流水线假设的仓库目录

# 2.1 数据库（最关键，也是唯一无法从 git 重建的资产）
docker exec postgres pg_dumpall -U joyjoin > /root/rescue/db/full.sql
gzip -9 /root/rescue/db/full.sql
ls -lh /root/rescue/db/

# 2.2 生产环境变量（含支付/微信密钥，gitignored，只存在于本机）
cp .env.production /root/rescue/etc/.env.production
grep -c '^[A-Z0-9_]\+=' /root/rescue/etc/.env.production   # 记录 key 数量，作为完整性基线

# 2.3 nginx / 证书 / CDN 静态资源
tar czf /root/rescue/etc/nginx.tar.gz -C /etc nginx
tar czf /root/rescue/etc/letsencrypt.tar.gz -C /etc letsencrypt
tar czf /root/rescue/cdn/www-cdn.tar.gz -C /var/www cdn

# 2.4 仓库工作区 + 备份目录 + 定时任务
tar czf /root/rescue/repo/worktree.tar.gz -C /root/JoyJoin --exclude=node_modules --exclude=.git .
tar czf /root/rescue/etc/backups.tar.gz -C /root backups 2>/dev/null || true
crontab -l > /root/rescue/etc/crontab.txt 2>/dev/null || true
docker compose ls > /root/rescue/etc/compose-ls.txt
```

```bash
# 3. 拉回本地（两台机器同时在线的窗口内，也可走轻量↔CVM 内网互联省流量）
mkdir -p ~/joyjoin-rescue-$(date +%Y%m%d)
rsync -avz -e "ssh -i ~/.ssh/OpenCode.pem" \
  root@1.12.243.104:/root/rescue/ ~/joyjoin-rescue-$(date +%Y%m%d)/
```

**验收（缺一条就不算救回来）**

- [ ] `full.sql.gz` 解开后 `grep -c "^CREATE TABLE"` ≥ 预期表数；`psql -l` 里有 `joyjoin` 库
- [ ] `.env.production` key 数 ≥ 60（2026-06 的本地副本只有 44 个 key，**不要拿本地副本当权威**）
- [ ] `www-cdn.tar.gz` 解出文件数与 `apps/mini-program/scripts/cdn-asset-manifest.json` 的条目数一致
- [ ] `letsencrypt.tar.gz` 含 `live/joyjoinapp.com/` 与 `renewal/`
- [ ] 导出物已落到**本机之外的第三处**（本地 + 私有 Git LFS 或 COS），不要只留在新机上

> ⚠️ 导出完成后**立刻**把 `.env.production` 存入密码管理器。它是唯一一处保存着 `WECHAT_PAY_APIV3_KEY` / `WECHAT_PAY_PRIVATE_KEY` 的副本。

---

## 3. Branch B — 从仓库重建（原机已回收）

**损失评估：生产尚未真正上线（P2 才是 10/26），丢失的是测试数据 + 需重新申请的支付密钥，不含真实用户交易。**

可以从仓库/流水线重建：

| 资产 | 来源 |
|---|---|
| 全部代码 / compose / nginx 配置 | `deployment/docker-compose.nginx.yml`、`deployment/nginx/*.conf`、`deployment/scripts/*.sh` |
| 数据库结构 | `apps/server/migrations/*.sql` 顺序执行 |
| 小程序静态资源（`/static/`） | `gh workflow run "Upload CDN Assets"`（`cdn-asset-manifest.json` 驱动） |
| TLS 证书 | 新机 `certbot --nginx -d joyjoinapp.com -d www.joyjoinapp.com -d api.joyjoinapp.com -d admin.joyjoinapp.com`（DNS TTL 600s，签发前先确认 A 记录已指向新 IP） |
| 长驻业务密钥 | GitHub Actions Secrets（`DATABASE_URL` / `SESSION_SECRET` / `WECHAT_APPID` / `WECHAT_SECRET` 等，部署脚本会强制校验） |

必须**手工重新确认/生成**的（本地 `deployment/.env.production` 是 2026-06-13 的旧快照，缺 22 个 key —— 只能作参考，不能直接用）：

```
POSTGRES_PASSWORD                     # 新生成，compose 强制要求，缺失会直接启动失败
WECHAT_PAY_APIV3_KEY / SERIAL_NO / PRIVATE_KEY / PLATFORM_CERT / PLATFORM_PUBLIC_KEY
                                      # 若旧密钥随机器丢失：微信支付商户平台重新申请 APIv3 密钥 + 重新下载平台证书
DUO_REGISTRATION_ENABLED  PROFILE_PIXEL_AVATAR_ENABLED  EQUIPMENT_REWARDS_ENABLED
PERSONAL_STORY_ENABLED   FLASH_SHENZHEN_LOCATION_GATE_ENABLED  FLASH_ANY_LOCATION_ARRIVAL_TEST_ENABLED
SOCIAL_{AUCTION,GROUP_MIRROR,LIE_DETECTIVE,MICRO_CHALLENGE,MINISCRIPT,PERSONALITY_DICE,
        QUIP_BATTLE,RECAP,UNDERCOVER_WORD,WARMUP}_LLM_ENABLED
SOCIAL_ICEBREAKER_ENABLE_{GROUP_MIRROR,QUIP_BATTLE,SPEED_FRIENDING,UNDERCOVER_WORD}
```

> 多数 `SOCIAL_*` 与功能开关已由 DB 侧 feature flags 接管（`apps/server/src/lib/featureFlags.ts`：DB 为准、env 为回退）。恢复时以 `deployment/.env.production.example` 为模板，逐项确认后再上线。
> Branch B 上线前必须补跑：`npm run db:migrate`（或逐个 `psql -f`）+ `npm run admin:create -- <user> <pass> "$ADMIN_CREATE_SECRET_KEY" super_admin`。

---

## 4. 新机初始化（两分支汇合，约 60–90 分钟）

购买：腾讯云 → 轻量应用服务器 → **广州**（离深圳最近，与原机同城域）→ 通用型 4C8G 180GB → **Ubuntu 24.04 LTS** → 月付 → 绑定 `OpenCode.pem` 公钥。
**购买时长 ≥3 个月**（备案资源要求；月付自动续费即可满足，若一次性买 3 个月更稳）。

```bash
# 4.1 系统层
apt-get update && apt-get -y upgrade
timedatectl set-timezone Asia/Shanghai
fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
sysctl -w vm.swappiness=10 && echo 'vm.swappiness=10' >> /etc/sysctl.conf

# 4.2 依赖（README §服务器准备 的完整清单）
apt-get -y install nginx certbot python3-certbot-nginx rsync jq curl git util-linux
curl -fsSL https://get.docker.com | sh
curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt-get -y install nodejs
docker --version && docker compose version && node -v    # 需 ≥20

# 4.3 防火墙（控制台「防火墙」放行 22/80/443；主机侧 ufw 同步）
ufw allow 22,80,443/tcp && ufw --force enable
```

Nginx 走**宿主机**而非容器（与原架构一致），`/var/www/cdn` → `/static/` 直出（`deployment/nginx/cdn-static.conf`）。

> 轻量实例默认无 root 直连策略差异 → 本流水线用 `root@` + 密钥，购买时选「SSH 密钥」并绑定 `OpenCode.pem`。
> 轻量实例公网 IP 与内网 IP 不同：若短期内旧机未退，可用「内网互联」直传数据包（省 12Mbps 出网带宽）。

---

## 5. 代码与 CI 改动（必须与新机上线同一个 PR 合并）

⚠️ **全仓只允许存在一个 pin 的 IP**：改 pin 的 commit 合并后，旧机上的 CI 立刻失效 —— 因此这是一次性硬切换，先在新机手工验证，最后合 PR。

| # | 文件 | 改动 |
|---|---|---|
| 1 | `.github/actions/resolve-cvm-host-fingerprint/action.yml:36` | `PINNED_CVM_HOST='<新 IP>'` |
| 2 | `.github/actions/resolve-cvm-host-fingerprint/action.yml:38` | `PINNED_ED25519_KEY='<ssh-keyscan -t ed25519 <新IP> 得到的公钥>'` |
| 3 | `.github/workflows/upload-cdn-assets.yml` | 2 处 IP 引用 |
| 4 | `.github/workflows/taro-weapp-build.yml` | 2 处 IP 引用 |
| 5 | `.github/workflows/deploy-staging.yml` | 2 处 IP 引用 |
| 6 | `deployment/scripts/deploy-staging.sh` | 1 处 IP 引用 |
| 7 | `deployment/README.md` | 3 处 IP 引用 + 规格说明 |
| 8 | GitHub Secrets | `SERVER_IP=<新 IP>`、`SSH_PRIVATE_KEY`（若换钥）、`SERVER_USER=root` |

取新机 host key：

```bash
ssh-keyscan -t ed25519 <新IP> | awk '{print $3}'
ssh-keyscan -t ed25519 <新IP> | ssh-keygen -lf -    # 记下指纹备查
```

**微信侧（换 IP 必做，否则 CI 上传静默失败）**

- 小程序代码上传 **IP 白名单**：微信公众平台 → 开发管理 → 开发设置 → 小程序代码上传 → 把新 IP 加入（旧的保留一周，便于回滚）
- 服务器域名白名单 `*.joyjoinapp.com` 不受 IP 影响，**不需要**改（`docs/runbooks/wechat-review-submission.md:45`）
- 备案：同账号、同接入商（腾讯云）、中国内地地域 → **无需接入变更**；但要在备案控制台确认状态为「正常」，且不要让账号出现「无备案资源」空窗

**DNS（DNSPod，当前 TTL 600s）**

切机前 30 分钟把 `joyjoinapp.com` / `www` / `api` / `admin` / `cdn`（如有）的 A 记录 TTL 改为 60，然后一次性改指新 IP。回滚 = 把 A 记录改回 `1.12.243.104`（若旧机已退，则回滚依靠新机快照重建）。

---

## 6. 部署与验收

```bash
# 6.1 新机新库（Branch A：先建库再灌 dump，避免脏数据残留）
docker compose -f deployment/docker-compose.nginx.yml up -d postgres
docker exec -i postgres psql -U postgres < /root/rescue/db/full.sql   # 仅 Branch A
# Branch B：npm run db:migrate（或按序 psql -f apps/server/migrations/*.sql）

# 6.2 起生产栈
docker compose -f deployment/docker-compose.nginx.yml up -d
docker compose -f deployment/docker-compose.nginx.yml ps
curl -s https://api.joyjoinapp.com/api/readyz | jq   # 必须 200 + DB/schema 校验通过
```

验收清单（全绿才算迁完）：

- [ ] `https://api.joyjoinapp.com/api/health` = 200；`/api/readyz` = 200（`validateDbSchema()` 通过）
- [ ] `https://joyjoinapp.com` / `admin.joyjoinapp.com` 证书有效（`echo | openssl s_client -connect joyjoinapp.com:443 2>/dev/null | openssl x509 -noout -dates`）
- [ ] `/static/` 抽 5 个资源 200 且 `Cache-Control: immutable`；任取一个 404 路径确认**没有**被缓存（2026-08-01 事故）
- [ ] 小程序真机：登录 → 首页 → 排桌卡 → 破冰页（WS 连上）
- [ ] 真实 ¥0.01 支付（`APP_MODE=staging` + `TEST_PAYMENT_PRICE_IN_CENTS=1`）→ 回调 → 权益到账
- [ ] 退款演练一次（`npm run smoke:auto-refund -w @joyjoin/server`）
- [ ] `gh workflow run "Deploy Production"`（或推 `release`）走通一次 → `deploy-production.sh` 全绿（含 `disk_guard`）
- [ ] `gh workflow run "Taro Weapp Build"` 开发版上传成功（验证 IP 白名单）
- [ ] `htop`/`free -h` 稳态：`used < 5.5 GB`，`available > 2 GB`
- [ ] `docker events --since 24h --filter event=die` 为空
- [ ] 旧机续费期结束前确认**不再扣费**（Branch A）

---

## 7. 时间表

| 日期 | 动作 | 负责 |
|---|---|---|
| 10/23（今天） | 控制台判定分支 → 下单 4C8G 广州 → Branch A 续费起机导数据 | 用户 + 我 |
| 10/24 | 新机初始化 → 部署栈 → 证书 → Branch A/B 数据落位 | 我（@backend-engineer 协助） |
| 10/25 | CI pin 改动 PR → DNS 切 → 全量验收清单 | 我 |
| 10/26–10/30 | 原排期：生产上线 + `api_target=production` 提审 + 48h 值守 | 按 launch timetable |
| 11/2–11/8 | **冻结**：不改服务器、不改部署链路 | — |
| 11/16–11/22 | 用真实 metrics 复盘：留在 4C8G / 拆 staging 到 ¥45 小机 / 备份改 COS | 我 |

---

## 8. 回滚

1. **DNS 回滚**：A 记录改回旧 IP（仅在旧机仍在线时有效，TTL 60s 生效 ≤1 分钟）。
2. **新机回滚**：迁移完成后给新机打**快照**（轻量支持快照），任何后续变更出问题直接回滚快照。
3. **CI 回滚**：`PINNED_CVM_HOST` / secrets 回退到旧值（旧机已退则无意义，因此**先验收再合 PR**）。
4. **数据回滚**：Branch A 在灌库前保留 `full.sql.gz` 原件；于新库执行前先 `pg_dump` 空库基线。

---

## 9. 遗留缺陷（本次不修，但必须记账）

- `$HOME/backups` 与数据库**同机**，整机丢失即全丢 → 改 COS 异地日备（`docs/operations/test-mode-operations.md` 相关段落 + `.github/workflows/setup-db-backup.yml`，`RETENTION_MINUTES=10080`）。
- staging 常驻同机 → 发版日 `compose up`、发版后 `compose stop`（注意 `taro-weapp-build.yml` 的 `upload-weapp` 依赖 staging 部署成功 + `/api/readyz`，按需启停需加 warm-up 轮询，否则上传会误判失败）。
- `granite-embedding` 常驻约 1 GB：若 11/16 复盘要降到 2C4G，**必须同时** `ENABLE_SEMANTIC_SIMILARITY=false` + 删除 `EMBEDDING_BASE_URL`，否则 `embeddingClient.ts` 会变成 2×10s 超时的慢请求（并非安全降级）。
- `.env.production` 无异地副本、无版本化 → 纳入密码管理器 + 季度核对 key 数。
