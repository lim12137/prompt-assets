# 并发测试报告-20260426-local-debug-3010-safe-restart

## 任务目标
`local-debug` 在 `3010` 被占用时：
- 若占用者可确认为本项目旧 Web/Next 进程，则安全结束后再启动。
- 若为未知进程，默认拒绝误杀并给出清晰失败信息。

## TDD 失败验证（先红）

### 命令
```powershell
node --test tests/unit/scripts/local-debug-port-ownership.test.mjs tests/unit/scripts/local-debug-safe-stop-policy.test.mjs tests/unit/scripts/local-debug-reclaim-flow.test.mjs
```

### 结果摘要
- FAIL（预期失败）
- 原因：`scripts/local-debug.mjs` 尚未导出 `isProjectWebProcess` / `planSafeStop` / `reclaimWebPortIfNeeded`

## 最终验证（实现后）

### 命令 1
```powershell
node --test tests/unit/scripts/local-debug-port-ownership.test.mjs
```
结果摘要：PASS（2/2）

### 命令 2
```powershell
node --test tests/unit/scripts/local-debug-safe-stop-policy.test.mjs
```
结果摘要：PASS（2/2）

### 命令 3
```powershell
node --test tests/unit/scripts/local-debug-reclaim-flow.test.mjs
```
结果摘要：PASS（2/2）

### 命令 4
```powershell
node --test tests/unit/scripts/local-debug.test.mjs
```
结果摘要：PASS（13 通过，1 跳过）
- 跳过项：`local-debug web exits non-zero when web port is already occupied`
- 跳过原因：本机 `3010` 已被外部进程占用（平台环境条件）

### 并发/合并命令
```powershell
node --test tests/unit/scripts/local-debug-port-ownership.test.mjs tests/unit/scripts/local-debug-safe-stop-policy.test.mjs tests/unit/scripts/local-debug-reclaim-flow.test.mjs tests/unit/scripts/local-debug.test.mjs
```
结果摘要：PASS（19 通过，1 跳过）

## 结论
- 新增识别规则、回收策略与回收流程单测全部通过。
- 未知占用场景默认拒绝自动 kill，避免误杀。
- 验证命令与摘要已按要求落盘到 `docs`。
