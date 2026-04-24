# 测试记录（2026-04-24）M1-Task2 管理员创建首版 Prompt API

## TDD Red

### 命令
```powershell
pnpm exec node --test --experimental-strip-types tests/integration/api/prompt-create.test.ts
```

### 结果摘要
- 失败（符合预期）。
- 关键报错：`apps/web/app/api/prompts/route.ts` 未导出 `POST`。

## TDD Green

### 命令
```powershell
pnpm exec node --test --experimental-strip-types tests/integration/api/prompt-create.test.ts
```

### 结果摘要
- 通过：`5 passed, 0 failed`。
- 覆盖点：
  - admin 创建首版成功（`v0001` + `sourceType=create` + 可读取详情）
  - 非 admin 禁止
  - 必填缺失
  - slug 冲突
  - 分类不存在
  - 审计日志 `prompt.created`

## 相关回归验证

### 命令
```powershell
pnpm exec node --test --experimental-strip-types tests/integration/api/prompt-submission.test.ts
pnpm exec node --test --experimental-strip-types tests/integration/api/audit-log.test.ts
$env:PROMPT_REPOSITORY_DATA_SOURCE='fixture'; pnpm exec node --test --experimental-strip-types tests/integration/api/prompts-list.test.ts
```

### 结果摘要
- `prompt-submission.test.ts`：`8 passed, 0 failed`
- `audit-log.test.ts`：`3 passed, 0 failed`
- `prompts-list.test.ts`（fixture 模式）：`4 passed, 0 failed`
