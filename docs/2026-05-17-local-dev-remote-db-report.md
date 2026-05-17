# local:dev 远端数据库验证报告

## 变更

- 调整 `scripts/local-debug.mjs`
- `buildExecutionPlan("dev")` 从 `["db-up", "db-migrate", "web"]` 改为 `["db-migrate", "web"]`
- 保留 `prepare`、`db-up` 等命令原有 Docker 行为不变

## 验证命令

```bash
node --test tests/unit/scripts/local-debug.test.mjs
pnpm run local:dev
```

## 结果摘要

- `node --test tests/unit/scripts/local-debug.test.mjs` 通过
- `pnpm run local:dev` 未再在 Docker 阶段失败，进程持续运行至命令超时
- `http://127.0.0.1:3010/api/health` 返回 `200`
- `Get-NetTCPConnection -LocalPort 3010` 显示本地已监听 `127.0.0.1:3010`

## 结论

- `local:dev` 现已按远端数据库 `10.45.131.70` 路径启动
- 本地 Docker Desktop Linux Engine 不再是 `local:dev` 的前置依赖

