# QA 报告：登录后全局 Header 状态刷新

日期：2026-04-30

## 问题
- 首次登录成功后，右上角全局登录状态未立即刷新，需切换页面后才显示用户信息。

## RED（先失败）
命令：

```bash
pnpm playwright test tests/e2e/smoke/global-auth-header.spec.ts --grep "登录成功后回到原页面时右上角立即刷新为已登录态"
```

结果摘要：
- 失败（1 failed）
- 失败断言：回跳到详情页后，`[data-testid='global-auth-header']` 中“登录”链接仍存在（count=1），未显示已登录身份。

## 修复
- 在 `apps/web/app/login/page.jsx` 登录成功分支中，`router.replace(...)` 后补充 `router.refresh()`，强制刷新当前路由的服务端渲染数据，确保 Header 重新读取 cookie。

## GREEN（回归通过）
命令：

```bash
pnpm playwright test tests/e2e/smoke/global-auth-header.spec.ts --grep "登录成功后回到原页面时右上角立即刷新为已登录态"
pnpm playwright test tests/e2e/smoke/global-auth-header.spec.ts
```

结果摘要：
- 单测场景：1 passed
- `global-auth-header` 全量：4 passed
- 覆盖登录后立即刷新与退出后立即回到“登录”。

## 3013 页面验证
命令：

```bash
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:3013/api/health
```

结果摘要：
- HTTP 200，服务可用。
- 本次 e2e 通过结果验证了登录后 Header 立即刷新与退出即时回退链路。
