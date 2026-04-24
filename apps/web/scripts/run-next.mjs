import { spawnSync } from "node:child_process";

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

const { command, forwarded, distDir } = parseArgs(process.argv.slice(2));
const nextBin = process.platform === "win32" ? "next.cmd" : "next";
const resolvedDistDir =
  distDir?.trim() ||
  process.env.NEXT_DIST_DIR_OVERRIDE?.trim() ||
  defaults[command] ||
  ".next";

const result = spawnSync(nextBin, [command, ...forwarded], {
  stdio: "inherit",
  shell: process.platform === "win32",
  env: {
    ...process.env,
    NEXT_DIST_DIR: resolvedDistDir,
  },
});

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
