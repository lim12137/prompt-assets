# 页面切换性能 Before/After（首页 -> 详情）

## 测试命令

- `node scripts/perf-home-detail-nav.mjs`
- 环境：`PERF_BASE_URL=http://127.0.0.1:3013 PERF_RUNS=6`
- 目标路径：`/` -> `/prompts/api-debug-assistant`

## Before（历史基线）

- cold：约 `1724-1831ms`，均值约 `1504ms`（含另一条路径），`p95 ≈ 1800ms`
- warm：约 `1095-1433ms`，均值约 `1187ms`
- 慢点：`document` 导航 `300-420ms`，`main-app.js` 约 `300ms`

## After（本次复测）

- 原始 6 轮 cold：`3246, 263, 251, 248, 258, 251`
- 原始 6 轮 warm：`249, 192, 209, 204, 216, 205`
- cold 平均：`753ms`（首轮 dev 编译抖动明显）
- cold p95：`3246ms`
- warm 平均：`213ms`
- warm p95：`249ms`

## 说明

- 首轮 cold `3246ms` 为 dev 首次编译抖动；去掉首轮后，cold（run2-6）均值约 `254ms`。
- 由于改为 `next/link` + 预取，点击后主要走客户端路由，warm 下降明显，且未观察回退。
