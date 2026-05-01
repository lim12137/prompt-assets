import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { snapshotTrackedFiles } from "../../apps/web/scripts/tracked-files-guard.mjs";

const SNAPSHOT_FILE = path.join(process.cwd(), ".tmp", "playwright-tracked-files-snapshot.json");
const WEB_ROOT = path.join(process.cwd(), "apps", "web");

export default async function globalSetup() {
  mkdirSync(path.dirname(SNAPSHOT_FILE), { recursive: true });
  writeFileSync(
    SNAPSHOT_FILE,
    JSON.stringify(
      {
        distDir: process.env.PLAYWRIGHT_WEB_DIST ?? ".next-e2e",
        snapshot: snapshotTrackedFiles(WEB_ROOT),
      },
      null,
      2,
    ),
    "utf8",
  );
}
