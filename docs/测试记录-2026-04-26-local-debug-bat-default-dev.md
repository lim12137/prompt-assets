# local-debug.bat 默认行为改为 dev 验证报告

日期：2026-04-26

## 变更目标

将 `local-debug.bat` 在无参数/双击启动时的默认行为，从进入交互菜单改为直接进入本地调试模式，并保持 `help` 与其他 action 分发不变。

## dev 含义确认

`local-debug.bat` 的 `dev` action 会调用：

```bat
node "%SCRIPT%" dev
```

`scripts/local-debug.mjs` 中 `buildExecutionPlan("dev")` 返回：

```text
db-up -> db-migrate -> db-seed -> web
```

因此 `dev` 的实际含义是：启动本地 Docker 数据库、执行迁移、灌入种子数据，然后启动本地 Web 调试服务。

## 执行命令

```powershell
cmd /c "local-debug.bat help"
cmd /c "local-debug.bat unknown-action"
cmd /c "set LOCAL_DEBUG_COMPOSE_FILE=Z:\__nope__.yml&&local-debug.bat"
cmd /c "set LOCAL_DEBUG_COMPOSE_FILE=Z:\__nope__.yml&&local-debug.bat dev"
```

## 结果摘要

1. `local-debug.bat help`
   输出帮助文本成功，包含所有既有 actions，退出码为 `0`。
2. `local-debug.bat unknown-action`
   仍输出 `Unknown action` 与 usage，退出码为 `1`，说明未知参数分发未被破坏。
3. `local-debug.bat`
   在注入无效 `LOCAL_DEBUG_COMPOSE_FILE` 后，直接进入 `dev` 链路，并在 `docker compose -f Z:\__nope__.yml up -d postgres` 处失败，退出码为 `1`。
4. `local-debug.bat dev`
   在同样的注入条件下，失败位置与错误信息与无参数执行一致。

## 结论

- 无参数默认行为已从交互菜单改为直接进入 `dev`。
- `help`、未知 action 和其他既有参数分发逻辑保持不变。
- bat 层验证表明：无参数与显式 `dev` 现在映射到同一执行入口。
