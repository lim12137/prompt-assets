# local-debug.bat 闪退根因定位与修复测试记录（2026-04-26）

工作目录：`D:\1work\提示词管理`

## 1. 复现与定位（真实 Windows `cmd /c` / 双击等效）

### 1.1 跨目录执行（验证相对路径/工作目录风险）
命令：
```powershell
cmd.exe /d /s /c "D:\1work\提示词管理\local-debug.bat help"
```
执行目录：`C:\`

结果摘要：
- 成功输出 usage 与 action 列表，退出码 `0`。
- 说明 `.bat` 入口可跨目录运行，不依赖调用方当前目录。

### 1.2 双击环境 PATH 缩减（验证 node 可见性）
命令：
```powershell
cmd.exe /d /s /c "set LOCAL_DEBUG_NO_PAUSE=1&&set PATH=C:\Windows\System32&&D:\1work\提示词管理\local-debug.bat"
```
执行目录：`C:\`

结果摘要：
- 输出：
  - `[local-debug] Node.js was not found in PATH.`
  - `[local-debug] Install Node.js or run from a terminal where node is available.`
- 退出码 `1`。
- 证明双击环境下若 `node` 不可见会直接失败，属于“闪退”高频触发条件。

### 1.3 Docker/DB 启动失败（验证是否会被误判为闪退）
命令：
```powershell
cmd.exe /d /s /c "set LOCAL_DB_CONTAINER_NAME=__missing_container__&&set LOCAL_POSTGRES_IMAGE=ghcr.io/lim12137/does-not-exist:debug&&echo.|D:\1work\提示词管理\local-debug.bat"
```
执行目录：`C:\`

结果摘要：
- 输出失败原因：`[local-debug] Local PostgreSQL image is missing: ...`
- 输出停留提示：`[local-debug] Startup failed. Press any key to close this window...`
- 退出码 `1`。
- 结论：此前这类失败会快速退出并被用户感知为“闪退”；修复后会明确提示并停住等待确认。

### 1.4 长运行链路（web）是否提前退出
命令：
```powershell
cmd.exe /d /s /c "set LOCAL_DEBUG_NO_PAUSE=1&&local-debug.bat web"
```
执行目录：`D:\1work\提示词管理`，超时阈值 `20s`。

结果摘要：
- 命令在测试器侧超时（`124`），未出现“启动即退出”。
- 说明 `scripts/local-debug.mjs` 的 web 长运行链路未发生立即退出问题。

## 2. 代码级验证

命令：
```powershell
node --test tests/unit/scripts/local-debug.test.mjs
```

结果摘要：
- `13/13` 通过。
- 覆盖点包含：
  - `.bat` 默认无参数仍为 `dev`。
  - `.bat` 分发映射到 `scripts/local-debug.mjs` 动作。
  - `node` 缺失时会输出明确错误（无声退出回归用例）。

## 3. 结论

- 真实根因不是单一语法问题，而是“默认 `dev` 链路失败后窗口立即关闭”导致的体感闪退。
- 触发失败的具体场景包括：
  - 双击环境中 `node/pnpm` 不可见。
  - Docker/DB 初始化失败（镜像缺失等）。
- 修复后：双击默认 `dev` 保持不变，失败时会显示明确原因并停住窗口，避免“无声闪退”。
