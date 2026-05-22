# 并发测试报告-20260522-copy-fallback-hotfix

## 变更目标

将 `fix/web-hotfix-2026-05-21` 中的复制热修合并到正式源码，确保在 `navigator.clipboard` 不可用或无权限时，首页卡片复制、详情卡片复制、详情当前版本复制仍可回退到 `document.execCommand("copy")`。

## 执行命令

```powershell
node --test --experimental-strip-types apps/web/tests/copy-fallback.test.ts
```

```powershell
node --test --experimental-strip-types apps/web/tests/copy-fallback.test.ts apps/web/tests/prompt-detail-page.test.ts apps/web/tests/prompt-detail-version-score-entry.test.ts
```

## 结果摘要

- `apps/web/tests/copy-fallback.test.ts`：通过。验证 `_copy-card-button.js` 与 `_prompt-actions.js` 的 `writeTextWithFallback` 在缺少 `navigator.clipboard` 时会回退到 `document.execCommand("copy")` 并返回成功。
- `apps/web/tests/prompt-detail-page.test.ts`：未通过，失败原因为当前仓库的 Node 直跑方式无法解析依赖链中的 `.jsx` 文件，报错 `ERR_UNKNOWN_FILE_EXTENSION: ".jsx"`。
- `apps/web/tests/prompt-detail-version-score-entry.test.ts`：未通过，失败原因同上，为 `.jsx` 解析限制，不是本次热修逻辑回归。

## 结论

- 本次热修的核心回归点已通过最小自动化验证。
- 仓库现有部分 `apps/web/tests` 依赖 Node 直接加载 `.jsx`，当前执行方式下存在环境限制；本次未修改该测试基础设施。
