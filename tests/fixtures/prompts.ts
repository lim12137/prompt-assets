export type CategoryFixture = {
  name: string;
  slug: string;
  sortOrder: number;
  status?: "active" | "inactive";
};

export type PromptVersionFixture = {
  versionNo: string;
  content: string;
  changeNote?: string;
  sourceType?: "create" | "edit" | "submission" | "rollback";
  submittedByEmail?: string;
};

export type PromptFixture = {
  slug: string;
  title: string;
  summary: string;
  categorySlug: string;
  status?: "draft" | "published" | "archived";
  currentVersionNo: string;
  versions: PromptVersionFixture[];
  likesByEmails?: string[];
};

export type SubmissionFixture = {
  promptSlug: string;
  baseVersionNo: string;
  candidateVersionNo: string;
  submitterEmail: string;
  status: "pending" | "approved" | "rejected";
  reviewComment?: string;
};

export const baseCategories: CategoryFixture[] = [
  { name: "内容创作", slug: "content-creation", sortOrder: 10, status: "active" },
  { name: "编程", slug: "programming", sortOrder: 20, status: "active" },
  { name: "设计", slug: "design", sortOrder: 30, status: "active" },
];

export const promptCatalog: PromptFixture[] = [
  {
    slug: "blog-outline-generator",
    title: "博客大纲生成器",
    summary: "输入主题后自动拆分为可执行章节结构。",
    categorySlug: "content-creation",
    status: "published",
    currentVersionNo: "v0001",
    versions: [
      {
        versionNo: "v0001",
        content: "你是一名内容策划，请为主题生成 5 章博客大纲，每章包含 3 个要点。",
        sourceType: "create",
        submittedByEmail: "admin@example.com",
      },
    ],
    likesByEmails: ["alice@example.com"],
  },
  {
    slug: "social-hook-pack",
    title: "社媒开头钩子包",
    summary: "快速生成短内容开场句，提升点击率。",
    categorySlug: "content-creation",
    status: "published",
    currentVersionNo: "v0002",
    versions: [
      {
        versionNo: "v0001",
        content: "请围绕给定主题生成 10 条社媒开头钩子，控制在 20 字以内。",
        sourceType: "create",
        submittedByEmail: "admin@example.com",
      },
      {
        versionNo: "v0002",
        content: "请围绕主题生成 12 条高点击开头钩子，并附带适用场景标签。",
        sourceType: "edit",
        submittedByEmail: "alice@example.com",
      },
    ],
    likesByEmails: ["alice@example.com", "bob@example.com"],
  },
  {
    slug: "short-video-script",
    title: "短视频脚本草案",
    summary: "基于目标受众生成 60 秒短视频脚本。",
    categorySlug: "content-creation",
    status: "published",
    currentVersionNo: "v0001",
    versions: [
      {
        versionNo: "v0001",
        content: "根据产品卖点输出 60 秒脚本，包含开场、冲突、转折与结尾行动指令。",
        sourceType: "create",
        submittedByEmail: "admin@example.com",
      },
    ],
    likesByEmails: ["carol@example.com"],
  },
  {
    slug: "newsletter-polisher",
    title: "邮件通讯润色器",
    summary: "优化语气、逻辑和行动号召。",
    categorySlug: "content-creation",
    status: "published",
    currentVersionNo: "v0002",
    versions: [
      {
        versionNo: "v0001",
        content: "将邮件草稿润色为专业、清晰、友好的语气，并保留原意。",
        sourceType: "create",
        submittedByEmail: "admin@example.com",
      },
      {
        versionNo: "v0002",
        content: "润色邮件并给出 2 个更强 CTA 版本，标注推荐原因。",
        sourceType: "edit",
        submittedByEmail: "bob@example.com",
      },
    ],
    likesByEmails: ["alice@example.com", "bob@example.com", "carol@example.com"],
  },
  {
    slug: "js-code-reviewer",
    title: "JavaScript 代码审查助手",
    summary: "识别异味并给出可执行修复建议。",
    categorySlug: "programming",
    status: "published",
    currentVersionNo: "v0001",
    versions: [
      {
        versionNo: "v0001",
        content: "审查给定 JS 代码，按正确性、可维护性、性能三维输出问题与修复建议。",
        sourceType: "create",
        submittedByEmail: "admin@example.com",
      },
      {
        versionNo: "v0002",
        content: "增加安全与测试覆盖维度，输出风险等级与最小修复 patch。",
        sourceType: "submission",
        submittedByEmail: "alice@example.com",
      },
    ],
    likesByEmails: ["bob@example.com"],
  },
  {
    slug: "sql-index-advisor",
    title: "SQL 索引建议器",
    summary: "分析慢查询并给出索引策略。",
    categorySlug: "programming",
    status: "published",
    currentVersionNo: "v0001",
    versions: [
      {
        versionNo: "v0001",
        content: "根据 SQL 与表结构信息，识别瓶颈并给出索引建议与副作用说明。",
        sourceType: "create",
        submittedByEmail: "admin@example.com",
      },
    ],
    likesByEmails: ["alice@example.com", "carol@example.com"],
  },
  {
    slug: "api-debug-assistant",
    title: "API 报错定位助手",
    summary: "结合日志与请求样例快速定位错误根因。",
    categorySlug: "programming",
    status: "published",
    currentVersionNo: "v0002",
    versions: [
      {
        versionNo: "v0001",
        content: "根据错误日志与请求响应样例，给出排查步骤和优先级。",
        sourceType: "create",
        submittedByEmail: "admin@example.com",
      },
      {
        versionNo: "v0002",
        content: "补充重现路径、可能根因树和临时止血方案。",
        sourceType: "edit",
        submittedByEmail: "carol@example.com",
      },
    ],
  },
  {
    slug: "landing-copy-framework",
    title: "落地页文案框架",
    summary: "围绕价值主张生成首屏与核心模块文案。",
    categorySlug: "design",
    status: "published",
    currentVersionNo: "v0001",
    versions: [
      {
        versionNo: "v0001",
        content: "按首屏、痛点、方案、证明、行动 5 段生成落地页文案草稿。",
        sourceType: "create",
        submittedByEmail: "admin@example.com",
      },
      {
        versionNo: "v0002",
        content: "增加 B2B 场景语气，强化数据化收益表达并缩短段落。",
        sourceType: "submission",
        submittedByEmail: "bob@example.com",
      },
    ],
    likesByEmails: ["carol@example.com"],
  },
  {
    slug: "figma-wireframe-brief",
    title: "Figma 线框图需求书",
    summary: "把业务需求转成可执行页面线框说明。",
    categorySlug: "design",
    status: "published",
    currentVersionNo: "v0001",
    versions: [
      {
        versionNo: "v0001",
        content: "将需求描述拆分为页面结构、信息层级、组件清单和交互说明。",
        sourceType: "create",
        submittedByEmail: "admin@example.com",
      },
    ],
    likesByEmails: ["alice@example.com"],
  },
  {
    slug: "ux-research-plan",
    title: "UX 研究计划器",
    summary: "快速生成访谈与可用性测试计划。",
    categorySlug: "design",
    status: "published",
    currentVersionNo: "v0002",
    versions: [
      {
        versionNo: "v0001",
        content: "输出 2 周用户研究计划，包含目标、样本、问题与里程碑。",
        sourceType: "create",
        submittedByEmail: "admin@example.com",
      },
      {
        versionNo: "v0002",
        content: "追加风险假设验证矩阵与访谈记录模板。",
        sourceType: "edit",
        submittedByEmail: "alice@example.com",
      },
    ],
    likesByEmails: ["bob@example.com", "carol@example.com"],
  },
];

export const pendingSubmissionFixture: SubmissionFixture[] = [
  {
    promptSlug: "js-code-reviewer",
    baseVersionNo: "v0001",
    candidateVersionNo: "v0002",
    submitterEmail: "alice@example.com",
    status: "pending",
  },
  {
    promptSlug: "landing-copy-framework",
    baseVersionNo: "v0001",
    candidateVersionNo: "v0002",
    submitterEmail: "bob@example.com",
    status: "pending",
  },
];
