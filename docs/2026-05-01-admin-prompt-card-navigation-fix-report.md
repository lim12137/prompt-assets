# 2026-05-01 管理页提示词卡片点击导航修复报告

## 问题范围

- 复现页面：`/admin/prompts`
- 复现对象：后台提示词管理列表中的提示词卡片
- 现象：点击卡片非按钮区域后，页面 URL 保持在 `/admin/prompts`，无法进入 `/admin/prompts/[slug]`

首页提示词卡片回归验证通过，未复现同类问题。

## 根因

后台提示词管理列表里的每一条卡片只有右侧“管理”按钮可跳转，卡片容器本身没有绑定导航行为，也没有键盘可访问性处理；因此用户点击卡片主体时不会触发任何页面跳转。

## 修复

- 给后台提示词管理卡片补充整卡点击导航
- 补充 `Enter` / `Space` 键盘导航
- 对按钮、链接等交互元素保留豁免，避免误触发整卡跳转

## 测试命令与结果

### 1. 先复现红灯

```powershell
$env:PLAYWRIGHT_WEB_DIST='.next-e2e-admin-click-red'
$env:PLAYWRIGHT_WEB_PORT='36141'
pnpm exec playwright test tests/e2e/admin/prompts-management.spec.ts --grep "点击卡片非按钮区域可进入详情页" --reporter=line
```

结果摘要：

- `1 failed / 0 passed`
- 失败断言：点击 `admin-prompts-row-beta-prompt` 后，URL 仍停留在 `/admin/prompts`

### 2. 修复后定向验证

```powershell
$env:PLAYWRIGHT_WEB_DIST='.next-e2e-admin-click-green'
$env:PLAYWRIGHT_WEB_PORT='36142'
pnpm exec playwright test tests/e2e/admin/prompts-management.spec.ts --grep "点击卡片非按钮区域可进入详情页" --reporter=line
```

结果摘要：

- `1 passed / 0 failed`

### 3. 管理页回归

```powershell
$env:PLAYWRIGHT_WEB_DIST='.next-e2e-admin-click-regression'
$env:PLAYWRIGHT_WEB_PORT='36143'
pnpm exec playwright test tests/e2e/admin/prompts-management.spec.ts --reporter=line
```

结果摘要：

- `6 passed / 0 failed`

### 4. 首页卡片点击回归

```powershell
$env:PLAYWRIGHT_WEB_DIST='.next-e2e-home-click-regression'
$env:PLAYWRIGHT_WEB_PORT='36144'
pnpm exec playwright test tests/e2e/smoke/home.spec.ts --grep "点击卡片非链接区域也可跳转详情页" --reporter=line
```

结果摘要：

- `1 passed / 0 failed`
- 进程收尾阶段有一条 Next `ENOENT app-paths-manifest.json` 日志，但用例本身已通过，未影响本次修复结论

## 结论

- 已确认失效点在后台提示词管理列表卡片，不在首页提示词卡片
- 修复后，点击管理页卡片主体可以进入详情页
- 相关管理页交互回归与首页卡片跳转回归均已通过
