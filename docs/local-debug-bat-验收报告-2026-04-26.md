# Windows 本地调试入口（`.bat`）验收报告

日期：2026-04-26  
工作目录：`D:\1work\提示词管理`

## 1. 目标与范围

- 目标：验证 `local-debug.bat` 可作为 Windows 直接运行入口，支持以下动作：
`prepare`、`db-up`、`web`、`restart-web`、`stop-web`、`db-down`、`status`、`logs`，并具备默认帮助/安全默认行为。
- 范围：优先复用 `scripts/local-debug.mjs` 与现有 `pnpm local:*` 设计，不改动核心运行逻辑，仅补齐入口行为验证覆盖。

## 2. TDD/验证策略说明

- 仓库现有 Node 单测体系可直接覆盖脚本与文本映射，因此先补测试，再执行验证。
- 对 `.bat` 入口的“真实进程行为”（无参数/非法参数）采用 `cmd.exe` 脚本级验证，避免触发 `db-up/web` 等重型动作造成环境副作用。

## 3. 执行命令与结果摘要

1. 命令：
```powershell
node --test tests/unit/scripts/local-debug.test.mjs
```
结果摘要：
- `6/6` 通过，新增用例 `local-debug.bat uses safe defaults for empty action and unknown action` 通过。
- 既有用例继续通过，确认 `.bat` 到 `local-debug.mjs` 的动作映射完整（含 `status -> db-status`、`logs -> db-logs`）。

2. 命令：
```powershell
cmd.exe /d /s /c "local-debug.bat"
```
结果摘要：
- 退出码 `0`。
- 输出帮助信息与动作列表，符合“默认帮助/安全默认动作”要求。

3. 命令：
```powershell
cmd.exe /d /s /c "local-debug.bat unknown-action"
```
结果摘要：
- 退出码 `1`。
- 输出 `Unknown action` 与用法提示，符合“非法动作安全失败”要求。

## 4. 改动文件

- `tests/unit/scripts/local-debug.test.mjs`
  - 新增 Windows `.bat` 入口行为测试：无参数帮助 + 非法参数失败。

## 5. 验收结论

- `local-debug.bat` 已满足本次约束动作集合与安全默认行为。
- 入口复用了既有 `scripts/local-debug.mjs` 运行路径，未引入额外复杂改造。
