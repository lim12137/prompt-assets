# Publish Images Web Build Validation

日期：2026-04-23

## 变更摘要

- 将 `Publish Images` 工作流中的 web 镜像构建上下文从 `./apps/web` 改为仓库根 `.`。
- 显式指定 Dockerfile 路径为 `./apps/web/Dockerfile`。
- 调整 `apps/web/Dockerfile` 以按 monorepo 布局复制并构建 `apps/web`、`packages/*` 和 `tests/fixtures` 所需文件。

## 验证命令与结果

### 1. Workspace 构建验证

命令：

```powershell
pnpm build:web
```

结果摘要：

- 命令退出码：`0`
- `next build` 成功
- 证明 `apps/web` 在当前仓库根 workspace 下可以正确解析 `packages/*` 与 `tests/fixtures/*` 引用

### 2. Docker 路径与上下文验证

命令：

```powershell
docker build -f apps/web/Dockerfile -t prompt-assets-web:test .
```

结果摘要：

- Docker 成功读取 `apps/web/Dockerfile`
- 构建以上下文 `.` 启动，说明工作流中的 `context`/`file` 路径组合有效
- 失败发生在拉取基础镜像 `node:22-alpine` 元数据阶段，而非 `COPY` 路径或 Dockerfile 语法阶段
- 当前环境报错为访问 `registry-1.docker.io:443` 超时，属于网络/镜像源可达性问题

关键错误片段：

```text
ERROR: failed to solve: node:22-alpine: failed to resolve source metadata for docker.io/library/node:22-alpine
```

## 结论

- 本次修复已覆盖导致 GitHub Actions `Publish Images` web 镜像构建失败的已知根因：web Docker build context 过小，无法包含仓库根 `packages` 与 `tests/fixtures`。
- 本地静态验证通过 workspace 构建证明依赖路径正确；Docker 本地验证已证明新上下文和 Dockerfile 路径可被解析，剩余失败仅是当前机器访问 Docker Hub 的网络问题。
