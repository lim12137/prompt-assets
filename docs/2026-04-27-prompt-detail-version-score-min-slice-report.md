# 提示词详情页版本评分（1-5 分）最小切片验证报告

日期：2026-04-27

## 变更目标

- 在 prompt 详情页版本卡片的点赞同区域新增 1-5 分评分入口。
- 对接已存在 API：
  - `POST /api/prompts/[slug]/versions/[versionNo]/score`
  - `GET /api/prompts/[slug]/versions/[versionNo]/score-stats`
- 展示最小反馈：提交状态 + 统计摘要（均分/评分人数/低分率）。
- 先补测试，再实现。

## 测试与结果摘要

### 1) 前端评分动作单测

命令：

```bash
node --test --experimental-strip-types apps/web/tests/prompt-version-score-actions.test.ts
```

结果：通过（3/3）

- 覆盖 `score-stats` 拉取
- 覆盖 `score` 提交 payload（包含 scene/traceId）
- 覆盖统计摘要文案格式化

### 2) 详情页评分入口渲染测试

命令：

```bash
node --test --experimental-strip-types apps/web/tests/prompt-detail-version-score-entry.test.ts
```

结果：通过（1/1）

- 覆盖版本卡出现 `1-5` 评分按钮
- 覆盖评分统计占位文本

### 3) 后端评分 API 回归（相关）

命令：

```bash
node --test --experimental-strip-types tests/integration/api/prompt-version-score.test.ts
```

结果：通过（6/6）

- 写入合法评分
- 非法分值拒绝
- scene 必填
- 版本不存在返回 404
- 写入后统计可见
- scene 过滤与分布/低分率正确

### 4) 并发执行验证

命令：

```bash
node --test --experimental-strip-types apps/web/tests/prompt-version-score-actions.test.ts apps/web/tests/prompt-detail-version-score-entry.test.ts tests/integration/api/prompt-version-score.test.ts
```

结果：通过（10/10）

## 说明

- Playwright e2e 在当前机器会话中存在浏览器进程不可用问题（GPU/线程资源异常），因此本次验收采用“前端动作单测 + 页面渲染测试 + API 集成回归”完成最小可验证闭环。
