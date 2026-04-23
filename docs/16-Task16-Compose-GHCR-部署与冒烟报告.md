# Task16 Compose/GHCR 部署与冒烟报告

- 日期：2026-04-23
- 范围：仅 Task16（不包含 Task17/Task18）
- 目标：部署配置改为 GHCR 镜像拉取模式，并补齐冒烟资产

## 改动清单

- `apps/web/Dockerfile`
- `docker-compose.yml`
- `.env.example`
- `scripts/smoke-compose.ps1`
- `tests/concurrency/compose-smoke.md`

## 测试命令

```powershell
docker compose config
docker compose pull
docker compose up -d
docker compose ps
Invoke-WebRequest http://localhost:3000/api/health
```

## 结果摘要

- 静态检查已完成：
  - `docker-compose.yml` 仅包含 `web` 与 `postgres`，且两者均使用 GHCR `image`，未配置 `build`。
  - 镜像命名符合 `docs/ghcr-image-naming.md`：
    - `ghcr.io/<owner>/prompt-assets-web:latest`
    - `ghcr.io/<owner>/prompt-assets-postgres:16-alpine`
  - `postgres` 使用命名卷 `prompt_assets_postgres_data`。
  - 冒烟脚本使用 `pull + up` 流程，不触发本地构建。

- 本机实跑状态：
  - 未在本次提交中强制执行 Docker 实跑验收（符合任务“无需本机 Docker 实跑成功”约束）。
  - 若需实跑，请先配置 `.env` 中 `GHCR_OWNER` 并保证 GHCR 包读取权限。

## 结论

- Task16 所需文件与说明已补齐。
- 当前交付满足“镜像仅由 GitHub Actions 产出并从 GHCR 拉取”的新约束。
