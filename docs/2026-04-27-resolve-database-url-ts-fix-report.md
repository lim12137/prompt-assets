# resolveDatabaseUrl TS 类型修复验证报告（2026-04-27）

## 变更目标
- 修复 `pnpm build:web` 中 `resolveDatabaseUrl` 与 `NodeJS.ProcessEnv` 的类型不兼容错误。
- 保持运行时行为不变，仅做最小类型签名修复。

## 变更文件
- `apps/web/resolve-database-url.typecheck.ts`（新增：类型覆盖）
- `packages/db/src/resolve-database-url.ts`（修改：参数类型兼容 `ProcessEnv`）

## TDD 验证记录
1. RED（先失败）
- 命令：`pnpm build:web`
- 结果：失败
- 关键报错：
  - `./resolve-database-url.typecheck.ts:5:20`
  - `Type 'ProcessEnv' has no properties in common with type 'DatabaseEnvInput'.`

2. GREEN（最小修复后）
- 命令：`node --test --experimental-strip-types tests/unit/db/resolve-database-url.test.ts`
- 结果：通过（3/3）

3. 构建验证
- 命令：`pnpm build:web`
- 结果：首次失败（Next.js 构建进程 OOM，非类型报错）
- 命令：`$env:NODE_OPTIONS='--max-old-space-size=4096'; pnpm build:web`
- 结果：通过（Next.js build 完成）

## 结论
- `resolveDatabaseUrl` 已可接收 `NodeJS.ProcessEnv`。
- 相关单测通过，`build:web` 在提高 Node 堆内存后通过。
