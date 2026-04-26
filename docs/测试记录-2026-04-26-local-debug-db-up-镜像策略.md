# local-debug 数据库启动策略验证报告（2026-04-26）

## 背景
- 目标：`db-up/dev` 不再“缺镜像时自动拉取”，而是先检查容器复用，再检查本地镜像，缺失时明确失败并给出操作提示。

## 排查顺序与事实
### 1) 先检查容器（存在/运行/可复用）
```powershell
docker ps -a --filter "name=^prompt-assets-local-db$" --format "{{.ID}}\t{{.Names}}\t{{.Status}}\t{{.Image}}"
docker inspect --format "{{.Name}}\t{{.State.Status}}\t{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}" prompt-assets-local-db
```
- 结果摘要：
- `docker ps -a` 未返回任何记录（当前无同名容器）。
- `docker inspect` 报错：`No such object: prompt-assets-local-db`。

### 2) 再检查本地镜像
```powershell
docker image inspect postgres:16-alpine --format "{{.Id}}"
```
- 结果摘要：
- 报错：`No such image: postgres:16-alpine`。

### 3) 当前 db-up 是否会触发拉取（实现层）
- 调整前行为：`db-up` 直接执行 `docker compose -f docker-compose.local-debug.yml up -d postgres`，缺镜像时会触发 compose 默认拉取。
- 调整后行为：`db-up` 先执行容器探测与复用决策，仅在“容器不存在”时检查本地镜像；镜像缺失直接失败，不进入 compose up。

## 验证命令
```powershell
node --test tests/unit/scripts/local-debug.test.mjs
node ./scripts/local-debug.mjs db-up
```

## 验证结果摘要
- 单元测试：`12/12` 通过（含新增 `resolveDbUpMode` 三条策略用例）。
- 脚本实测：`node ./scripts/local-debug.mjs db-up` 在当前“无容器+无镜像”环境下直接失败，提示：
  `Local PostgreSQL image is missing: postgres:16-alpine ... Please run: docker pull postgres:16-alpine`
- 未观察到自动拉取行为。
