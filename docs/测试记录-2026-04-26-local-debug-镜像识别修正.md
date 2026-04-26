# local-debug 镜像识别修正验证报告（2026-04-26）

## 目标
- 将本地调试脚本中的 PostgreSQL 本地镜像识别统一为：
  `ghcr.io/lim12137/prompt-assets-postgres`
- 保持策略不变：先检查容器，再检查镜像，不自动拉取。

## 执行命令
```powershell
node --test tests/unit/scripts/local-debug.test.mjs
node ./scripts/local-debug.mjs db-up
```

## 结果摘要
- `node --test tests/unit/scripts/local-debug.test.mjs`
  - 结果：`12/12` 通过，全部成功。
  - 关键点：`buildPostgresImageRef` 与 `ensureLocalPostgresImageAvailable` 用例已验证 GHCR 镜像名。
- `node ./scripts/local-debug.mjs db-up`
  - 结果：按预期失败（退出码 1）。
  - 关键报错：
    `Local PostgreSQL image is missing: ghcr.io/lim12137/prompt-assets-postgres. Refusing to auto-pull in local debug mode. Please run: docker pull ghcr.io/lim12137/prompt-assets-postgres`
  - 结论：缺镜像时直接失败，未触发自动拉取。

## 结论
- 本地调试镜像识别已切换到 `ghcr.io/lim12137/prompt-assets-postgres`。
- “容器优先复用 -> 镜像检查 -> 缺失失败提示”策略保持不变。
