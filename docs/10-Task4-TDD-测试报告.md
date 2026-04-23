# Task 4 TDD 测试报告

日期：2026-04-23

## 测试命令

```bash
node --test --experimental-strip-types tests/unit/domain/versioning.test.ts tests/unit/domain/review-flow.test.ts
```

## 首次执行（Red）

- 结果：失败
- 失败摘要：Task4 红灯阶段时，`versioning` / `review-flow` 目标模块尚未实现，领域单测无法通过。

## 最小实现后再次执行（Green）

- 结果：通过（4 通过，0 失败）
- 通过摘要：
  - `nextVersionNo()` 可生成 `v0001`
  - `nextVersionNo("v0009")` 可递增到 `v0010`
  - `pending -> approved / rejected` 为合法流转
  - `approved -> pending` 为非法流转
