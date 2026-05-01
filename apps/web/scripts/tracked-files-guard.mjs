import fs from "node:fs";
import path from "node:path";

import { withTestDbLock } from "../../../scripts/with-test-db-lock.mjs";

const TRACKED_FILES = ["next-env.d.ts", "tsconfig.json"];
const DEFAULT_STALE_MS = 10 * 60 * 1000;
const DEFAULT_OWNER_TOKEN_PREFIX = "tracked-files";

export function resolveTrackedFilePaths(rootDir = process.cwd()) {
  return TRACKED_FILES.map((file) => path.join(rootDir, file));
}

export function snapshotTrackedFiles(rootDir = process.cwd()) {
  return resolveTrackedFilePaths(rootDir).map((filePath) => ({
    filePath,
    exists: fs.existsSync(filePath),
    content: fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "",
  }));
}

export function restoreTrackedFiles(snapshot) {
  for (const item of snapshot) {
    if (item.exists) {
      fs.writeFileSync(item.filePath, item.content, "utf8");
      continue;
    }
    fs.rmSync(item.filePath, { force: true });
  }
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

function readTrackedFilesLock(lockPath) {
  try {
    return JSON.parse(fs.readFileSync(lockPath, "utf8"));
  } catch {
    return null;
  }
}

function writeTrackedFilesLock(lockPath, payload) {
  fs.writeFileSync(lockPath, JSON.stringify(payload), "utf8");
}

function createTrackedFilesOwnerToken() {
  return `${DEFAULT_OWNER_TOKEN_PREFIX}-${process.pid}-${Date.now()}-${Math.random()
    .toString(16)
    .slice(2)}`;
}

function isTrackedFilesLockStale(payload, staleMs) {
  const pid = Number(payload?.pid ?? 0);
  const createdAt = Number(payload?.createdAt ?? 0);
  if (pid > 0) {
    return !isProcessAlive(pid);
  }

  return Number.isFinite(createdAt) && createdAt > 0 && Date.now() - createdAt > staleMs;
}

export function cleanupTrackedFilesFromLock(lockPath, options = {}) {
  const payload = readTrackedFilesLock(lockPath);
  if (!payload) {
    return false;
  }

  const staleMs = Number(options.staleMs ?? DEFAULT_STALE_MS);
  if (options.onlyIfStale && !isTrackedFilesLockStale(payload, staleMs)) {
    return false;
  }

  const expectedTrackedFilesOwnerToken = options.expectedTrackedFilesOwnerToken;
  if (
    typeof expectedTrackedFilesOwnerToken === "string" &&
    expectedTrackedFilesOwnerToken.length > 0 &&
    payload?.trackedFilesOwnerToken !== expectedTrackedFilesOwnerToken
  ) {
    return false;
  }

  if (Array.isArray(payload.snapshot)) {
    restoreTrackedFiles(payload.snapshot);
  }
  fs.rmSync(lockPath, { force: true });
  return true;
}

export async function runWithTrackedFilesGuard(run, options = {}) {
  const rootDir = options.rootDir ?? process.cwd();
  const lockPath = options.lockPath ?? path.join(rootDir, ".next-tracked-files.lock");
  const installSignalHandlers = options.installSignalHandlers !== false;
  const staleMs = options.staleMs ?? DEFAULT_STALE_MS;
  const trackedFilesOwnerToken =
    options.trackedFilesOwnerToken ??
    process.env.TRACKED_FILES_OWNER_TOKEN?.trim() ??
    createTrackedFilesOwnerToken();
  const lock =
    options.lock ??
    ((callback) =>
      withTestDbLock(callback, {
        lockPath,
        timeoutMs: options.timeoutMs ?? 10 * 60 * 1000,
        staleMs,
        pollIntervalMs: options.pollIntervalMs ?? 100,
      }));

  cleanupTrackedFilesFromLock(lockPath, { onlyIfStale: true, staleMs });

  return lock(async () => {
    const snapshot = snapshotTrackedFiles(rootDir);
    const lockPayload = readTrackedFilesLock(lockPath);
    if (lockPayload) {
      writeTrackedFilesLock(lockPath, {
        ...lockPayload,
        snapshot,
        trackedFilesOwnerToken,
      });
    }
    let cleanedUp = false;
    const cleanup = () => {
      if (cleanedUp) {
        return;
      }
      cleanedUp = true;
      cleanupTrackedFilesFromLock(lockPath, {
        expectedTrackedFilesOwnerToken: trackedFilesOwnerToken,
      });
    };
    const signalHandler = (signal) => {
      cleanup();
      process.exit(signal === "SIGINT" ? 130 : 143);
    };
    const exitHandler = () => {
      cleanup();
    };
    if (installSignalHandlers) {
      process.once("SIGINT", signalHandler);
      process.once("SIGTERM", signalHandler);
    }
    process.once("exit", exitHandler);
    try {
      return await run();
    } finally {
      if (installSignalHandlers) {
        process.removeListener("SIGINT", signalHandler);
        process.removeListener("SIGTERM", signalHandler);
      }
      process.removeListener("exit", exitHandler);
      cleanup();
    }
  });
}
