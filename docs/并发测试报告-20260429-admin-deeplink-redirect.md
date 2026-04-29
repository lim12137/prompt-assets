# 并发测试报告：admin 深链登录回跳修复（2026-04-29）

## 目标
- 未登录访问 `/admin/create` 应重定向到 `/login?redirect=%2Fadmin%2Fcreate`
- 未登录访问 `/admin/import` 应重定向到 `/login?redirect=%2Fadmin%2Fimport`
- `/admin` 维持 `/login?redirect=%2Fadmin`

## RED（先失败）
命令：

```bash
node --test --experimental-strip-types tests/unit/auth/admin-redirect.test.ts
```

结果摘要：
- 失败（`ERR_MODULE_NOT_FOUND`），因为当时尚未提供 `apps/web/lib/auth/admin-redirect.ts` 实现。

## GREEN（实现后）
命令：

```bash
node --test --experimental-strip-types tests/unit/auth/admin-redirect.test.ts
node --test --experimental-strip-types tests/unit/auth/session.test.ts
```

结果摘要：
- `admin-redirect.test.ts`：3/3 通过。
- `session.test.ts`：7/7 通过。

## HTTP 验证
说明：本机 `http://127.0.0.1:3011` 运行的是旧进程，未重启前仍返回旧行为；为验证本次代码，临时启动了 `3013` 端口新进程进行检查。

命令（PowerShell）：

```powershell
Invoke-WebRequest -Uri 'http://127.0.0.1:3013/admin/create' -MaximumRedirection 0
Invoke-WebRequest -Uri 'http://127.0.0.1:3013/admin/import' -MaximumRedirection 0
Invoke-WebRequest -Uri 'http://127.0.0.1:3013/admin' -MaximumRedirection 0
```

结果摘要（`Location`）：
- `/admin/create` -> `/login?redirect=%2Fadmin%2Fcreate`
- `/admin/import` -> `/login?redirect=%2Fadmin%2Fimport`
- `/admin` -> `/login?redirect=%2Fadmin`

