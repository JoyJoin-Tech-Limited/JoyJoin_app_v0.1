# JoyJoin 部署指南

## 当前生产部署状态

当前仓库的**生效生产路径**不是 Fly.io / Railway / Vercel 组合，而是：

1. GitHub Actions 分支驱动部署：
   - `main` → 自动部署到 **staging**（`staging.joyjoinapp.com`）
   - `release` → 经过 `production` 环境审批后自动部署到 **production**
2. 通过 SSH 连接远程应用服务器（`SERVER_IP` / `SERVER_USER`）
3. 在远程服务器的 `~/JoyJoin` 目录执行代码同步
4. 在 `~/JoyJoin/deployment` 下运行 `docker compose -f docker-compose.nginx.yml up -d --build --remove-orphans`
5. 由宿主机 `Nginx`（配置见 `deployment/nginx/joyjoin.conf`）统一处理 HTTPS、域名入口和反向代理

> 结论：当前运行时是**自管远程服务器 + Docker Compose + Nginx**。

---

## 生产架构概览

```text
GitHub Actions
  └─ SSH 到远程服务器
       └─ cd ~/JoyJoin/deployment && docker compose -f docker-compose.nginx.yml up -d --build
            ├─ host nginx              (80/443, HTTPS 与反向代理)
            ├─ joyjoin-admin           (管理后台静态站点, 127.0.0.1:3001)
            ├─ joyjoin-api             (Node.js API, 127.0.0.1:5000)
            ├─ postgres                (PostgreSQL 16, 127.0.0.1:5432 + pgdata)
            └─ joyjoin-granite-embedding (向量服务, 127.0.0.1:8000)

公网域名 (多域名 SAN 证书)
  ├─ joyjoinapp.com / www.joyjoinapp.com  -> Nginx maintenance page (`/api/*` -> joyjoin-api)
  ├─ admin.joyjoinapp.com                 -> Nginx -> joyjoin-admin
  └─ api.joyjoinapp.com                      -> Nginx -> joyjoin-api

数据库
  └─ DATABASE_URL -> Compose 内的 postgres:5432/joyjoin
```

---

## 仓库里哪些文件是当前权威来源

- 生产部署流水线：`.github/workflows/deploy-production.yml`（`release` 分支触发）
- Staging 部署流水线：`.github/workflows/deploy-staging.yml`（`main` 分支触发）
- 共享质量门：`.github/workflows/quality-gates.yml`
- 运行时编排：`deployment/docker-compose.nginx.yml`
- 网关与域名：`deployment/nginx/joyjoin.conf`
- 生产环境变量模板：`deployment/.env.production.example`

如果这些文件与其他旧文档冲突，以这里列出的文件为准。

---

## 服务器准备

远程服务器需要具备：

- Docker Engine
- Docker Compose Plugin
- Node.js（建议 **20+**；生产发布仍会在宿主机运行 `npm ci`/校验，微信开发版固定 IP 上传也在宿主机执行 `miniprogram-ci`）
- 一个已检出的仓库目录（当前流水线假设为 `~/JoyJoin`）
- 80 / 443 端口对公网开放
- 域名 A 记录指向该服务器 IP

当前 Compose 文件会启动这些服务：

- `joyjoin-api`
- `joyjoin-admin`
- `postgres`
- `granite-embedding`

PostgreSQL 仅绑定宿主机回环地址，并通过 `pgdata` volume 持久化。

---

## 数据库现状

### 当前状态

- 应用通过 `DATABASE_URL` 连接 PostgreSQL
- 生产数据库由 `deployment/docker-compose.nginx.yml` 的 `postgres:16` 服务提供
- 数据保存在 `pgdata` volume，宿主机端口仅绑定 `127.0.0.1:5432`
- staging 使用独立的 `postgres-staging`、`joyjoin_staging` 和 `pgdata_staging`
- 生产与 staging 的 DDL 都不由常规部署自动执行；先人工应用迁移，再发布应用

---

## GitHub Actions 所需 Secrets

当前生产流水线依赖这些 GitHub Secrets：

```env
SERVER_IP=<remote-server-ip>
SERVER_USER=<ssh-user>
SSH_PRIVATE_KEY=<private-key>
DATABASE_URL=postgresql://<db-user>:<db-password>@<db-host>/<db-name>?sslmode=require
```

`DATABASE_URL` 会被传到远程服务器上的部署脚本流程中，并与 API 容器使用同一数据库连接。
当前运行中的 `joyjoin-api` 容器从 `deployment/.env.production` 读取运行时环境，因此该文件中的 `DATABASE_URL` 必须与 GitHub Actions Secret `DATABASE_URL` 保持一致，避免迁移任务与 API 运行时连接到不同数据库。

---

## 域名与入口

为当前自管服务器部署（新服务器 IP: 1.12.243.104），确保以下 **A 记录** 都直接指向远程服务器公网 IP `1.12.243.104`：

```text
joyjoinapp.com
www.joyjoinapp.com
admin.joyjoinapp.com
api.joyjoinapp.com
```

`deployment/nginx/joyjoin.conf` 负责：

- 自动 HTTPS
- HTTP -> HTTPS 跳转
- `joyjoinapp.com` 及 `www.*` 下的 `/api/*` 反代到 `joyjoin-api:5000`
- `admin.*` 前缀反代到 `joyjoin-admin:3001`
- `api.*` 前缀全量反代到 `joyjoin-api:5000`

在执行部署前，宿主机必须已经具备以下可读证书文件，否则 `nginx -t`
会失败：

```text
/etc/letsencrypt/live/joyjoinapp.com/fullchain.pem
/etc/letsencrypt/live/joyjoinapp.com/privkey.pem
/etc/letsencrypt/live/admin.joyjoinapp.com/fullchain.pem
/etc/letsencrypt/live/admin.joyjoinapp.com/privkey.pem
/etc/letsencrypt/live/api.joyjoinapp.com/fullchain.pem
/etc/letsencrypt/live/api.joyjoinapp.com/privkey.pem
```

如果证书尚未签发，先在服务器上通过 Certbot 或等效方式为这些域名签发证书，再执行部署。

---

## 环境变量

生产环境从 `deployment/.env.production` 加载。推荐以
`deployment/.env.production.example` 为模板。

最关键的变量包括：

```env
NODE_ENV=production
PORT=5000
APP_URL=https://joyjoinapp.com
DATABASE_URL=postgresql://<db-user>:<db-password>@<db-host>/<db-name>?sslmode=require
COOKIE_DOMAIN=.joyjoinapp.com
```

前端生产构建默认保持 `VITE_API_URL` 为空，让浏览器继续请求同源 `/api/*`，
由宿主机 Nginx 反向代理到 API，避免带 cookie 的跨域请求依赖浏览器 CORS。

不要把真实 secret 提交到仓库。

---

## 手动部署（服务器内执行）

如果需要绕过 GitHub Actions，在**远程服务器内**手动执行：

```bash
cd ~/JoyJoin
cp deployment/.env.production.example deployment/.env.production
# 先把 deployment/.env.production 里的占位值全部替换成真实生产变量，
# 尤其是 DATABASE_URL / SESSION_SECRET / WECHAT_SECRET 等，再执行：
./deployment/scripts/deploy-production.sh
```

生产部署脚本 `deployment/scripts/deploy-production.sh` 对齐当前的自管服务器部署方式：使用现有 Docker Compose + Nginx，并直接读取 `deployment/.env.production`。

> 注意：GitHub Actions 生产流水线在 `release` 分支推送时触发，并会调用服务器上的 `deploy-production.sh`。手动执行仅用于紧急回滚或绕过 CI 的场景。

---

## 同服务器 staging（体验版测试价）

为了在不污染生产数据的前提下测试 ¥0.01 支付流程，可在同一台远程服务器上部署隔离的 staging API 和 staging 管理后台。

### 文件与域名

- 编排：`deployment/docker-compose.staging.yml`
- Nginx：`deployment/nginx/joyjoin.conf` 已包含 `staging.joyjoinapp.com` 和 `staging.admin.joyjoinapp.com`
- 环境模板：`deployment/.env.staging.example`
- 域名：
  - `staging.joyjoinapp.com` A 记录指向同一服务器 IP
  - `staging.admin.joyjoinapp.com` A 记录指向同一服务器 IP

### 部署步骤

#### 自动部署（推荐）

每次推送 `main` 分支，GitHub Actions 会自动：

1. 运行质量门（guardrails、类型检查、测试、Harness gate、AI 模拟）
2. 在 GitHub runner 上构建 API/Admin 镜像；共享 CVM 不执行应用编译
3. 镜像交付有三种模式（按优先级）：**TCR（腾讯云同地域）> GHCR > rsync bundle**
   - TCR / GHCR 模式：CVM 并行拉取两个镜像（每次尝试 8 分钟、最多 3 次，镜像层断点续传）；TCR 拉取失败时自动回退到 GHCR 引用
   - bundle 模式：只同步 `deployment/` 运行文件；预构建镜像包拆成 8 MiB 小块，通过最多 4 条独立 SSH 连接并行续传到服务器
4. 从 GitHub secrets/vars 写入 `deployment/.env.staging`
5. 只读验证 staging schema 和容器内数据库地址；仅当 `profilePixelAvatarEnabled` 或 `equipmentRewardsEnabled` 生效时，校验 12 种人格的启用中初始装备
6. 加载镜像、切换容器并验证 `/api/readyz`、本机/公网 Admin 页面；失败时恢复旧镜像与旧 Nginx 配置
7. staging 成功后，才触发同一 commit 的微信小程序开发版上传

> 2026-06-30：server Dockerfile 的 HEALTHCHECK 已改为 `http://127.0.0.1:${PORT:-5000}/api/health`，因此 staging 容器（PORT=5001）不再被误判为 unhealthy。
>
> 2026-07-20：`/api/health` 只表示进程存活，发布验收必须使用 `/api/readyz`（数据库 + 关键配置）并单独检查 Admin 根页面。部署脚本不再运行 migration、DDL 或 seed；这些操作必须按仓库迁移纪律预先人工执行。
>
> 2026-08-13：CVM→GHCR 跨太平洋拉取不稳定（多次 3×5 分钟超时）后，拉取改为并行 + 8 分钟/次，并实现了同地域 TCR 交付模式（见下节）。

#### TCR 同地域镜像仓库（推荐启用）

GHCR 跨太平洋拉取不稳定时，把 staging 镜像同时推送到腾讯云同地域容器镜像服务（TCR），CVM 首选 TCR 拉取、失败自动回退 GHCR。

**一次性开通步骤（需腾讯云控制台，仓库代码已就绪）：**

1. 腾讯云控制台 → 容器镜像服务 TCR，在 **CVM 同地域**（CVM IP `1.12.243.104` 所在区域）创建实例（个人版 `ccr.ccs.tencentcloud.com` 或企业版实例域名）
2. 创建命名空间 `joyjoin`
3. 创建长期访问凭证（访问凭证 → 新建），得到「用户名」（通常为长数字 ID）与「密码」
4. 在 GitHub repo 设置：
   - **Secrets**：`TCR_REGISTRY`（实例域名，如 `ccr.ccs.tencentcloud.com`）、`TCR_USERNAME`（凭证用户名）、`TCR_TOKEN`（凭证密码）
   - **Variables**：`TCR_NAMESPACE=joyjoin`、`STAGING_TCR_ENABLED=true`（`STAGING_GHCR_ENABLED=true` 保持开启，作为自动回退）
5. 推送一次 `main` 触发部署；镜像仓库 `joyjoin-api-staging` / `joyjoin-admin-staging` 会在首次 push 时自动创建（如实例未开启自动建仓，先在控制台创建这两个仓库）

验证：部署日志显示 `Registry delivery mode: tcr`，CVM 从 `<TCR_REGISTRY>/joyjoin/...` 拉取成功。

#### 手动部署（服务器内执行）

如需绕过 CI，从本机 SSH 到远程服务器（示例，使用你保存的 key）：

```bash
ssh -i "~/Desktop/Business idea/JoyJoin/SSH/OpenCode.pem" root@1.12.243.104
```

在服务器内执行：

```bash
cd ~/JoyJoin/deployment
cp .env.staging.example .env.staging
# 编辑 .env.staging：DATABASE_URL、APP_MODE=staging、TEST_PAYMENT_PRICE_IN_CENTS=1 等
```

首次使用 staging 前，需要为域名签发 TLS 证书（如果还没签过）：

```bash
sudo certbot certonly --nginx -d staging.joyjoinapp.com
sudo certbot certonly --nginx -d staging.admin.joyjoinapp.com
```

`deploy-staging.sh` 现在要求预构建镜像包，不能再直接在共享 CVM 上编译。正常恢复或发布请重新运行 GitHub 的 **Deploy Staging** workflow。只有已在其他机器生成并上传镜像包时，才可在服务器手动执行：

```bash
STAGING_IMAGE_BUNDLE=/path/to/joyjoin-staging-images.tar.gz \
  ./deployment/scripts/deploy-staging.sh
```

> 注意：
> - `docker-compose.staging.yml` 中的 `postgres-staging` 服务不要写死 `POSTGRES_PASSWORD`，应让它从 `.env.staging` 读取，否则会出现密码不一致导致 API 无法连接的问题。
> - CI 自动部署时会覆盖写入 `.env.staging`，手动编辑的值会在下一次 `main` 推送后被覆盖。
> - `DATABASE_URL` 必须从 API 容器内指向 `postgres-staging:5432/joyjoin_staging`；`localhost:5433` 只适用于宿主机诊断，不能作为 API 运行时地址。
> - 不要通过部署脚本重置数据库卷。迁移与 seed 必须先人工执行并验证，脚本只做只读 schema/catalog gate。

### 验证

```bash
curl -fsS https://staging.joyjoinapp.com/api/readyz
curl -fsS https://staging.admin.joyjoinapp.com/
```

### 小程序指向 staging

构建前在 `apps/mini-program/.env.local` 中设置：

```env
TARO_APP_API_BASE_URL=https://staging.joyjoinapp.com
```

然后在微信公众平台 → 开发管理 → 服务器域名中添加 `https://staging.joyjoinapp.com` 和 `wss://staging.joyjoinapp.com`，再上传体验版。

### 关键环境变量

```env
APP_MODE=staging              # 必须：启用 test pricing、保留微信登录
NODE_ENV=staging              # 容器内仍会被 npm 脚本覆写为 production
TEST_PAYMENT_PRICE_IN_CENTS=1 # ¥0.01，仅在 APP_MODE != production 时生效
PORT=5001
APP_URL=https://staging.joyjoinapp.com
```

---

## 发布后检查

> 2026-06-30：容器 HEALTHCHECK 使用 `http://127.0.0.1:${PORT:-5000}/api/health`。生产默认端口 5000；staging 端口 5001，不会再因硬编码 5000 而报 unhealthy。
>
> 2026-07-14 运维补充（健康检查与 unhealthy 判定）：
> - 用 `127.0.0.1` 而非 `localhost` 的另一原因：容器内 `localhost` 会解析到 IPv6 `::1`，而 compose 将端口绑定在 IPv4（`127.0.0.1:5000:5000`），健康检查打 `::1:5000` 被拒，误报 unhealthy。
> - **`unhealthy` ≠ 服务宕机**：`restart: unless-stopped` 不会因 unhealthy 标签自动重启容器。`/api/health` 只验证进程存活；发布可用性以 `/api/readyz`、Admin 页面与业务日志为准，勿只看 `docker ps` 的 STATUS 列。
> - 该修复**只在镜像重建后生效**：2026-06-30 之前构建的镜像（仍带旧 `localhost` 健康检查）在重新部署前会持续误报 unhealthy。

```bash
curl -fsS http://127.0.0.1:5000/api/health
curl -fsS http://127.0.0.1:5000/api/readyz
docker logs joyjoin-api --tail 120
sudo nginx -t
sudo systemctl reload nginx
docker ps
```

外部访问验证：

```text
https://joyjoinapp.com
https://admin.joyjoinapp.com
https://joyjoinapp.com/api/health
https://api.joyjoinapp.com/api/health
https://staging.joyjoinapp.com/api/readyz
https://staging.admin.joyjoinapp.com
```

---

## 磁盘安全与运维边界

- staging 的 API/Admin 镜像在 GitHub runner 构建；CVM 只接收经过容量与 inode 预检的临时包，校验后原子替换。生产发布在宿主机构建前要求至少 8 GiB 和 20000 个空闲 inode，不足时安全中止。
- staging 只同步 `deployment/` 运行文件，不再把整个源码与素材目录重复传到 CVM；已 gzip 的镜像包关闭二次压缩，拆成 8 MiB 小块并通过最多 4 条独立 SSH 连接续传。服务器按固定顺序拼接后核对总字节、SHA-256 与 gzip 完整性，最后才原子替换正式 bundle。
- 参考已成功恢复本次故障的策略：磁盘使用率达到 70%、低于发布余量或发布成功后，清理全部未被任何容器引用的 Docker images 与 builder cache；不会删除容器、网络或 volumes。另只清理明确命名的发布临时文件与过期备份。严禁 `docker volume prune`、`docker system prune --volumes`、`docker compose down -v`，也不得删除 `pgdata` / `pgdata_staging`。
- API/Admin 等无状态容器在发布重建后会启用 `json-file` 轮转。Postgres 的轮转参数虽已写入 Compose，但现有数据库容器必须在完成可恢复备份、核对 volume 挂载并安排维护窗口后受控重建才会生效；普通应用发布使用 `--no-deps`，不会暗中重启数据库。
- 生产数据库备份脚本采用临时文件、gzip 校验、原子改名，并在写新 dump 前先安全清理过期文件（始终保留最新一份）；随后按 `max(数据库大小, 最近备份×2) + 2 GiB` 和 10000 个空闲 inode 做 fail-closed 预检，成功后再执行 7 天保留。备份任务与发布共享主机锁，`pg_dump` 在数据库容器内以低 CPU 优先级运行。
- 当前备份仍位于同一台主机的 `$HOME/backups`，不是异地灾备；仓库也尚未提供 PostgreSQL 高可用、独立数据盘或云端磁盘告警。上线后仍需补 COS/独立盘备份与 75%/85%/90% 容量告警。
