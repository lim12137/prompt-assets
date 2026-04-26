# 测试记录：local-debug 镜像 tag 修复与本地端口 3010（2026-04-26）

## 目标
- 修复 `Local PostgreSQL image is missing: ghcr.io/lim12137/prompt-assets-postgres` 的误报。
- 保持本地调试策略：先复用容器，再检查镜像，不自动拉取。
- 将本地 Web 默认端口统一为 `3010`，并同步脚本与测试。

## 执行命令与结果摘要

### 1) Docker 事实核查
```powershell
docker images
docker image inspect ghcr.io/lim12137/prompt-assets-postgres
docker image inspect ghcr.io/lim12137/prompt-assets-postgres:16-alpine
docker ps -a
```

结果摘要：
- `docker images` 显示本机存在 `ghcr.io/lim12137/prompt-assets-postgres:16-alpine`（无 `latest`）。
- `docker image inspect ghcr.io/lim12137/prompt-assets-postgres` 失败，错误为 `No such image ...:latest`。
- `docker image inspect ghcr.io/lim12137/prompt-assets-postgres:16-alpine` 成功，镜像 ID 为 `sha256:e34f4120a6b4...`。
- `docker ps -a` 显示已有相关容器：`prompt-management-test-db`，镜像为 `ghcr.io/lim12137/prompt-assets-postgres:16-alpine`。

### 2) 代码与配置验证
```powershell
node --test tests/unit/scripts/local-debug.test.mjs
node --test --experimental-strip-types tests/unit/env/env.test.ts
node -e "import('./scripts/local-debug.mjs').then(({resolveLocalDebugConfig})=>{const c=resolveLocalDebugConfig({});console.log(JSON.stringify({webPort:c.webPort,appBaseUrl:c.appBaseUrl,postgresImage:c.postgresImage}));})"
node -e "import('./scripts/local-debug.mjs').then(({resolveLocalDebugConfig,resolveDbUpMode})=>{const cfg=resolveLocalDebugConfig({LOCAL_DB_CONTAINER_NAME:'__missing_container__',LOCAL_POSTGRES_IMAGE:'ghcr.io/lim12137/prompt-assets-postgres'});console.log(resolveDbUpMode(cfg));})"
```

结果摘要：
- `tests/unit/scripts/local-debug.test.mjs`：13/13 通过。
- `tests/unit/env/env.test.ts`：3/3 通过。
- 默认配置输出为 `webPort=3010`、`appBaseUrl=http://127.0.0.1:3010`、`postgresImage=...:16-alpine`。
- 在容器不存在且镜像引用为无 tag 仓库名时，`resolveDbUpMode` 返回 `compose-up-new-container`，未再误报缺镜像。

## 结论
- 误报根因是“无 tag 镜像名被 Docker 当作 `:latest` 检查”，而本机实际仅有 `:16-alpine`。
- 修复后可正确识别本机已有 Postgres 镜像（含无 tag 引用兜底识别），且本地 Web 默认端口已统一为 `3010`。
