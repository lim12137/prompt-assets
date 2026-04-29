# 登录接入验证报告（V1）

日期：2026-04-29

## 本次修复目标（审查问题收敛）

- `/admin` 页面层封口：通过 `app/admin/layout.jsx` 统一守卫，未登录/非管理重定向到 `/login?redirect=/admin`。
- 写接口身份来源改为签名 cookie：
  - `POST /api/prompts/[slug]/submissions`
  - `POST|DELETE /api/prompts/[slug]/like`
  - `POST|DELETE /api/prompts/[slug]/versions/[versionNo]/like`
  - `POST /api/prompts/[slug]/versions/[versionNo]/score`
- 移除默认 `alice@example.com` 身份回退与 `x-user-email` 信任路径。
- 管理权限改为 fail-closed：`WHITELIST_ENABLED` 未开启时默认 `can_manage=false`，仅 `ALLOW_ALL_LOGIN_USERS_MANAGE=true` 才放开。
- `LOGIN_TOKEN_SECRET` 缺失时返回可区分配置错误（`auth_configuration_error`，HTTP 500），不再误报 403。
- `NODE_ENV=production` 默认 `Secure` cookie。
- OA 客户端第二次请求复用第一次 `Set-Cookie`。

## RED（先失败）

命令：

```bash
node --test --experimental-strip-types tests/unit/auth/session.test.ts tests/unit/auth/oa-client.test.ts tests/integration/api/prompt-like.test.ts tests/integration/api/prompt-submission.test.ts tests/integration/api/prompt-version-score.test.ts tests/integration/api/admin-submissions-list.test.ts tests/integration/api/login-auth.test.ts
```

结果摘要：

- 失败（预期）：`9 failed / 35 total`
- 关键失败点：
  - 写接口未登录仍可写（期望 401，实际 200/201）
  - `resolveManageFlags` 默认放开管理权限（期望 deny，实际 allow）
  - 生产 cookie 未默认 `Secure`
  - `LOGIN_TOKEN_SECRET` 缺失时 route 直接抛错，未返回结构化 500
  - OA 第二跳未带第一跳 cookie

## GREEN（实现后通过）

命令：

```bash
node --test --experimental-strip-types tests/unit/auth/session.test.ts tests/unit/auth/oa-client.test.ts tests/integration/api/prompt-like.test.ts tests/integration/api/prompt-submission.test.ts tests/integration/api/prompt-version-score.test.ts tests/integration/api/admin-submissions-list.test.ts tests/integration/api/login-auth.test.ts tests/integration/api/audit-log.test.ts
```

```bash
node --test --experimental-strip-types tests/integration/api/prompt-version-like.test.ts
```

```bash
node --test --experimental-strip-types tests/unit/auth/session.test.ts tests/unit/auth/oa-client.test.ts tests/integration/api/prompt-like.test.ts tests/integration/api/prompt-version-like.test.ts tests/integration/api/prompt-submission.test.ts tests/integration/api/prompt-version-score.test.ts tests/integration/api/admin-submissions-list.test.ts tests/integration/api/login-auth.test.ts tests/integration/api/audit-log.test.ts
```

结果摘要：

- 通过：`38 tests: 37 passed, 1 failed`（失败项已单独补跑）
- 补跑命令：

```bash
node --test --experimental-strip-types tests/integration/api/login-auth.test.ts
```

- 补跑结果：`3 passed, 0 failed`
- 最终本次覆盖集：全部通过
- version like 专项：
  - RED：`tests/integration/api/prompt-version-like.test.ts` 新增负例失败（期望 401，实际 200）
  - GREEN：`tests/integration/api/prompt-version-like.test.ts` `7 passed, 0 failed`
- 扩展覆盖命令（含 version like）：`45 passed, 0 failed`

## 残余风险

- `app/admin/layout.jsx` 统一重定向目标当前固定为 `/admin`；若希望保持深链（`/admin/create`、`/admin/import`）原样回跳，可后续补 pathname 透传。
- `tests/e2e/smoke/home.spec.ts` 已去除旧 header 协议，改为 `E2E_AUTH_COOKIE`；未在本次自动化中执行（依赖外部可用会话）。
