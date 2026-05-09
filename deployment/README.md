# JoyJoin 部署指南

## 当前生产部署状态

当前仓库的**生效生产路径**不是 Fly.io / Railway / Vercel 组合，而是：

1. GitHub Actions 触发生产流水线
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
            ├─ host nginx      (80/443, HTTPS 与反向代理)
            ├─ joyjoin-user    (用户端静态站点, 127.0.0.1:3000)
            ├─ joyjoin-admin   (管理后台静态站点, 127.0.0.1:3001)
            └─ joyjoin-api     (Node.js API, 127.0.0.1:5000)

公网域名 (多域名 SAN 证书)
  ├─ joyjoinapp.com / www.joyjoinapp.com  -> Nginx -> joyjoin-user
  ├─ admin.joyjoinapp.com                 -> Nginx -> joyjoin-admin
  └─ api.joyjoin.com                      -> Nginx -> joyjoin-api

数据库
  └─ DATABASE_URL -> 外部 PostgreSQL
```

---

## 仓库里哪些文件是当前权威来源

- 生产部署流水线：`.github/workflows/cicd.yml`
- 运行时编排：`deployment/docker-compose.nginx.yml`
- 网关与域名：`deployment/nginx/joyjoin.conf`
- 生产环境变量模板：`deployment/.env.production.example`

如果这些文件与其他旧文档冲突，以这里列出的文件为准。

---

## 服务器准备

远程服务器需要具备：

- Docker Engine
- Docker Compose Plugin
- Node.js（建议 **20+**，并确保宿主机可用 `npm` / `npx`，因为部署过程中会在宿主机执行 `node ...` 与 `npx drizzle-kit push`）
- 一个已检出的仓库目录（当前流水线假设为 `~/JoyJoin`）
- 80 / 443 端口对公网开放
- 域名 A 记录指向该服务器 IP

当前 Compose 文件会启动这些服务：

- `joyjoin-api`
- `joyjoin-user`
- `joyjoin-admin`

当前 Compose 文件**不会**启动 PostgreSQL。

---

## 数据库现状

### 当前状态

- 应用通过 `DATABASE_URL` 连接 PostgreSQL
- `deployment/docker-compose.nginx.yml` 中没有 `postgres` 服务
- 仓库中没有远程服务器本地 PostgreSQL 的编排、备份、迁移或端口暴露配置

### 这意味着什么

当前部署默认依赖**外部 PostgreSQL**。  
仅从仓库配置来看，**不能把“远程应用服务器自带本地数据库”当作现成可直接连接的能力**。

如果团队后续要改成“同一台远程服务器自建 PostgreSQL”，那是一个新的基础设施决策，至少需要：

- 明确 PostgreSQL 的安装方式（宿主机或容器）
- 增加持久化卷、备份、升级和恢复方案
- 调整 `DATABASE_URL`
- 评估与当前会话存储、Drizzle schema push、健康检查、磁盘容量的关系

在这些工作完成前，当前权威状态仍然是：**外部 PostgreSQL 是唯一被仓库显式支持的数据库路径**。

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
api.joyjoin.com
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
/etc/letsencrypt/live/api.joyjoin.com/fullchain.pem
/etc/letsencrypt/live/api.joyjoin.com/privkey.pem
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
./deployment/scripts/deploy.sh production
```

该脚本现在对齐当前的自管服务器部署方式：使用现有 Docker Compose + Nginx，并直接读取 `deployment/.env.production`。当前脚本只支持 `production`，因为现有 Compose 文件、域名和 `env_file` 都绑定到生产拓扑。

---

## 发布后检查

```bash
curl -fsS http://127.0.0.1:5000/api/health
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
https://api.joyjoin.com/api/health
```

---

## 运维边界

- 当前仓库维护的是**应用服务器部署**，不是数据库平台编排
- 当前仓库没有定义本地 PostgreSQL 备份、故障切换、数据盘挂载或监控
- 如果未来要把数据库迁回远程服务器，需要单独做基础设施设计，不应直接假设“服务器上已经有现成数据库可连”
