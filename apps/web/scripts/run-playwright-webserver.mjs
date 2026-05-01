import fs from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

import { loadWorkspaceEnv as loadWorkspaceEnvIntoProcess } from "../../../scripts/workspace-env.mjs";
import { restoreTrackedFiles, snapshotTrackedFiles } from "./tracked-files-guard.mjs";

const DEFAULT_POST_STOP_SETTLE_MS = 3_000;
const POST_STOP_RESTORE_INTERVAL_MS = 200;

function loadWorkspaceEnv() {
  return loadWorkspaceEnvIntoProcess({ cwd: process.cwd(), env: process.env });
}

function parseArgs(argv) {
  const forwarded = [];
  let distDir;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--dist") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("--dist requires value");
      }
      distDir = value;
      index += 1;
      continue;
    }
    forwarded.push(arg);
  }

  return {
    distDir: distDir?.trim() || ".next-e2e",
    forwarded,
  };
}

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function runPrebuildClean(distDir) {
  const prebuildCleanPath = path.join(process.cwd(), "scripts", "prebuild-clean.mjs");
  const result = spawnSync(process.execPath, [prebuildCleanPath, "--target", distDir], {
    stdio: "inherit",
    shell: false,
    env: process.env,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`prebuild-clean failed with exit code ${result.status ?? 1}`);
  }
}

function cleanupDistDir(distDir) {
  fs.rmSync(path.join(process.cwd(), distDir), { recursive: true, force: true });
}

async function main() {
  loadWorkspaceEnv();

  const { distDir, forwarded } = parseArgs(process.argv.slice(2));
  const rootDir = process.cwd();
  const trackedFilesSnapshot = snapshotTrackedFiles(rootDir);
  const runNextPath = path.join(rootDir, "scripts", "run-next.mjs");
  const postStopSettleMs = Number(
    process.env.PLAYWRIGHT_WEB_POST_STOP_SETTLE_MS ?? DEFAULT_POST_STOP_SETTLE_MS,
  );

  runPrebuildClean(distDir);

  let cleanedUp = false;
  const cleanup = async () => {
    if (cleanedUp) {
      return;
    }
    cleanedUp = true;
    restoreTrackedFiles(trackedFilesSnapshot);
    if (Number.isFinite(postStopSettleMs) && postStopSettleMs > 0) {
      const deadline = Date.now() + postStopSettleMs;
      while (Date.now() < deadline) {
        await wait(Math.min(POST_STOP_RESTORE_INTERVAL_MS, Math.max(deadline - Date.now(), 1)));
        restoreTrackedFiles(trackedFilesSnapshot);
      }
    }
    cleanupDistDir(distDir);
    restoreTrackedFiles(trackedFilesSnapshot);
  };

  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [runNextPath, "dev", "--dist", distDir, ...forwarded], {
      stdio: "inherit",
      shell: false,
      env: process.env,
    });

    let shuttingDown = false;
    const shutdown = async (signal) => {
      if (shuttingDown) {
        return;
      }
      shuttingDown = true;
      if (child.exitCode === null && child.signalCode === null) {
        try {
          child.kill(signal);
        } catch {}
      }
    };

    const handleSigint = () => {
      void shutdown("SIGINT");
    };
    const handleSigterm = () => {
      void shutdown("SIGTERM");
    };

    process.once("SIGINT", handleSigint);
    process.once("SIGTERM", handleSigterm);

    child.once("error", (error) => {
      process.removeListener("SIGINT", handleSigint);
      process.removeListener("SIGTERM", handleSigterm);
      reject(error);
    });

    child.once("exit", async (code, signal) => {
      process.removeListener("SIGINT", handleSigint);
      process.removeListener("SIGTERM", handleSigterm);
      await cleanup();
      if (typeof code === "number" && code !== 0) {
        reject(new Error(`run-next exited with code ${code}`));
        return;
      }
      if (signal) {
        resolve(signal);
        return;
      }
      resolve(code ?? 0);
    });
  });
}

const __filename = fileURLToPath(import.meta.url);
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
