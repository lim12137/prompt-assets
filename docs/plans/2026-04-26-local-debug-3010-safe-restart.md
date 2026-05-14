# local-debug 3010 端口安全重启 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 当 `3010` 端口被占用时，`local-debug web/dev/restart-web` 能自动安全结束“本项目旧 Web 进程”后再启动；对未知进程默认拒绝误杀并给出可读错误。

**Architecture:** 在 `scripts/local-debug.mjs` 增加“端口占用进程识别 + 安全回收决策”纯函数层，并在 `web` 启动前调用。识别命中“本项目旧 Web”才允许 kill；存在未知占用时直接 fail-fast。通过依赖注入让流程逻辑可单测，不依赖真实杀进程。  
**Tech Stack:** Node.js (`node:test`, `child_process`, `net`), PowerShell (`Get-NetTCPConnection`, `Get-CimInstance`), Windows `taskkill`

---

执行约束：`@superpowers:test-driven-development`、`@superpowers:verification-before-completion`

### Task 1: 端口占用识别规则（纯函数）基线

**Files:**
- Create: `tests/unit/scripts/local-debug-port-ownership.test.mjs`
- Modify: `scripts/local-debug.mjs`
- Test: `tests/unit/scripts/local-debug-port-ownership.test.mjs`

**Step 1: Write the failing test**

```js
test("isProjectWebProcess returns true for workspace pnpm web command", () => {
  const info = {
    pid: "1234",
    name: "node.exe",
    commandLine: "node ... pnpm --filter @prompt-management/web dev --hostname 127.0.0.1 --port 3010",
    executablePath: "D:\\1work\\提示词管理\\node.exe",
  };
  assert.equal(isProjectWebProcess(info, config, "D:\\1work\\提示词管理"), true);
});

test("isProjectWebProcess returns false for unknown command", () => {
  const info = { pid: "8888", name: "python.exe", commandLine: "python -m http.server 3010" };
  assert.equal(isProjectWebProcess(info, config, "D:\\1work\\提示词管理"), false);
});
```

**Step 2: Run test to verify it fails**

Run: `node --test tests/unit/scripts/local-debug-port-ownership.test.mjs`  
Expected: FAIL，报 `isProjectWebProcess is not defined/exported`

**Step 3: Write minimal implementation**

```js
export function isProjectWebProcess(processInfo, config, root = workspaceRoot) {
  const cmd = String(processInfo.commandLine || "").toLowerCase();
  const normalizedRoot = root.toLowerCase();
  const hasProjectMarker = cmd.includes("@prompt-management/web") || cmd.includes(`${normalizedRoot.toLowerCase()}\\apps\\web`);
  const hasPortMarker = cmd.includes(`--port ${config.webPort}`) || cmd.includes(`:${config.webPort}`);
  return hasProjectMarker && hasPortMarker;
}
```

**Step 4: Run test to verify it passes**

Run: `node --test tests/unit/scripts/local-debug-port-ownership.test.mjs`  
Expected: PASS

**Step 5: Commit**

```bash
git add tests/unit/scripts/local-debug-port-ownership.test.mjs scripts/local-debug.mjs
git commit -m "test: add local-debug process ownership rules for web port"
```

### Task 2: 安全回收决策（未知进程默认不杀）

**Files:**
- Create: `tests/unit/scripts/local-debug-safe-stop-policy.test.mjs`
- Modify: `scripts/local-debug.mjs`
- Test: `tests/unit/scripts/local-debug-safe-stop-policy.test.mjs`

**Step 1: Write the failing test**

```js
test("planSafeStop returns kill list when all listeners are project web", () => {
  const listeners = [{ pid: "101", commandLine: "...@prompt-management/web dev --port 3010" }];
  const plan = planSafeStop(listeners, config, workspaceRoot);
  assert.deepEqual(plan.killPids, ["101"]);
  assert.deepEqual(plan.blocked, []);
});

test("planSafeStop blocks unknown listener by default", () => {
  const listeners = [{ pid: "999", commandLine: "python -m http.server 3010" }];
  const plan = planSafeStop(listeners, config, workspaceRoot);
  assert.deepEqual(plan.killPids, []);
  assert.equal(plan.blocked[0].pid, "999");
});
```

**Step 2: Run test to verify it fails**

Run: `node --test tests/unit/scripts/local-debug-safe-stop-policy.test.mjs`  
Expected: FAIL，报 `planSafeStop is not defined/exported`

**Step 3: Write minimal implementation**

```js
export function planSafeStop(listeners, config, root = workspaceRoot) {
  const killPids = [];
  const blocked = [];
  for (const item of listeners) {
    if (isProjectWebProcess(item, config, root)) killPids.push(item.pid);
    else blocked.push(item);
  }
  return { killPids: [...new Set(killPids)], blocked };
}
```

**Step 4: Run test to verify it passes**

Run: `node --test tests/unit/scripts/local-debug-safe-stop-policy.test.mjs`  
Expected: PASS

**Step 5: Commit**

```bash
git add tests/unit/scripts/local-debug-safe-stop-policy.test.mjs scripts/local-debug.mjs
git commit -m "feat: add safe stop decision for local-debug web port listeners"
```

### Task 3: `web` 启动前自动安全回收（可注入依赖，便于单测）

**Files:**
- Create: `tests/unit/scripts/local-debug-reclaim-flow.test.mjs`
- Modify: `scripts/local-debug.mjs`
- Test: `tests/unit/scripts/local-debug-reclaim-flow.test.mjs`

**Step 1: Write the failing test**

```js
test("reclaimWebPortIfNeeded kills old project web and continues", async () => {
  const calls = [];
  await reclaimWebPortIfNeeded(config, {
    listListeners: () => [{ pid: "1200", commandLine: "...@prompt-management/web dev --port 3010" }],
    killPid: (pid) => calls.push(pid),
  });
  assert.deepEqual(calls, ["1200"]);
});

test("reclaimWebPortIfNeeded throws when unknown listener exists", async () => {
  await assert.rejects(
    () => reclaimWebPortIfNeeded(config, {
      listListeners: () => [{ pid: "7777", commandLine: "python -m http.server 3010" }],
      killPid: () => assert.fail("must not kill unknown process"),
    }),
    /Refusing to stop unknown process/i,
  );
});
```

**Step 2: Run test to verify it fails**

Run: `node --test tests/unit/scripts/local-debug-reclaim-flow.test.mjs`  
Expected: FAIL，报 `reclaimWebPortIfNeeded is not defined/exported`

**Step 3: Write minimal implementation**

```js
export async function reclaimWebPortIfNeeded(config, deps = defaultDeps) {
  const listeners = deps.listListeners(config.webPort);
  const plan = planSafeStop(listeners, config, workspaceRoot);
  if (plan.blocked.length > 0) {
    throw new Error(`Refusing to stop unknown process on port ${config.webPort}: PID ${plan.blocked[0].pid}`);
  }
  for (const pid of plan.killPids) deps.killPid(pid);
}
```

并把 `executePlan` 中 `step === "web"` 分支改为：

```js
await reclaimWebPortIfNeeded(config);
startPersistentWeb(config);
```

**Step 4: Run test to verify it passes**

Run: `node --test tests/unit/scripts/local-debug-reclaim-flow.test.mjs`  
Expected: PASS

**Step 5: Commit**

```bash
git add tests/unit/scripts/local-debug-reclaim-flow.test.mjs scripts/local-debug.mjs
git commit -m "feat: reclaim web port safely before local-debug web start"
```

### Task 4: 现有脚本回归测试补齐（真实 3010 占用）

**Files:**
- Modify: `tests/unit/scripts/local-debug.test.mjs`
- Modify: `scripts/local-debug.mjs`（仅当错误信息需微调）
- Test: `tests/unit/scripts/local-debug.test.mjs`

**Step 1: Write the failing test**

在已有 `local-debug web exits non-zero when web port is already occupied` 用例基础上增强断言：

```js
assert.notEqual(run.status, 0);
assert.match(output, /Refusing to stop unknown process on port 3010/i);

// 验证 holder 未被误杀
const probe = createServer();
await assert.rejects(
  () => new Promise((resolve, reject) => probe.listen(3010, "127.0.0.1", resolve).once("error", reject)),
  /EADDRINUSE/i,
);
probe.close();
```

**Step 2: Run test to verify it fails**

Run: `node --test tests/unit/scripts/local-debug.test.mjs`  
Expected: FAIL，当前输出仍是 `EADDRINUSE` 或未包含安全拒绝信息

**Step 3: Write minimal implementation**

```js
if (blocked.length > 0) {
  throw new Error(
    `Refusing to stop unknown process on port ${config.webPort}. Only previous @prompt-management/web process can be stopped automatically.`,
  );
}
```

**Step 4: Run test to verify it passes**

Run: `node --test tests/unit/scripts/local-debug.test.mjs`  
Expected: PASS（Windows 场景下新增断言通过，未知进程不会被杀）

**Step 5: Commit**

```bash
git add tests/unit/scripts/local-debug.test.mjs scripts/local-debug.mjs
git commit -m "test: guard against killing unknown process on occupied web port"
```

### Task 5: 全量验证与并发测试报告落盘

**Files:**
- Create: `docs/并发测试报告-20260426-local-debug-3010-safe-restart.md`
- Test: `tests/unit/scripts/local-debug-port-ownership.test.mjs`
- Test: `tests/unit/scripts/local-debug-safe-stop-policy.test.mjs`
- Test: `tests/unit/scripts/local-debug-reclaim-flow.test.mjs`
- Test: `tests/unit/scripts/local-debug.test.mjs`

**Step 1: Write the failing test**

先创建报告模板（空摘要），并声明待填充命令结果：

```md
# 并发测试报告-20260426-local-debug-3010-safe-restart
- 命令:
- 结果摘要:
```

**Step 2: Run test to verify it fails**

Run: `node --test tests/unit/scripts/local-debug-port-ownership.test.mjs tests/unit/scripts/local-debug-safe-stop-policy.test.mjs tests/unit/scripts/local-debug-reclaim-flow.test.mjs tests/unit/scripts/local-debug.test.mjs`  
Expected: 在实现前至少 1 项 FAIL

**Step 3: Write minimal implementation**

补齐最终实现后，执行并发/冲突场景命令并记录摘要到报告：

```powershell
node --test tests/unit/scripts/local-debug-port-ownership.test.mjs
node --test tests/unit/scripts/local-debug-safe-stop-policy.test.mjs
node --test tests/unit/scripts/local-debug-reclaim-flow.test.mjs
node --test tests/unit/scripts/local-debug.test.mjs
```

**Step 4: Run test to verify it passes**

Run: `node --test tests/unit/scripts/local-debug-port-ownership.test.mjs tests/unit/scripts/local-debug-safe-stop-policy.test.mjs tests/unit/scripts/local-debug-reclaim-flow.test.mjs tests/unit/scripts/local-debug.test.mjs`  
Expected: PASS（允许平台条件 skip）

**Step 5: Commit**

```bash
git add docs/并发测试报告-20260426-local-debug-3010-safe-restart.md tests/unit/scripts/local-debug-*.test.mjs scripts/local-debug.mjs
git commit -m "docs: add concurrency verification report for local-debug safe 3010 reclaim"
```

## DoD

- `web/dev/restart-web` 在 `3010` 被“本项目旧 Web”占用时，自动安全 stop 后拉起新进程。
- `3010` 被未知进程占用时，默认拒绝 kill，给出明确错误信息与 PID。
- 单元测试覆盖识别规则、回收决策、流程编排和真实占用回归场景。
- 验证命令与结果摘要落盘到 `docs/并发测试报告-20260426-local-debug-3010-safe-restart.md`。

