# Windows bat 本地调试入口测试记录

日期：2026-04-26

## 变更范围

- 新增根目录 `local-debug.bat`，作为 Windows 本地调试入口。
- 新增单测验证 bat 存在，并将常用入口映射到 `scripts/local-debug.mjs`。

## 测试命令与结果

### RED

命令：

```powershell
node --test tests/unit/scripts/local-debug.test.mjs
```

结果摘要：

- 预期失败。
- 失败原因：`ENOENT: no such file or directory, open 'D:\1work\提示词管理\local-debug.bat'`。
- 说明新增测试能捕获 bat 入口缺失。

### GREEN

命令：

```powershell
node --test tests/unit/scripts/local-debug.test.mjs
```

结果摘要：

- 5 个子测试全部通过。
- 覆盖 `prepare`、`db-up`、`web`、`restart-web`、`stop-web`、`db-down`、`status`、`logs` 到 Node 调试脚本动作的映射。

命令：

```powershell
.\local-debug.bat help
```

结果摘要：

- 退出码 0。
- 输出帮助，列出 `prepare/db-up/web/restart-web/stop-web/db-down/status/logs/dev` 用法。

命令：

```powershell
pnpm test:runtime
```

结果摘要：

- 2 个 runtime 冒烟子测试全部通过。
- Node 输出了既有 `--experimental-strip-types` 与 package `type` 提示，不影响测试通过。
