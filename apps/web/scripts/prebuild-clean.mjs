import fs from "node:fs";
import path from "node:path";

function parseTargets(argv) {
  const targets = [];
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg !== "--target") {
      continue;
    }
    const value = argv[index + 1];
    if (!value) {
      throw new Error("--target requires value");
    }
    targets.push(value);
    index += 1;
  }
  return targets;
}

const root = process.env.PREBUILD_CLEAN_ROOT
  ? path.resolve(process.env.PREBUILD_CLEAN_ROOT)
  : process.cwd();

const defaultTargets = [
  path.join(root, ".next"),
  path.join(root, ".next-build"),
  path.join(root, ".next-dev"),
  path.join(root, ".next-e2e"),
  path.join(root, "tsconfig.tsbuildinfo"),
];

const requestedTargets = parseTargets(process.argv.slice(2));
const targets =
  requestedTargets.length > 0
    ? requestedTargets.map((target) => path.join(root, target))
    : defaultTargets;

for (const target of targets) {
  fs.rmSync(target, { recursive: true, force: true });
}
