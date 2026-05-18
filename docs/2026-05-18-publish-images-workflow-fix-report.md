# publish-images workflow 修复报告

日期：2026-05-18

## 变更目标

- 修复 `.github/workflows/publish-images.yml`
- 让 `web` 镜像发布为 `linux/amd64` + `linux/arm64` 多架构
- 让 `postgres` 发布改为复制上游多架构 manifest，而不是重新 push runner 本机拉到的单架构镜像
- 增加最小可运行检查，约束上述行为

## 修改文件

- `.github/workflows/publish-images.yml`
- `tests/unit/scripts/publish-images-workflow.test.mjs`

## 执行命令

```powershell
git rev-parse --show-toplevel
Get-Content .github/workflows/publish-images.yml
Get-Content package.json
Get-Content apps/web/package.json
node --test tests/unit/scripts/publish-images-workflow.test.mjs
node --test tests/unit/scripts/publish-images-workflow.test.mjs
act --version
git diff -- .github/workflows/publish-images.yml tests/unit/scripts/publish-images-workflow.test.mjs
git diff --check -- .github/workflows/publish-images.yml tests/unit/scripts/publish-images-workflow.test.mjs
```

## 结果摘要

### 1. TDD 红灯

首次运行：

```text
node --test tests/unit/scripts/publish-images-workflow.test.mjs
```

结果：

- 失败 2 个测试
- 失败原因符合预期：
  - workflow 缺少 `docker/setup-qemu-action`
  - workflow 缺少 `docker/setup-buildx-action`
  - `web` 未声明 `platforms: linux/amd64,linux/arm64`
  - `postgres` 仍使用 `docker pull/tag/push`

### 2. 修复后绿灯

再次运行：

```text
node --test tests/unit/scripts/publish-images-workflow.test.mjs
```

结果：

- 2/2 测试通过
- 已确认：
  - `web` 构建步骤包含 `platforms: linux/amd64,linux/arm64`
  - workflow 包含 `setup-qemu` 与 `setup-buildx`
  - `postgres` 改为 `docker buildx imagetools create --tag ... docker.io/library/postgres:16-alpine`
  - 不再出现 `docker pull/tag/push postgres:16-alpine`

### 3. 其他验证

```text
git diff --check -- .github/workflows/publish-images.yml tests/unit/scripts/publish-images-workflow.test.mjs
```

结果：

- 未发现 patch 格式问题
- 仅有 Git CRLF 警告，不影响本次逻辑修改

```text
act --version
```

结果：

- 当前环境未安装 `act`
- 因此未执行 GitHub Actions 本地 runner 级别演练

## 最终行为

- `web` 将通过 `docker/build-push-action@v6` 推送 GHCR 多架构镜像
- `postgres` 将通过 `docker buildx imagetools create` 将上游 `postgres:16-alpine` 的 manifest list 复制到 GHCR，从而保留上游多架构信息

## 剩余风险

- 本次验证主要是静态行为约束测试，没有真实执行 GitHub Actions job
- `postgres:16-alpine` 上游标签未来若发生 manifest 结构变化，当前 workflow 仍依赖上游标签存在且可被 `imagetools create` 访问
- 若仓库后续需要为 `web` 增加更多 tag（如 commit sha、semver），当前测试只约束了 `latest` 和多架构行为
