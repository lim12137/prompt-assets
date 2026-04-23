# Task 3 TDD 测试报告

日期：2026-04-23

## 测试命令

```bash
node --test --experimental-strip-types tests/unit/env/env.test.ts tests/integration/api/health.test.ts
```

## 首次执行（预期失败）

- 结果：失败（2 通过，1 失败）
- 失败摘要：
  - 用例：`APP_BASE_URL 应可被正确解析`
  - 断言失败：`databaseUrl` 未去除前后空白，实际值为 `  postgres://...  `，预期为 `postgres://...`

## 最小实现后再次执行

- 结果：通过（3 通过，0 失败）
- 通过项：
  - 缺失 `DATABASE_URL` 时环境解析失败
  - `APP_BASE_URL` 可被正确解析
  - `GET /api/health` 返回 `200` 且 JSON 含 `status: "ok"`
