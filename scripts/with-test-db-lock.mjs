import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isProcessAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) {
    return false;
  }

  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return !(error && typeof error === "object" && "code" in error && error.code === "ESRCH");
  }
}

async function tryRemoveStaleLock(lockPath, staleMs) {
  let raw = "";
  try {
    raw = await readFile(lockPath, "utf-8");
  } catch {
    return false;
  }

  let payload = null;
  try {
    payload = JSON.parse(raw);
  } catch {
    return false;
  }

  const createdAt = Number(payload?.createdAt);
  const pid = Number(payload?.pid ?? 0);
  const staleByTime = Number.isFinite(createdAt) && Date.now() - createdAt > staleMs;
  const staleByPid = pid > 0 && !isProcessAlive(pid);
  if (!staleByTime && !staleByPid) {
    return false;
  }

  try {
    await rm(lockPath, { force: true });
    return true;
  } catch {
    return false;
  }
}

export async function withTestDbLock(task, options = {}) {
  const lockPath =
    options.lockPath ??
    path.join(os.tmpdir(), "prompt-management-real-db-e2e.lock");
  const pollIntervalMs = Number(options.pollIntervalMs ?? 300);
  const timeoutMs = Number(options.timeoutMs ?? 10 * 60 * 1000);
  const staleMs = Number(options.staleMs ?? 30 * 60 * 1000);
  const ownerToken = `${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  await mkdir(path.dirname(lockPath), { recursive: true });
  const startedAt = Date.now();

  while (true) {
    try {
      await writeFile(
        lockPath,
        JSON.stringify({
          pid: process.pid,
          createdAt: Date.now(),
          ownerToken,
        }),
        { flag: "wx" },
      );
      break;
    } catch (error) {
      if (!(error && typeof error === "object" && "code" in error && error.code === "EEXIST")) {
        throw error;
      }

      const removed = await tryRemoveStaleLock(lockPath, staleMs);
      if (!removed) {
        if (Date.now() - startedAt > timeoutMs) {
          throw new Error(`等待真实 DB 锁超时: ${lockPath}`);
        }
        await sleep(pollIntervalMs);
      }
    }
  }

  try {
    return await task();
  } finally {
    try {
      const raw = await readFile(lockPath, "utf-8");
      const payload = JSON.parse(raw);
      if (payload?.ownerToken === ownerToken) {
        await rm(lockPath, { force: true });
      }
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
        return;
      }
    }
  }
}
