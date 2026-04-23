# Task 15 视觉基线测试报告

日期：2026-04-23

## TDD 失败阶段（Red）

测试命令：

```bash
pnpm exec playwright test tests/e2e/ui/visual-baseline.spec.ts
```

结果摘要：

- 2/2 失败。
- 失败点：首页与详情页 `body` 的 `background-color` 期望 `rgb(10, 15, 28)`，实际为 `rgba(0, 0, 0, 0)`。
- 说明：视觉基线样式尚未建立，符合先写失败测试的预期。

## TDD 通过阶段（Green）

测试命令：

```bash
pnpm exec playwright test tests/e2e/ui/visual-baseline.spec.ts
```

结果摘要：

- 2/2 通过。
- 首页与详情页的深色背景、卡片边框、主标题样式、主按钮/关键交互按钮样式断言全部通过。

## 相关回归（并发执行）

测试命令：

```bash
pnpm exec playwright test tests/e2e/smoke/home.spec.ts tests/e2e/smoke/prompt-detail-copy.spec.ts tests/e2e/ui/visual-baseline.spec.ts
```

结果摘要：

- Playwright 3 workers 并发执行，共 6/6 通过。
- 通过项包含：首页 smoke、详情复制 smoke、新增 visual baseline。
