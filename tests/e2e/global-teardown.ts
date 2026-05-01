import { existsSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";

import { restoreTrackedFiles } from "../../apps/web/scripts/tracked-files-guard.mjs";

const SNAPSHOT_FILE = path.join(process.cwd(), ".tmp", "playwright-tracked-files-snapshot.json");
const WEB_ROOT = path.join(process.cwd(), "apps", "web");

export default async function globalTeardown() {
  if (!existsSync(SNAPSHOT_FILE)) {
    return;
  }

  const payload = JSON.parse(readFileSync(SNAPSHOT_FILE, "utf8"));
  if (Array.isArray(payload?.snapshot)) {
    restoreTrackedFiles(payload.snapshot);
  }

  const distDir =
    typeof payload?.distDir === "string" && payload.distDir.trim()
      ? payload.distDir.trim()
      : ".next-e2e";
  rmSync(path.join(WEB_ROOT, distDir), { recursive: true, force: true });
  rmSync(SNAPSHOT_FILE, { force: true });
}
