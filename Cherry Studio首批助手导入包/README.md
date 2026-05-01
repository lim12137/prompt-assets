# Cherry Studio 首批助手导入包

## 来源

- 官方订阅字段基线：`name`、`description`、`group`、`id`、`prompt`
- 官方来源文件：
  - `https://raw.githubusercontent.com/CherryHQ/cherry-studio/main/resources/data/agents-en.json`
  - 文档页：`https://docs.cherry-ai.com/pre-basic/data-settings/assistants-subscribe.md`
- 本批内容按 2026-05-01 抽取，目标是生成可直接用于本仓库管理员导入页的最小可用 JSON。

## 字段映射

官方字段到本仓库导入字段的映射如下：

| Cherry Studio | 本仓库导入字段 | 说明 |
| --- | --- | --- |
| `name` | `title` | 保留官方助手名称 |
| `description` | `summary` | 保留官方用途说明 |
| `prompt` | `content` | 保留官方提示词正文 |
| 推导生成 | `slug` | 由名称转为小写短横线，便于导入后内部标识 |
| `group` | 未写入导入 JSON | 保留在本 README 中，作为分类和替代判断依据 |
| `id` | 未写入导入 JSON | 保留在本 README 中，作为官方源追溯依据 |

说明：

- 本仓库导入最小兼容字段已经确认是：`title`、`summary`、`content`，`slug` 可选。
- 本批未写入 `categorySlug/categorySlugs`，避免与当前仓库分类体系产生误绑定。

## 分类依据

本批按你指定的四类场景组织，导入 JSON 内做唯一项去重，分类关系在此说明。

### 1. 报表 / 经营分析

| 官方名称 | 官方 ID | 官方 group |
| --- | --- | --- |
| Business Data Analysis | 10 | Career |
| Data Analyst | 14 | Career |
| Data Scientist | 211 | Career, Tools, Programming |
| Scientific Data Visualizer | 146 | Academic, Tools, Encyclopedia |

判定依据：

- 这四项分别覆盖业务分析、数据处理、数据建模、数据可视化，能支撑报表解读、经营分析和数据洞察类使用场景。

### 2. 转录文本整理

| 官方名称 | 官方 ID | 官方 group |
| --- | --- | --- |
| Voice Input Optimizer | 216 | Tools, Life |
| Meeting Summary | 33 | Tools |
| Note-taking Assistant | 208 | Education, Tools, Copywriting |
| Writing Assistant | 215 | Copywriting, Education |
| Content Summarizer | 221 | Copywriting, Tools |

判定依据：

- 这五项从语音转写优化、会议纪要、笔记整理、文字润色、内容摘要五个环节覆盖转录文本整理流程。

### 3. 火电职工相关场景

| 官方名称 | 官方 ID | 官方 group |
| --- | --- | --- |
| Human Resources Management | 19 | Career |
| Administration | 20 | Career |
| Project Management | 11 | Career |
| Legal Affairs | 26 | Career |

判定依据：

- 这里按“火电职工日常办公与管理场景”落最小首批，不假设官方库存在“火电职工”专名条目。
- 首批优先覆盖人事、行政、项目、法务四类在电厂/能源企业内部最常见的制度、流程、协调和合规场景。

### 4. 政策分析

| 官方名称 | 官方 ID | 官方 group |
| --- | --- | --- |
| Legal Affairs | 26 | Career |
| Academic Researcher | 224 | Academic, Education |
| Journalist | 153 | Copywriting, Career, Education |
| Writing Materials Collector | 220 | Copywriting, Education |

判定依据：

- 政策分析通常需要法规理解、资料检索、事实核验、材料整理与输出。
- 这四项分别对应法规判断、研究写作、信息采写、资料收集。

## 替代关系

本次指定的 16 个英文名称均在官方源中存在，无需用近似条目替代。

补充说明：

- `Legal Affairs` 同时属于“火电职工相关场景”和“政策分析”两类。
- 导入 JSON 为避免重复导入，仅保留 1 条 `Legal Affairs`。

## 导入方式

本目录当前包含两份导入包：

- `cherry-studio-first-batch.import.json`：首批英文整理版
- `cherry-studio-first-batch.zh-CN.import.json`：首批中文化整理版

1. 打开本仓库前台管理端导入页。
2. 按需要读取本目录下对应的导入包文件。
3. 将整个 JSON 数组粘贴到导入输入框。
4. 执行导入。

建议：

- 先在测试环境导入，确认 slug、标题和摘要展示符合预期。
- 导入完成后，再按你们自己的分类体系补充 `categorySlugs` 版本。
- 下一批可以继续沿用同样方式，从官方源筛更多行业场景包。
