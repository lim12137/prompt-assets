# 首页数据库降级控制台报错修复报告

## 背景

- 问题时间：2026-05-25
- 现象：首页在 `auto` 模式下调用 `listPrompts()` 时，如果真实数据库不可读，会在 Next.js 开发环境显示 `Console Error`
- 相关报错：

```text
listPrompts requires a readable database in auto mode. Refusing to fallback to fixture prompts because it can surface initial seeded data unexpectedly.
```

## 根因结论

- 底层根因：当前环境的真实数据库不可读，`prompt-repository` 在 `auto` 模式下按设计拒绝静默回退到 fixture。
- 表层根因：`apps/web/app/page.jsx` 已经捕获这类错误并进入“空白调试态”，但随后又执行了 `console.error(error)`，导致 Next.js 开发环境继续把这条已处理错误显示为控制台错误覆盖层。

## 修复内容

- 新增 `apps/web/app/home-page-load-state.ts`
  - 抽离首页提示词加载失败的判定逻辑
  - 明确区分“应降级展示”与“应继续抛出”
- 修改 `apps/web/app/page.jsx`
  - 接入 `resolveHomePagePromptLoadError()`
  - 保留数据库不可读时的首页空白调试态提示
  - 移除这类预期降级错误的 `console.error(error)`
- 新增 `tests/unit/home/home-page-load-state.test.ts`
  - 覆盖数据库不可读时的降级结果
  - 覆盖非预期错误继续抛出

## 测试命令

```powershell
node --test --experimental-strip-types tests/unit/home/home-page-load-state.test.ts
node --test --experimental-strip-types tests/unit/api/prompt-repository-auto-no-fixture-fallback.test.ts tests/unit/api/prompt-repository-data-source-mode.test.ts
```

## 测试结果摘要

- `tests/unit/home/home-page-load-state.test.ts`
  - 2/2 通过
  - 验证数据库不可读错误进入空白调试态，且不再要求输出控制台错误
- `tests/unit/api/prompt-repository-auto-no-fixture-fallback.test.ts`
  - 1/1 通过
  - 验证 `auto` 模式下数据库不可读时，`listPrompts()` 仍拒绝静默回退 fixture
- `tests/unit/api/prompt-repository-data-source-mode.test.ts`
  - 2/2 通过
  - 验证显式 `fixture` 模式可返回 fixture 数据，`auto` 模式继续抛错

## 结论

- 本次修复没有改变 `prompt-repository` 的数据源策略。
- 仅修正首页对“已处理降级错误”的呈现方式，避免开发环境出现误导性的 `Console Error`。
- 如果要彻底消除首页降级提示，仍需修复真实数据库连通性或显式切换到 `PROMPT_REPOSITORY_DATA_SOURCE=fixture`。
