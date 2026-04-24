import fs from "node:fs";
import path from "node:path";

const root = process.env.PREBUILD_CLEAN_ROOT
  ? path.resolve(process.env.PREBUILD_CLEAN_ROOT)
  : process.cwd();

const targets = [
  path.join(root, ".next"),
  path.join(root, ".next-dev"),
  path.join(root, ".next-e2e"),
  path.join(root, "tsconfig.tsbuildinfo"),
];

for (const target of targets) {
  fs.rmSync(target, { recursive: true, force: true });
}
