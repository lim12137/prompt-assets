# QA 报告：修复登录后显示 `viewport"`（2026-04-30）

## 背景
- 问题现象：登录后右上角显示 `viewport"` + `退出`。
- 根因假设：OA 返回 HTML 含 `<meta name="viewport">`，被宽泛正则误识别为姓名。

## RED（先失败）
- 命令：
```bash
node --test --experimental-strip-types tests/unit/auth/oa-client.test.ts
```
- 结果摘要：
  - 新增用例 `authenticateWithOa: HTML 含 meta viewport 时不应将 viewport 解析为姓名` 失败。
  - 失败断言：实际姓名为 `viewport"`，预期为 `张三`。

## GREEN（修复后）
- 命令：
```bash
node --test --experimental-strip-types tests/unit/auth/oa-client.test.ts
node --test --experimental-strip-types tests/unit/auth/session.test.ts
pnpm exec playwright test tests/e2e/smoke/global-auth-header.spec.ts
```
- 结果摘要：
  - `oa-client.test.ts`：3/3 通过。
  - `session.test.ts`：7/7 通过。
  - `global-auth-header.spec.ts`：3/3 通过（含“无部门不显示 undefined/null”新增验证）。

## 修复点
- `apps/web/lib/auth/oa-client.ts`
  - 删除宽泛 `name=...` 风格匹配，避免命中 HTML 属性。
  - 文本解析仅保留业务安全模式：
    - JSON 样式键值：`"字段": "值"`
    - 标签样式：`字段: 值` / `字段：值`
  - 解析不到姓名时回退 `username`（既有逻辑保留）。

## 运行态复验建议
- 若 3013 页面仍看到旧值，可能是旧 cookie 未失效。
- 先调用 `/api/logout` 清 cookie，再重新登录验证右上角身份显示。
