import { spawnSync } from "node:child_process";
import net from "node:net";

const pnpmCommand = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

function runStep(args, label, options = {}) {
  console.log(`==> ${label}`);
  const result = spawnSync(pnpmCommand, args, {
    stdio: "inherit",
    env: process.env,
    shell: process.platform === "win32",
    ...options,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`${label} failed with exit code ${result.status ?? 1}`);
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

runStep(["db:test:up"], "启动 Docker 测试数据库");
await waitForHostDatabase();
await runStepWithRetry(["db:test:migrate"], "执行测试库迁移");
runStep(["db:test:seed"], "写入测试库 seed");
