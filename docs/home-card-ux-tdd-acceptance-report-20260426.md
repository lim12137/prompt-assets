# 首页卡片 UX TDD/验收报告（2026-04-26）

## 任务范围
- 目标文件：`tests/e2e/smoke/home.spec.ts`
- 报告文件：`docs/home-card-ux-tdd-acceptance-report-20260426.md`
- 约束：未修改业务实现文件，仅调整 e2e 用例与验收报告。

## 覆盖点
1. 将首页 UX 两个新用例改为基于稳定 seed prompt：`js-code-reviewer`（标题：`JavaScript 代码审查助手`），不再依赖运行时新建 prompt 后再打详情 API。
2. “点击卡片区域跳转详情”用例改为：在首页按关键词定位 seed 卡片，点击卡片非交互区域后断言 URL 到 `/prompts/js-code-reviewer` 且详情页标题可见。
3. “复制按钮不跳转且复制默认版本正文”用例改为：先调用 `/api/prompts` 读取 seed 项 `currentVersionContent` 作为基线，点击列表行复制按钮后断言 URL 不变且剪贴板内容等于默认版本正文。

## 测试命令
```bash
pnpm exec playwright test tests/e2e/smoke/home.spec.ts
```

## 执行结果摘要（真实）
- 执行时间：2026-04-26
- 结果：`6 passed (28.3s)`
- 明细：
  - `home page task4: 页面名称为公司提示词库` 通过
  - `home page task4: 分类支持多选 OR 过滤` 通过
  - `home page task4: 系统待分类默认折叠且不可手动勾选` 通过
  - `home page task4: 卡片与列表都展示多分类标签` 通过
  - `home page ux: 点击卡片非链接区域也可跳转详情页` 通过
  - `home page ux: 点击查看详情行右侧复制按钮时不跳转且复制默认版本正文` 通过
