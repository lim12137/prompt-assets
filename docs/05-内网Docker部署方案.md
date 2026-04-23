# 内网 Docker 部署方案

方案版本：v1
日期：2026-04-23

部署目标：在内网单机环境中，以 `Docker Compose` 为主部署 Prompt 管理系统，满足试运行与小规模正式使用。

## 1. 部署原则

- 单机部署优先，避免一开始引入 K8s
- 所有持久化数据都走宿主机挂载卷
- 镜像尽量固定版本，不直接跟随 `latest`
- 内网环境优先走离线镜像导入
- 入口统一由 Nginx 反向代理暴露

## 2. 推荐单机拓扑

```mermaid
flowchart LR
    U[内网浏览器] --> N[Nginx]
    N --> W[Web 前端]
    N --> A[Prompt API]
    A --> P[(PostgreSQL)]
    A --> R[(Redis 可选)]
    A --> F[(本地文件卷)]
```

说明：

- `Web 前端`：Prompt 库前台和后台管理界面。
- `Prompt API`：承载 Prompt 元数据、版本、审核、点赞等业务。
- `PostgreSQL`：主数据存储。
- `Redis`：可选，用于缓存、异步任务、限流；一期没有异步任务时可以先不开。
- `本地文件卷`：保存版本快照和导入导出文件。

## 3. 主机要求

建议最低配置：

- CPU：4 Core
- 内存：8 GB
- 磁盘：100 GB SSD

建议正式试运行配置：

- CPU：8 Core
- 内存：16 GB
- 磁盘：200 GB SSD

操作系统建议：

- Ubuntu 22.04 LTS
- Docker Engine 26+
- Docker Compose Plugin 最新稳定版

## 4. 目录规划

建议宿主机目录：

```text
/opt/prompt-hub/
  compose.yaml
  .env
  nginx/
    nginx.conf
    conf.d/
  data/
    postgres/
    redis/
    prompts/
    logs/
  backups/
```

## 5. Compose 服务拆分

### 5.1 必选服务

- `nginx`
- `web`
- `api`
- `postgres`

### 5.2 可选服务

- `redis`
- `worker`

适用条件：

- 需要异步审核通知、批量导入、操作日志异步落库时再启用。

## 6. Compose 示例

以下示例以“单机、内网、业务自定义 API + Web 前端”方式组织，便于后续替换实现细节。

```yaml
services:
  nginx:
    image: nginx:1.27-alpine
    container_name: prompt_nginx
    restart: unless-stopped
    depends_on:
      - web
      - api
    ports:
      - "80:80"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/conf.d:/etc/nginx/conf.d:ro
      - ./data/logs/nginx:/var/log/nginx
    networks:
      - prompt_net

  web:
    image: registry.local/prompt-hub-web:0.1.0
    container_name: prompt_web
    restart: unless-stopped
    environment:
      - APP_BASE_URL=http://prompt.example.local
      - API_BASE_URL=http://api:8080
    depends_on:
      - api
    networks:
      - prompt_net

  api:
    image: registry.local/prompt-hub-api:0.1.0
    container_name: prompt_api
    restart: unless-stopped
    environment:
      - APP_ENV=prod
      - PORT=8080
      - DATABASE_URL=postgresql://prompt_user:${POSTGRES_PASSWORD}@postgres:5432/promptdb
      - FILE_STORAGE_ROOT=/app/data/prompts
      - REDIS_URL=redis://redis:6379/0
      - APP_SECRET=${APP_SECRET}
    depends_on:
      - postgres
    volumes:
      - ./data/prompts:/app/data/prompts
      - ./data/logs/api:/app/logs
    networks:
      - prompt_net

  postgres:
    image: postgres:16-alpine
    container_name: prompt_postgres
    restart: unless-stopped
    environment:
      - POSTGRES_DB=promptdb
      - POSTGRES_USER=prompt_user
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
    volumes:
      - ./data/postgres:/var/lib/postgresql/data
    networks:
      - prompt_net

  redis:
    image: redis:7-alpine
    container_name: prompt_redis
    restart: unless-stopped
    command: ["redis-server", "--appendonly", "yes"]
    volumes:
      - ./data/redis:/data
    networks:
      - prompt_net

networks:
  prompt_net:
    driver: bridge
```

## 7. `.env` 建议

```dotenv
POSTGRES_PASSWORD=replace_me
APP_SECRET=replace_me_with_long_random_string
```

要求：

- `POSTGRES_PASSWORD` 不得使用弱口令
- `APP_SECRET` 使用不少于 32 字节随机串

## 8. 内网镜像准备

如果服务器无法访问公网，按以下方式准备：

1. 在可联网机器拉取基础镜像
2. 用 `docker save` 导出
3. 通过内网介质传入目标机
4. 用 `docker load` 导入
5. 业务镜像统一推送到内网镜像仓库或离线导入

建议固定镜像版本：

- `nginx:1.27-alpine`
- `postgres:16-alpine`
- `redis:7-alpine`
- 业务镜像使用明确语义版本号，例如 `0.1.0`

## 9. 上线步骤

### 9.1 首次部署

1. 安装 Docker Engine 与 Docker Compose Plugin
2. 创建 `/opt/prompt-hub` 目录结构
3. 放置 `compose.yaml`、`.env`、Nginx 配置
4. 导入所需镜像
5. 执行 `docker compose up -d`
6. 检查 `postgres`、`api`、`web`、`nginx` 状态
7. 初始化管理员账号
8. 导入基础分类
9. 用浏览器走通首页、详情、复制、投稿、审核链路

### 9.2 升级部署

1. 备份数据库与 `data/prompts`
2. 替换业务镜像版本
3. 执行 `docker compose pull`
4. 执行 `docker compose up -d`
5. 执行数据库迁移
6. 冒烟测试

## 10. Nginx 反向代理建议

建议提供两个入口：

- `http://prompt.example.local`
- `https://prompt.example.local`（正式环境推荐）

代理要求：

- 前端静态资源走 `web`
- `/api/` 路由转发到 `api`
- 启用访问日志
- 限制请求体大小，避免异常大文件上传

## 11. 备份与恢复

### 11.1 备份对象

- PostgreSQL 数据目录或逻辑备份
- `data/prompts` 版本快照目录
- `.env`
- Nginx 配置

### 11.2 建议频率

- 数据库：每天一次逻辑备份
- 版本快照目录：每天一次增量备份
- 发布前：额外做一次全量备份

### 11.3 恢复原则

- 先恢复数据库，再恢复 `prompts` 文件卷
- 恢复后执行只读校验，确认 `current_version_id` 与文件目录一致

## 12. 安全建议

- 内网也不要暴露数据库端口到宿主机
- 管理员入口至少走 IP 白名单或统一认证
- 关闭默认口令
- 业务容器日志中禁止打印完整 Prompt 敏感内容
- 生产环境强制 HTTPS

## 13. 运维检查项

日常检查：

- `docker compose ps`
- 容器重启次数
- PostgreSQL 磁盘使用率
- `data/prompts` 目录增长速度
- Nginx 访问日志和错误日志

建议设置阈值：

- 磁盘使用率超过 80% 告警
- API 错误率超过 2% 告警
- 单日投稿失败率超过 5% 告警

## 14. 为什么不建议一期直接部署 Langfuse 或 Dify

原因不是它们不能单机 Compose，而是：

- Langfuse 的工程平台属性更强，基础设施偏重
- Dify 的服务编排更复杂，远超当前项目范围
- 当前系统最重要的是“Prompt 库体验”，不是“平台功能堆叠”

## 15. 实施结论

一期采用“单机 Docker Compose + Web/API/PostgreSQL + 文件卷”的部署形态最稳妥。它满足：

- 快速上线
- 低运维门槛
- 后续可平滑扩展 Redis/Worker
- 数据可备份、可迁移、可审计
