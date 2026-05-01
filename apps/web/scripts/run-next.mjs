import { spawn } from "node:child_process";
import net from "node:net";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadWorkspaceEnv as loadWorkspaceEnvIntoProcess } from "../../../scripts/workspace-env.mjs";
import { runWithTrackedFilesGuard } from "./tracked-files-guard.mjs";

const require = createRequire(import.meta.url);

function loadWorkspaceEnv() {
  return loadWorkspaceEnvIntoProcess({ cwd: process.cwd(), env: process.env });
}

function parseArgs(argv) {
  if (argv.length === 0) {
    throw new Error("next command is required");
  }

  const command = argv[0];
  const forwarded = [];
  let distDir;

  for (let index = 1; index < argv.length; index += 1) {
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
    command,
    forwarded,
    distDir,
  };
}

const defaults = {
  dev: ".next-dev",
  build: ".next-build",
  start: ".next-build",
};

function readCliOption(forwarded, optionName) {
  const prefix = `${optionName}=`;
  for (let index = 0; index < forwarded.length; index += 1) {
    const arg = forwarded[index];
    if (arg === optionName) {
      return forwarded[index + 1];
    }
    if (arg.startsWith(prefix)) {
      return arg.slice(prefix.length);
    }
  }
  return undefined;
}

function resolveBindTarget(command, forwarded) {
  if (command !== "dev" && command !== "start") {
    return undefined;
  }

  const portRaw = readCliOption(forwarded, "--port");
  if (!portRaw) {
    return undefined;
  }

  const port = Number.parseInt(portRaw, 10);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`[run-next] Invalid --port value: ${portRaw}`);
  }

  const host = readCliOption(forwarded, "--hostname") || "127.0.0.1";
  return { host, port };
}

async function ensureBindTargetAvailable(bindTarget) {
  if (!bindTarget) {
    return;
  }

  await new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once("error", (error) => {
      const code =
        error && typeof error === "object" && "code" in error
          ? String(error.code)
          : "";
      if (code === "EADDRINUSE") {
        reject(
          new Error(
            `[run-next] Port ${bindTarget.port} on ${bindTarget.host} is already in use (address already in use). Stop the existing process or use another port.`,
          ),
        );
        return;
      }
      reject(error);
    });

    probe.listen(bindTarget.port, bindTarget.host, () => {
      probe.close((closeError) => {
        if (closeError) {
          reject(closeError);
          return;
        }
        resolve();
      });
    });
  });
}

function normalizeCliErrorMessage(error) {
  if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
    const command = "path" in error && typeof error.path === "string" ? error.path : "command";
    return `Command not found in PATH: ${command}`;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return String(error || "Unknown error");
}

function withDefaultNodeOptions(command) {
  const current = process.env.NODE_OPTIONS?.trim() ?? "";
  const hasExplicitHeap = /--max-old-space-size=\d+/u.test(current);
  if (hasExplicitHeap || (command !== "dev" && command !== "build")) {
    return current;
  }

  return current ? `${current} --max-old-space-size=4096` : "--max-old-space-size=4096";
}

function signalToExitCode(signal) {
  if (signal === "SIGINT") {
    return 130;
  }
  if (signal === "SIGTERM") {
    return 143;
  }
  return 1;
}

async function runNextCli(nextCliPath, command, forwarded, env) {
  return await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [nextCliPath, command, ...forwarded], {
      stdio: "inherit",
      shell: false,
      env,
    });

    let killTimer = null;
    const cleanupSignalHandlers = () => {
      process.removeListener("SIGINT", handleSigint);
      process.removeListener("SIGTERM", handleSigterm);
      if (killTimer) {
        clearTimeout(killTimer);
        killTimer = null;
      }
    };

    const forwardSignal = (signal) => {
      if (child.exitCode !== null || child.signalCode !== null) {
        return;
      }
      try {
        child.kill(signal);
      } catch {
        return;
      }
      killTimer = setTimeout(() => {
        if (child.exitCode === null && child.signalCode === null) {
          try {
            child.kill("SIGKILL");
          } catch {}
        }
      }, 5_000);
      if (typeof killTimer.unref === "function") {
        killTimer.unref();
      }
    };

    const handleSigint = () => forwardSignal("SIGINT");
    const handleSigterm = () => forwardSignal("SIGTERM");
    process.once("SIGINT", handleSigint);
    process.once("SIGTERM", handleSigterm);

    child.once("error", (error) => {
      cleanupSignalHandlers();
      reject(error);
    });
    child.once("exit", (code, signal) => {
      cleanupSignalHandlers();
      resolve({
        status: typeof code === "number" ? code : signal ? signalToExitCode(signal) : 1,
        signal: signal ?? null,
      });
    });
  });
}

async function main() {
  loadWorkspaceEnv();

  const { command, forwarded, distDir } = parseArgs(process.argv.slice(2));
  const bindTarget = resolveBindTarget(command, forwarded);
  await ensureBindTargetAvailable(bindTarget);

  const resolvedDistDir =
    distDir?.trim() ||
    process.env.NEXT_DIST_DIR_OVERRIDE?.trim() ||
    defaults[command] ||
    ".next";

  const nextCliPath = require.resolve("next/dist/bin/next");
  const result = await runWithTrackedFilesGuard(
    async () =>
      runNextCli(nextCliPath, command, forwarded, {
        ...process.env,
        NEXT_DIST_DIR: resolvedDistDir,
        NODE_OPTIONS: withDefaultNodeOptions(command),
      }),
    {
      rootDir: process.cwd(),
      installSignalHandlers: false,
    },
  );

  process.exit(result.status ?? 1);
}

const __filename = fileURLToPath(import.meta.url);
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await main();
  } catch (error) {
    console.error(normalizeCliErrorMessage(error));
    process.exit(1);
  }
}
