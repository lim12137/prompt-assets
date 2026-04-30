import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";

const BASE_URL = process.env.PERF_BASE_URL ?? "http://127.0.0.1:3013";
const RUNS = Number(process.env.PERF_RUNS ?? 5);
const TARGET_SLUG = process.env.PERF_TARGET_SLUG ?? "api-debug-assistant";
const TARGET_PATH = `/prompts/${TARGET_SLUG}`;
const REPORT_DIR = path.resolve(process.cwd(), "docs");
const GSTACK_REPORT_DIR = path.resolve(process.cwd(), ".gstack", "benchmark-reports");
const DATE_STAMP = new Date().toISOString().replace(/[:.]/g, "-");
const REPORT_NAME = `perf-home-detail-nav-${DATE_STAMP}.md`;

function mean(values) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function p95(values) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1);
  return sorted[index];
}

async function measureSingleRun(browser, index) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });

  const primaryLink = page.locator(`a[href="${TARGET_PATH}"]`).first();
  await primaryLink.waitFor({ state: "visible", timeout: 15000 });
  const clickStartedAt = Date.now();
  await primaryLink.click();
  await page.waitForURL(new RegExp(`${TARGET_PATH.replace("/", "\\/")}$`), { timeout: 15000 });
  await page.locator("main h1").first().waitFor({ state: "visible", timeout: 15000 });
  const coldMs = Date.now() - clickStartedAt;
  const coldResourceTimings = await page.evaluate(() => {
    const resources = performance.getEntriesByType("resource");
    const result = { documentMs: 0, mainAppMs: 0 };
    for (const item of resources) {
      if (!(item instanceof PerformanceResourceTiming)) {
        continue;
      }
      if (item.initiatorType === "navigation") {
        result.documentMs = Math.max(result.documentMs, item.duration);
      }
      if (item.name.includes("main-app") && item.name.endsWith(".js")) {
        result.mainAppMs = Math.max(result.mainAppMs, item.duration);
      }
    }
    return result;
  });

  await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });
  const warmLink = page.locator(`a[href="${TARGET_PATH}"]`).first();
  await warmLink.waitFor({ state: "visible", timeout: 15000 });
  const warmStartedAt = Date.now();
  await warmLink.click();
  await page.waitForURL(new RegExp(`${TARGET_PATH.replace("/", "\\/")}$`), { timeout: 15000 });
  await page.locator("main h1").first().waitFor({ state: "visible", timeout: 15000 });
  const warmMs = Date.now() - warmStartedAt;

  await context.close();

  return {
    run: index + 1,
    coldMs,
    warmMs,
    documentMs: Math.round(coldResourceTimings.documentMs),
    mainAppMs: Math.round(coldResourceTimings.mainAppMs),
  };
}

function buildReport(rows) {
  const cold = rows.map((item) => item.coldMs);
  const warm = rows.map((item) => item.warmMs);
  const documentDurations = rows.map((item) => item.documentMs);
  const mainAppDurations = rows.map((item) => item.mainAppMs);
  const cmd = "node scripts/perf-home-detail-nav.mjs";

  return `# 首页到详情页切换性能报告

- 时间: ${new Date().toISOString()}
- 目标: \`/\` -> \`${TARGET_PATH}\`
- 运行命令: \`${cmd}\`
- 基础地址: \`${BASE_URL}\`
- 轮次: ${RUNS}

## 每轮数据

| run | cold(ms) | warm(ms) | document(ms) | main-app(ms) |
| --- | ---: | ---: | ---: | ---: |
${rows.map((item) => `| ${item.run} | ${item.coldMs} | ${item.warmMs} | ${item.documentMs} | ${item.mainAppMs} |`).join("\n")}

## 汇总

- cold 平均: ${Math.round(mean(cold))}ms
- cold p95: ${Math.round(p95(cold))}ms
- warm 平均: ${Math.round(mean(warm))}ms
- warm p95: ${Math.round(p95(warm))}ms
- document 平均: ${Math.round(mean(documentDurations))}ms
- main-app 平均: ${Math.round(mean(mainAppDurations))}ms
`;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const rows = [];
  try {
    for (let i = 0; i < RUNS; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      rows.push(await measureSingleRun(browser, i));
    }
  } finally {
    await browser.close();
  }

  const report = buildReport(rows);
  await fs.mkdir(REPORT_DIR, { recursive: true });
  await fs.mkdir(GSTACK_REPORT_DIR, { recursive: true });
  const docPath = path.join(REPORT_DIR, REPORT_NAME);
  const gstackPath = path.join(GSTACK_REPORT_DIR, REPORT_NAME);
  await fs.writeFile(docPath, report, "utf8");
  await fs.writeFile(gstackPath, report, "utf8");
  console.log(JSON.stringify({ report: docPath, gstackReport: gstackPath, rows }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
