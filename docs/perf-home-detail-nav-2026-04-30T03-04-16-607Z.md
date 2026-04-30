# 首页到详情页切换性能报告

- 时间: 2026-04-30T03:04:42.511Z
- 目标: `/` -> `/prompts/api-debug-assistant`
- 运行命令: `node scripts/perf-home-detail-nav.mjs`
- 基础地址: `http://127.0.0.1:3013`
- 轮次: 6

## 每轮数据

| run | cold(ms) | warm(ms) | document(ms) | main-app(ms) |
| --- | ---: | ---: | ---: | ---: |
| 1 | 3246 | 249 | 0 | 0 |
| 2 | 263 | 192 | 0 | 0 |
| 3 | 251 | 209 | 0 | 0 |
| 4 | 248 | 204 | 0 | 0 |
| 5 | 258 | 216 | 0 | 0 |
| 6 | 251 | 205 | 0 | 0 |

## 汇总

- cold 平均: 753ms
- cold p95: 3246ms
- warm 平均: 213ms
- warm p95: 249ms
- document 平均: 0ms
- main-app 平均: 0ms
