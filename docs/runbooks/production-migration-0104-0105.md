# 生产库迁移执行方案 · 0104 + 0105 + 0106

**日期：** 2026-11-16（2026-11-16 追加 0106）
**触发原因：** `event_pool_groups.pair_floor_policy` 等字段随 main 上线，但生产尚未执行迁移。生产同样不会自动跑迁移，且服务启动时 `validateDbSchema()` fail-fast —— 先部署后迁移 = 容器 crash-loop + 部署脚本回滚。
**范围：** 仅生产库 `joyjoin`。staging 已于 2026-11-16 执行完毕——0104/0105 见 run 43818841277，0106 随 Deploy Staging run `43843591828` 生效（`b4261973d` 之后、`7565a75f4` 的部署已引用该列）。

> 文件名保留 `0104-0105` 以免破坏既有链接；本文档现在覆盖 **0104 + 0105 + 0106** 三条。0106 是门店专属优惠（venue deal）的数据地基，PR #669 引入，列全部 nullable，但新代码启动时会查询它们。

---

## 0. 一句话执行顺序

**备份 → 只读核对 → 加锁 → 应用 0104 + 0105 + 0106 → 验证字段 → 再触发生产部署。**
顺序不能反：代码先上 = 服务起不来。

---

## 1. 影响面

| 迁移 | 类型 | 变更 | 是否阻塞启动 |
|---|---|---|---|
| `0104_matching_pair_floor.sql` | DDL | `event_pool_groups` + `avg_pair_score int` / `formed_member_count int` / `pair_floor_policy varchar(20)`；`pool_matching_logs` + `pair_floor int` | **是** |
| `0105_pool_registration_revealed_at.sql` | DDL | `event_pool_registrations` + `revealed_at timestamp` | 是（同一启动查询路径） |
| `0106_venue_deal_foundation.sql` | DDL | `venue_deals` + `set_menu_price_cents` / `set_menu_original_price_cents`；`event_pools` + `guaranteed_venue_id` / `guaranteed_deal_id`（两条 `ON DELETE RESTRICT` 外键） | **是**（`validateDbSchema()` 会查 `event_pools`/`venue_deals`） |
| `0103_venue_slot_coverage_futian_20261111.sql` | DML | 福田 `venue_time_slots` 覆盖更新 | 否（可随后单独执行） |

四条迁移都是**幂等**的（`ADD COLUMN IF NOT EXISTS` / 带条件的 `UPDATE` / `pg_constraint` 存在性检查），重复执行无副作用。新增列均可空，旧代码不认识它们也不会报错——所以**先迁移、后部署**没有兼容性风险。

---

## 2. 前置检查（5 分钟）

```bash
# 1) 确认没有正在跑的部署（避免和加锁/重启撞车）
gh run list --workflow deploy-production.yml --limit 3

# 2) 上机
ssh <SERVER_USER>@<SERVER_IP>
cd ~/JoyJoin

# 3) 确认生产 Postgres 容器名（不要照抄 staging 的 postgres-staging）
docker ps --format '{{.Names}}\t{{.Image}}' | grep -i postgres

# 4) 确认生产库标识
docker exec -i <PG_CONTAINER> psql -U joyjoin -d joyjoin -Atc 'select current_database(), version();'
```

> 生产与 staging 的关键差别：容器名不同、库名是 `joyjoin`（不是 `joyjoin_staging`）、密码来自生产 env 文件。
> 只有 DB 是主库才继续；`current_database()` 必须等于 `joyjoin`。

---

## 3. 备份（必须）

```bash
mkdir -p ~/backups
STAMP=$(date +%Y%m%d-%H%M%S)
docker exec -i <PG_CONTAINER> pg_dump -U joyjoin -d joyjoin -Fc \
  -t event_pool_groups -t pool_matching_logs -t event_pool_registrations \
  > ~/backups/pre-0104-0105-$STAMP.dump
ls -lh ~/backups/pre-0104-0105-$STAMP.dump
```

- 三张表体量很小，`-Fc` 压缩后应在 MB 级。
- 记录 dump 文件名到变更记录里。**不要把备份放进仓库。**

可选（更稳，但更慢）：整库 `pg_dump -Fc`。若磁盘余量充足，建议整库。

---

## 4. 应用迁移

在 CVM 上、仓库根目录执行。加锁避免与部署并发（生产锁名 `joyjoin-cvm-remote`）：

```bash
exec 9>/var/lock/joyjoin-cvm-remote.lock
flock -n 9 || { echo "another production op is running"; exit 1; }

docker exec -i <PG_CONTAINER> psql -U joyjoin -d joyjoin -v ON_ERROR_STOP=1 <<'SQL'
BEGIN;

ALTER TABLE "event_pool_groups" ADD COLUMN IF NOT EXISTS "avg_pair_score" integer;
ALTER TABLE "event_pool_groups" ADD COLUMN IF NOT EXISTS "formed_member_count" integer;
ALTER TABLE "event_pool_groups" ADD COLUMN IF NOT EXISTS "pair_floor_policy" varchar(20);

ALTER TABLE "pool_matching_logs" ADD COLUMN IF NOT EXISTS "pair_floor" integer;

ALTER TABLE "event_pool_registrations" ADD COLUMN IF NOT EXISTS "revealed_at" timestamp;

COMMENT ON COLUMN "event_pool_groups"."avg_pair_score" IS 'Mean pair score of the formed group, null when not computed';
COMMENT ON COLUMN "event_pool_groups"."formed_member_count" IS 'Member count captured at formation time';
COMMENT ON COLUMN "event_pool_groups"."pair_floor_policy" IS 'Which pair-floor tier allowed this group to form';
COMMENT ON COLUMN "pool_matching_logs"."pair_floor" IS 'Pair-floor value applied during this matching run';
COMMENT ON COLUMN "event_pool_registrations"."revealed_at" IS 'When the participant first opened the reveal; NULL means not opened';

-- 0106 venue deal foundation (PR #669)
ALTER TABLE "venue_deals"
  ADD COLUMN IF NOT EXISTS "set_menu_price_cents" integer,
  ADD COLUMN IF NOT EXISTS "set_menu_original_price_cents" integer;

ALTER TABLE "event_pools"
  ADD COLUMN IF NOT EXISTS "guaranteed_venue_id" varchar,
  ADD COLUMN IF NOT EXISTS "guaranteed_deal_id" varchar;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'event_pools_guaranteed_venue_id_venues_id_fk') THEN
    ALTER TABLE "event_pools" ADD CONSTRAINT event_pools_guaranteed_venue_id_venues_id_fk
      FOREIGN KEY ("guaranteed_venue_id") REFERENCES "venues"("id") ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'event_pools_guaranteed_deal_id_venue_deals_id_fk') THEN
    ALTER TABLE "event_pools" ADD CONSTRAINT event_pools_guaranteed_deal_id_venue_deals_id_fk
      FOREIGN KEY ("guaranteed_deal_id") REFERENCES "venue_deals"("id") ON DELETE RESTRICT;
  END IF;
END $$;

COMMIT;
SQL
```

> 为什么不用仓库里的 `.sql` 文件直接 `-f`：CVM 上的 `~/JoyJoin` 可能是旧 checkout。上面的内联 SQL 与迁移文件等价且幂等，避免版本不一致。
> 若坚持用文件，先 `git fetch && git checkout <commit>` 确认文件内容后再执行。

---

## 5. 验证（部署前）

```bash
docker exec -i <PG_CONTAINER> psql -U joyjoin -d joyjoin -At <<'SQL'
select table_name || '.' || column_name || ' ' || data_type
from information_schema.columns
where table_schema = 'public'
  and (
    (table_name = 'event_pool_groups' and column_name in ('avg_pair_score','formed_member_count','pair_floor_policy'))
    or (table_name = 'pool_matching_logs' and column_name = 'pair_floor')
    or (table_name = 'event_pool_registrations' and column_name = 'revealed_at')
  )
order by 1;
SQL
```

期望 **5 行**：

```
event_pool_groups.avg_pair_score integer
event_pool_groups.formed_member_count integer
event_pool_groups.pair_floor_policy character varying
event_pool_registrations.revealed_at timestamp without time zone
pool_matching_logs.pair_floor integer
```

再做一次「服务真能查」的冒烟（与启动校验同形）：

```bash
docker exec -i <PG_CONTAINER> psql -U joyjoin -d joyjoin -Atc \
  'select count(*) from event_pool_groups limit 1;'
docker exec -i <PG_CONTAINER> psql -U joyjoin -d joyjoin -Atc \
  'select pair_floor_policy from event_pool_groups limit 1;'
```

两条都必须成功。第一条失败 = 表名/库错；第二条失败 = 字段没加上。

**0106 单独核对**（四条新列 + 两条外键）：

```bash
docker exec -i <PG_CONTAINER> psql -U joyjoin -d joyjoin -At <<'SQL'
select table_name || '.' || column_name || ' ' || data_type
from information_schema.columns
where table_schema = 'public'
  and (
    (table_name = 'venue_deals' and column_name in ('set_menu_price_cents','set_menu_original_price_cents'))
    or (table_name = 'event_pools' and column_name in ('guaranteed_venue_id','guaranteed_deal_id'))
  )
order by 1;
SQL
```

期望 **4 行**（`event_pools.guaranteed_deal_id character varying`、`event_pools.guaranteed_venue_id character varying`、`venue_deals.set_menu_original_price_cents integer`、`venue_deals.set_menu_price_cents integer`）。再确认两条约束存在：

```bash
docker exec -i <PG_CONTAINER> psql -U joyjoin -d joyjoin -Atc \
  "select conname from pg_constraint where conname in ('event_pools_guaranteed_venue_id_venues_id_fk','event_pools_guaranteed_deal_id_venue_deals_id_fk') order by 1;"
```

必须返回两条。缺约束 = 保底绑定可被删除动作静默解除（`ON DELETE RESTRICT` 未生效）。

---

## 6. 部署

生产部署的 workflow 只监听 `release` 分支（`on: push branches: [release]`）与手动 dispatch，**不回放 `main`**。

正常路径是把已验证的提交推进 `release` 分支；手动触发也必须指定 `release`：

```bash
gh workflow run deploy-production.yml --ref release
gh run list --workflow deploy-production.yml --limit 1
```

> `--ref main` 不会匹配这个 workflow 的预期分支，不要照抄 staging 的命令。

观察标准：

- `Preflight` 通过（不是 stale commit）
- API 容器起来后 `/api/readyz` 可达
- 日志无 `Failed query: ... pair_floor_policy`
- 若失败，部署脚本会自动回滚到上一版镜像；**回滚不需要删列**

---

## 7. 回滚

| 情况 | 动作 |
|---|---|
| 迁移执行到一半报错 | `BEGIN/COMMIT` 已保证原子性，失败即整体回滚；查 `ON_ERROR_STOP` 报错行后重跑同一段 |
| 迁移成功、部署失败 | 部署脚本自动回滚镜像。新增列保留（旧代码忽略它们），**不要 DROP** |
| 应用后才发现问题 | 由于列可空且幂等，最安全的回滚是**回退代码**，不是删列 |

**不要**在生产执行 `DROP COLUMN`：那是有损操作，且需要另一次停机窗口。本次迁移的设计前提就是「列可以先留着」。

---

## 8. 0103（可选，随后）

`0103_venue_slot_coverage_futian_20261111.sql` 是纯数据更新，不阻塞启动。确认无误后单独执行，并注意文件头已声明**不清洗重复时段**——执行前先看一遍目标场地当前时段：

```bash
docker exec -i <PG_CONTAINER> psql -U joyjoin -d joyjoin -c \
  "select id, venue_id, day_of_week, start_time, end_time from venue_time_slots
   where venue_id in (select id from venues where name in ('Batch & Co','Bruma'));"
```

---

## 9. 执行记录（填完再关单）

| 项 | 值 |
|---|---|
| 执行人 / 时间 | |
| 生产容器名 | |
| 备份文件 | |
| 迁移前 5 列检查 | 0 行（预期） |
| 迁移后 5 列检查 | 5 行 |
| 生产部署 run id | |
| `/api/readyz` | |
| 0103 是否执行 | |

---

## 10. 为什么生产不走刚才那个 workflow

`staging-apply-0104-0105.yml` 是**面向 staging 写的**：容器名 `postgres-staging`、库名 `joyjoin_staging`、锁 `joyjoin-cvm-staging`，并且没有任何生产侧审批门。把它改成「一个 workflow 通吃两个环境」会让一次误点就改到生产库。

生产的 DDL 仍按仓库既有约定：**人工 SSH + `psql` + 变更记录**。若要 workflow 化，需要单独设计并加 GitHub Environment 审批（`production` environment 的 required reviewers），不在本次范围内。
