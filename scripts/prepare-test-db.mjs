import { spawnSync } from "node:child_process";
import net from "node:net";
import { withTestDbLock } from "./with-test-db-lock.mjs";

const pnpmCommand = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const stepTimeoutMs = Number(process.env.TEST_DB_PREPARE_STEP_TIMEOUT_MS ?? 180000);
const retryCount = Number(process.env.TEST_DB_PREPARE_RETRIES ?? 3);
const lockTimeoutMs = Number(
  process.env.TEST_DB_PREPARE_LOCK_TIMEOUT_MS ??
    retryCount * (stepTimeoutMs * 3 + 15000) + 60000,
);
const lockStaleMs = Number(process.env.TEST_DB_PREPARE_LOCK_STALE_MS ?? lockTimeoutMs);

function runStep(args, label, options = {}) {
  console.log(`==> ${label}`);
  const result = spawnSync(pnpmCommand, args, {
    stdio: "inherit",
    env: process.env,
    shell: process.platform === "win32",
    timeout: stepTimeoutMs,
    ...options,
  });

  if (result.error) {
    if (result.error.code === "ETIMEDOUT") {
      throw new Error(`${label} timed out after ${stepTimeoutMs}ms`);
    }
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`${label} failed with exit code ${result.status ?? 1}`);
  }
}

function runStepAllowFailure(args, label, options = {}) {
  try {
    runStep(args, label, options);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`${label} 忽略失败: ${message}`);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForHostDatabase(label = "测试数据库主机端口") {
  const host = process.env.TEST_DB_HOST ?? "127.0.0.1";
  const port = Number(process.env.TEST_DB_PORT ?? "55432");

  for (let attempt = 1; attempt <= 10; attempt += 1) {
    try {
      await new Promise((resolve, reject) => {
        const socket = net.createConnection({ host, port });
        const timeout = setTimeout(() => {
          socket.destroy();
          reject(new Error("connect timeout"));
        }, 1000);

        socket.once("connect", () => {
          clearTimeout(timeout);
          socket.destroy();
          resolve(undefined);
        });
        socket.once("error", (error) => {
          clearTimeout(timeout);
          socket.destroy();
          reject(error);
        });
      });
      return;
    } catch {
      await sleep(1000);
    }
  }

  throw new Error(`${label}未就绪: ${host}:${port}`);
}

async function runPreparePipeline() {
  let attempt = 0;
  while (attempt < retryCount) {
    attempt += 1;

    try {
      runStep(["db:test:up"], `启动 Docker 测试数据库（第 ${attempt} 次）`);
      await waitForHostDatabase("启动后测试数据库主机端口");

      runStep(["db:test:migrate"], `执行测试库迁移（第 ${attempt} 次）`);
      await waitForHostDatabase("迁移后测试数据库主机端口");

      runStep(["db:test:seed"], `写入测试库 seed（第 ${attempt} 次）`);
      return;
    } catch (error) {
      runStepAllowFailure(["db:test:down"], "失败后清理测试数据库容器", { timeout: 30000 });
      if (attempt >= retryCount) {
        throw error;
      }
      await sleep(1000);
    }
  }
}

if (process.env.TEST_DB_PREPARE_SKIP_LOCK === "1") {
  await runPreparePipeline();
} else {
  await withTestDbLock(runPreparePipeline, {
    timeoutMs: lockTimeoutMs,
    staleMs: lockStaleMs,
  });
}
