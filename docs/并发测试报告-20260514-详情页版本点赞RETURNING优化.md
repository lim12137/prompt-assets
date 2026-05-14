# 并发测试报告-20260514-详情页版本点赞RETURNING优化

## 任务目标
- 将详情页版本点赞后端在 DB 路径中的 `readPromptVersionLikesCount(...)` 回读替换为写语句 `UPDATE ... RETURNING likes_count`，减少 1 次 SQL 往返。
- 保持点赞/取消点赞返回值与审计日志的 `likesCount` 口径一致。
- 保持“单次请求只定位一次目标版本”的既有优化不回退。

## TDD 过程（RED -> GREEN）
1. RED：
```powershell
node --test --experimental-strip-types tests/unit/api/prompt-version-like-returning.test.ts
```
- 结果：失败（1 failed）。
- 失败点：`likePromptVersionInDb` / `unlikePromptVersionInDb` 尚未包含 `UPDATE ... RETURNING likes_count`。

2. GREEN（实现后复跑）：
```powershell
node --test --experimental-strip-types tests/unit/api/prompt-version-like-returning.test.ts
```
- 结果：通过（1 passed）。

## 回归验证命令
```powershell
node --test --experimental-strip-types tests/integration/api/prompt-version-like.test.ts
```

```powershell
pnpm db:test:prepare
```

## 结果摘要
- `tests/unit/api/prompt-version-like-returning.test.ts`：RED 失败后，GREEN 通过。
- `tests/integration/api/prompt-version-like.test.ts`：11 passed / 2 skipped / 0 failed。
- 跳过原因：本机 Docker 引擎不可用，真实 PG 用例（含 DB 路径“单次目标定位”与 fail-closed）被自动 skip。
- `pnpm db:test:prepare` 失败：`dockerDesktopLinuxEngine` pipe 不存在，无法启动测试库容器。

## 结论
- 版本点赞与取消点赞 DB 路径已改为 `UPDATE ... RETURNING likes_count` 回读。
- 避免了原先 `readPromptVersionLikesCount(...)` 的额外查询往返。
- 返回 payload 与审计日志均使用同一 `likesCount` 值，口径一致。
