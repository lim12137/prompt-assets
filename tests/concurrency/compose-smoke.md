# Compose Smoke Checklist (Task16)

## 目标

- 使用 GHCR 镜像完成 `web + postgres` 两服务启动。
- 不使用本地 `docker compose build` 或 `build:` 配置。

## 预置条件

- 已从 `.env.example` 复制为 `.env` 并设置 `GHCR_OWNER`。
- `ghcr.io/<owner>/prompt-assets-web:latest` 与 `ghcr.io/<owner>/prompt-assets-postgres:16-alpine` 已由 GitHub Actions 发布。

## 启动命令

```powershell
docker compose config
docker compose pull
docker compose up -d
docker compose ps
```

## 健康检查命令

```powershell
Invoke-WebRequest http://localhost:13000/api/health
```

预期响应：`{"status":"ok"}`

## 预期端口

- `13000/tcp`：`web` 对外访问端口
- `5432/tcp`：`postgres` 对外访问端口

## 预期挂载卷

- 命名卷：`prompt_assets_postgres_data`
- 挂载位置：`/var/lib/postgresql/data`

## 失败排查

- `pull access denied`：检查镜像是否已在 GHCR 发布，以及当前账号对包是否有读取权限。
- `GHCR_OWNER is required`：确认 `.env` 中已设置 `GHCR_OWNER`。
- 健康检查失败：执行 `docker compose logs web` 与 `docker compose logs postgres` 查看启动日志。
