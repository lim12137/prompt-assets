# local-debug.bat 调试修复报告（2026-04-26）

## 目标
修复 `local-debug.bat` “运行后闪退/无法持续使用”问题，兼容：
- 双击 `.bat`
- 在已有命令行窗口执行 `local-debug.bat ...`

## 根因定位
1. `local-debug.bat` 无参数时直接进入 `help` 后 `exit /b 0`。
   - 双击场景通常由 `cmd /c` 启动，脚本结束即窗口关闭，表现为“闪退”。
2. `scripts/local-debug.mjs` 入口判断在 Windows 下不成立：
   - 原逻辑：`import.meta.url === "file://" + process.argv[1].replace(...)`
   - Windows 实际为 `file:///D:/...`，字符串不相等，`main()` 未执行。
   - 导致 `local-debug.bat web` 等 action 看起来“启动后立即退出/无输出”。

## 修改内容
1. `local-debug.bat`
   - 无参数入口由 `goto help` 改为 `goto help_interactive`。
   - 新增 `:help_interactive`：显示帮助后通过 `choice` 提供 `[1] dev / [2] web / [Q] quit`。
   - 保持原有 action 分发不变（prepare/db-up/web/restart-web/stop-web/db-down/status/logs/dev）。
2. `scripts/local-debug.mjs`
   - 入口判断改为 `pathToFileURL(process.argv[1]).href` 与 `import.meta.url` 比较，确保 Windows 直跑能执行 `main()`。

## 验证命令与结果摘要
### A. 双击等价（`cmd /c`）无参数不再秒退
命令：
```powershell
cmd /c "echo Q|local-debug.bat"
```
结果摘要：
- 输出帮助与交互菜单。
- 选择 `Q` 后正常退出码 `0`。
- 说明无参数场景不再“瞬间关闭不可见”。

### B. 参数错误分支
命令：
```powershell
cmd /c "local-debug.bat unknown"
```
结果摘要：
- 输出 `Unknown action` 和 usage。
- 退出码 `1`（符合预期）。

### C. 现有终端执行短 action
命令：
```powershell
powershell -NoProfile -Command "& { .\local-debug.bat stop-web; exit $LASTEXITCODE }"
```
结果摘要：
- 正常执行并返回退出码 `0`。

### D. 长运行 action 不再“启动即消失”
命令：
```powershell
cmd /c "local-debug.bat web"
```
结果摘要：
- 修复前：无输出直接退出 `0`。
- 修复后：能真实进入 web 启动流程；若端口占用会输出 `EADDRINUSE` 明确错误。

命令（验证长运行）：
```powershell
powershell -NoProfile -Command "& { .\local-debug.bat web; exit $LASTEXITCODE }"
```
结果摘要：
- 命令在 15s 超时（测试器返回 `124`），说明进程持续运行而非立即退出。
- 随后执行 `local-debug.bat stop-web` 成功回收进程。

### E. 参数分发验证（`status`/`logs`）
并发命令：
```powershell
cmd /c "set LOCAL_DEBUG_COMPOSE_FILE=__not_exist__.yml&&local-debug.bat status"
cmd /c "set LOCAL_DEBUG_COMPOSE_FILE=__not_exist__.yml&&local-debug.bat logs"
```
结果摘要：
- `status` 报错命令路径体现为 `docker compose ... ps`。
- `logs` 报错命令路径体现为 `docker compose ... logs --tail 200 postgres`。
- 证明 bat 参数分发到 `db-status`/`db-logs` 正确。

## 结论
- 闪退问题由“无参数直接退出 + Windows 下 mjs 入口判断错误”共同导致。
- 修复后：双击可见帮助并可继续进入 `dev/web`；已有终端执行行为正常；长运行 action 不再无声秒退。
