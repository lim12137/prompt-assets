import { spawnSync } from "node:child_process";
import net from "node:net";

const pnpmCommand = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const stepTimeoutMs = Number(process.env.TEST_DB_PREPARE_STEP_TIMEOUT_MS ?? 180000);
const retryCount = Number(process.env.TEST_DB_PREPARE_RETRIES ?? 3);

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

async function runStepWithRetry(args, label, retries = 3) {
  let attempt = 0;

  while (attempt < retries) {
    attempt += 1;

    try {
      runStep(args, `${label}（第 ${attempt} 次）`);
      return;
    } catch (error) {
      runStepAllowFailure(["db:test:down"], "失败后清理测试数据库容器", { timeout: 30000 });
      if (attempt >= retries) {
        throw error;
      }
      await sleep(1000);
    }
  }
}

async function waitForHostDatabase() {
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

  throw new Error(`测试数据库主机端口未就绪: ${host}:${port}`);
}

await runStepWithRetry(["db:test:up"], "启动 Docker 测试数据库", retryCount);
await waitForHostDatabase();
await runStepWithRetry(["db:test:migrate"], "执行测试库迁移", retryCount);
await runStepWithRetry(["db:test:seed"], "写入测试库 seed", retryCount);
