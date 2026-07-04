# 提示词管理 SSO 统一认证迁移设计（方案 A）

> 日期：2026-07-04
> 依据：`docs/2026-07-02-sso-refactoring-lessons-learned.md`（SSO 迁移手册，位于 `D:\1work\技能广场`）
> 目标项目：提示词管理（Next.js 15 App Router + React 19 + Drizzle/PostgreSQL）
> 状态：设计待评审

---

## 0. 设计基线（已确认决策）

| # | 决策 | 选择 | 理由 |
|---|---|---|---|
| D1 | SSO 信息完备度 | 部分有，缺 client_secret/redirect_uri 白名单 | 代码结构 + `.env.example` 占位，待管理员给真实值 |
| D2 | 网络拓扑 | 内网同段、不同域 | 跨域 Cookie 风险存在 → 必须同域代理 |
| D3 | 旧 OA 登录去留 | SSO 为主，旧登录隐藏（保留代码作回退） | playbook 13.13：至少保留一个迭代 |
| D4 | SSO 登录页处理 | 代理到同域 `/auth/login` | playbook 13.7：同域是大退硬验收前提 |
| D5 | email 来源 | SSO 不返回 email，用工号拼占位 | `${userAccount}@internal.local` |
| D6 | 同域代理实现层 | Next.js 后端原生代理（catch-all 路由） | 开发生产同套代码，可控 |
| D7 | 登录入口页样式 | 复用本项目现有 `/login` React 设计 | 仅新增 SSO 按钮 |
| D8 | 整体架构 | 方案 A：Authorization Code + PKCE + 机密客户端 | playbook 目标架构 |

---

## 1. 模块清单与文件落点

全部在 `apps/web/`（Next.js 单体，前后端同 app）。

| # | 模块 | 落点 | 类型 |
|---|---|---|---|
| 1 | SSO 端点配置 | `.env` + `.env.example`（补全占位） | 改 |
| 2 | SSO client（机密 + PKCE） | `apps/web/lib/auth/sso/sso-client.ts` | 新增 |
| 3 | state/nonce/codeVerifier 存储 | `apps/web/lib/auth/sso/state-store.ts` | 新增 |
| 4 | start 接口 | `apps/web/app/api/auth/sso/start/route.ts` | 新增 |
| 5 | callback 接口 | `apps/web/app/api/auth/sso/callback/route.ts` | 新增 |
| 6 | logout-all 接口 | `apps/web/app/api/auth/sso/logout-all/route.ts` | 新增 |
| 7 | session 签发 | `apps/web/lib/auth/session.ts`（复用 `signLoginToken`/`buildLoginCookie`） | 复用 |
| 8 | PKCE 工具 | `apps/web/lib/auth/sso/pkce.ts` | 新增 |
| 9 | 配置读取 | `apps/web/lib/auth/sso/sso-config.ts` | 新增 |
| 10 | 用户映射 | `apps/web/lib/auth/sso/user-mapper.ts` | 新增 |
| 11 | URL 拼接 helper | `apps/web/lib/auth/sso/url-helper.ts` | 新增 |
| 12 | HTML 代理改写 | `apps/web/lib/auth/sso/proxy-html.ts` | 新增 |
| 13 | 同域代理 catch-all | `apps/web/app/auth/[...path]/route.ts` | 新增 |
| 14 | 前端入口（加 SSO 按钮） | `apps/web/app/login/page.jsx` | 改 |
| 15 | 前端 callback 页 | `apps/web/app/auth/callback/success/page.tsx`、`.../failure/page.tsx` | 新增 |
| 16 | `.env` 入库安全修复 | `.gitignore` 加 `.env`、`.env.local` | 改 |
| 17 | `.env.example` 补全 | 补 SSO 变量 + 现有 auth 变量文档 | 改 |
| 18 | 测试 | `tests/unit/auth/sso/*` + `tests/integration/auth-sso.test.ts` + e2e | 新增 |

**保留不动**：`oa-client.ts`、`/api/login`、`/api/logout`（本地退出）、`/api/me`、`session.ts` 核心 token 逻辑、`app/admin/layout.jsx` 守卫、所有现有 API 的鉴权调用。

---

## 2. 目标架构与登录链路

### 2.1 SSO 登录完整链路

```text
用户访问 /admin（未登录）
  → admin 守卫重定向 /login?redirect=/admin
  → /login 页（本项目样式）展示"统一认证登录"按钮
  → 用户点击按钮
  → 前端 POST /api/auth/sso/start { returnTo: "/admin" }
  → 后端生成 state + nonce + codeVerifier，存入 state-store（TTL 300s）
  → 后端返回 { authorizeUrl }
  → 前端 window.location = authorizeUrl（同域 /auth/oauth2/authorize?...）
  → 浏览器请求 /auth/oauth2/authorize
  → Next.js 代理 catch-all 转发到 SSO origin（服务端直连，不经浏览器）
  → SSO 302 到 /auth/login（同域，SSO 自己的 HTML 登录页）
  → Next.js 代理返回 SSO 登录页 HTML（改写 CSP/nonce，见 §6）
  → 用户输入账号密码
  → SSO 脚本 POST 到 SSO origin 验证
  → SSO 验证通过，302 到 redirect_uri（同域 /api/auth/sso/callback?code=...&state=...）
  → 后端校验 state（一次性消费）
  → 后端用 code + codeVerifier + client_secret(Basic Auth) 换 token
  → 后端验 id_token（iss/aud/exp/nonce）
  → 后端拉 userInfo（profileUrl）
  → 后端映射用户（user-mapper）
  → 后端签本系统 token（复用 signLoginToken），Set-Cookie
  → 后端 302 到 callbackSuccessRedirect（/auth/callback/success?returnTo=/admin）
  → 前端 callback success 页：调 /api/me 刷新，跳 returnTo
  → 进入系统
```

### 2.2 关键 URL 形态（同域代理落地后）

| URL | 浏览器访问 | 实际后端/代理 |
|---|---|---|
| 入口 | `http://<app-host>:3010/login` | Next.js 页面 |
| start | `http://<app-host>:3010/api/auth/sso/start` | Next.js API |
| authorize | `http://<app-host>:3010/auth/oauth2/authorize?...` | 代理 → SSO origin |
| 登录页 | `http://<app-host>:3010/auth/login` | 代理 → SSO origin HTML |
| callback | `http://<app-host>:3010/api/auth/sso/callback` | Next.js API |
| success | `http://<app-host>:3010/auth/callback/success` | Next.js 页面 |
| logout-all | `http://<app-host>:3010/api/auth/sso/logout-all` | Next.js API |
| SSO logout | `http://<app-host>:3010/auth/oauth2/session/logout/all` | 代理 → SSO origin |

> ⚠️ `redirect_uri`（SSO 后台白名单）填的是**后端 callback**：`http://<app-host>:3010/api/auth/sso/callback`，不是前端 success 页。

### 2.3 大退（SSO 全局退出）链路

```text
用户点"退出统一认证"
  → 前端 POST /api/auth/sso/logout-all
  → 后端读取本系统 session token
  → 后端清本系统 session（删 cookie）
  → 后端用 SSO access_token 调 logoutUrl（POST + Bearer）
    → 同域：浏览器在本应用域下访问 /auth/oauth2/session/logout/all
    → Next.js 代理转发到 SSO origin（带 SSO HttpOnly Cookie）
    → SSO 清 token session + 浏览器 Cookie session
  → 后端 302 到前端 /（或登录页）
  → 验收：再次点 SSO 必须重新输密码（playbook 13.10）
```

---

## 3. 安全边界（硬规则）

| 规则 | 实现 |
|---|---|
| `client_secret` 只在后端 | 仅 `sso-client.ts` 读取，`sso-config.ts` 从 env 注入；前端任何代码不接触 |
| `state` 一次性消费 | `state-store.ts` 取出即删；TTL 300s |
| `nonce` 校验 | start 存的 nonce 与 id_token 里的 nonce 比对 |
| PKCE `S256` | `pkce.ts` 生成 code_verifier（43-128 字符随机），`code_challenge = base64url(SHA256(code_verifier))` |
| 机密客户端认证 | token 交换用 `Authorization: Basic base64(client_id:client_secret)`，body 不重复放 secret |
| `redirect_uri` 精确匹配 | 来自 env `AGENT_UI_SSO_REDIRECT_URI`，和 SSO 后台白名单一致 |
| id_token 验签 | 校验 `iss`、`aud`、`exp`、`nonce`；JWKS 从 `jwksUrl` 拉取（缓存） |
| `returnTo` 防开放跳转 | 仅允许 hash 或站内相对路径（`/`开头），拒绝 `javascript:`、`//`、`http://` |
| HttpOnly Cookie | 复用 `buildLoginCookie`：`HttpOnly; SameSite=Lax; Path=/`，生产 `Secure` |
| 密钥不入库 | `.gitignore` 加 `.env`/`.env.local`；测试用 `test-secret-do-not-use-in-prod` |

---

## 4. 配置与环境变量

### 4.1 新增环境变量（写入 `.env.example`，占位值）

```env
# SSO 统一认证配置
AGENT_UI_SSO_ENABLED=true
AGENT_UI_SSO_CLIENT_ID=<找 SSO 管理员申请>
AGENT_UI_SSO_CLIENT_SECRET=<找 SSO 管理员申请，不入库>
AGENT_UI_SSO_REDIRECT_URI=http://<app-host>:3010/api/auth/sso/callback
AGENT_UI_SSO_AUTHORIZE_URL=http://<sso-host>:<sso-port>/auth/oauth2/authorize
AGENT_UI_SSO_TOKEN_URL=http://<sso-host>:<sso-port>/auth/oauth2/token
AGENT_UI_SSO_PROFILE_URL=http://<sso-host>:<sso-port>/system/user/getInfo
AGENT_UI_SSO_JWKS_URL=http://<sso-host>:<sso-port>/auth/oauth2/jwks
AGENT_UI_SSO_ISSUER=http://<sso-host>:<sso-port>/auth
AGENT_UI_SSO_LOGOUT_URL=http://<sso-host>:<sso-port>/auth/oauth2/session/logout/all
AGENT_UI_SSO_SSO_ORIGIN=http://<sso-host>:<sso-port>
AGENT_UI_SSO_SCOPE=openid profile
AGENT_UI_SSO_STATE_TTL_SECONDS=300

# 前端回跳基址（不写死端口）
AGENT_UI_FRONTEND_BASE_URL=http://<app-host>:3010

# 旧 OA 登录（保留，作回退；新部署可关闭）
AGENT_UI_LEGACY_LOGIN_VISIBLE=false
```

### 4.2 现有保留变量（已在 `.env`，文档化进 `.env.example`）

```env
AWS_PORTAL_URL=http://<oa-host>:<port>
LOGIN_TOKEN_SECRET=<强随机>
RSA_MODULUS_HEX=<...>
RSA_EXPONENT=65537
WHITELIST_ENABLED=true
WHITELIST_DEFAULT_IDS=
WHITELIST_ADMIN_USER_IDS=
LOGIN_COOKIE_NAME=auth_token
LOGIN_TOKEN_TTL_MINUTES=120
LOGIN_COOKIE_SECURE=auto
ALLOW_ALL_LOGIN_USERS_MANAGE=false
```

### 4.3 配置优先级

```text
环境变量 > 私有 .env 文件 > 无默认值（缺失报 auth_configuration_error）
```

### 4.4 `.env` 入库安全修复（playbook 坑 4/5）

- 当前 `.gitignore` **没有** `.env` 规则，`.env` 含 `LOGIN_TOKEN_SECRET`，已被跟踪。
- 改造步骤：
  1. `.gitignore` 增加 `.env`、`.env.local`，并保留 `!.env.example` 例外。
  2. `.env.example` 补全所有 auth/SSO 变量（占位值，不含真实密钥）。
  3. 真实 `.env` 仍可本地保留，但不再被跟踪新增变更（历史提交的 secret 由后续安全工单处理，本次不回溯改历史）。
  4. 提交前用 `rg -n "clientSecret|CLIENT_SECRET" apps tests` 检查无真实值入库。

### 4.5 启动校验

`sso-config.ts` 在首次读取时（`loadSsoConfig()`）：
- `AGENT_UI_SSO_ENABLED=true` 但缺 `CLIENT_ID`/`CLIENT_SECRET`/`REDIRECT_URI` → 抛 `AuthConfigurationError`，start 接口返回 500 + `auth_configuration_error`。
- `AGENT_UI_SSO_ENABLED!=true` → start 接口返回 404 + `sso_disabled`，前端隐藏 SSO 按钮。

---

## 5. 后端接口契约

### 5.1 `POST /api/auth/sso/start`

请求体：`{ "returnTo"?: string }`（可选，默认 `/admin`）

响应 200：
```json
{ "authorizeUrl": "http://<app-host>:3010/auth/oauth2/authorize?response_type=code&client_id=...&redirect_uri=...&scope=openid%20profile&state=...&nonce=...&code_challenge=...&code_challenge_method=S256" }
```

逻辑：
1. 读取 `returnTo`，过安全过滤（§3）。
2. 生成 `state`（randomUUID）、`nonce`（randomUUID）、`codeVerifier`（pkce.ts）。
3. 存入 state-store：`{ state → { nonce, codeVerifier, returnTo, expiresAt } }`。
4. 拼 `authorizeUrl`：用 url-helper，**走同域代理路径** `/auth/oauth2/authorize`（不是 SSO origin 绝对地址），query 含上述参数。

错误：
- 500 `auth_configuration_error`：SSO 配置缺失。
- 404 `sso_disabled`：SSO 未启用。

### 5.2 `GET /api/auth/sso/callback?code=...&state=...`

逻辑：
1. 取 `code`、`state`，缺失 → 302 到 failure（`error=invalid_request`）。
2. 从 state-store 取出 `state`（取出即删，一次性）。不存在/过期 → 302 failure（`error=invalid_state`）。
3. token 交换：POST `tokenUrl`，Basic Auth，body `{ grant_type: authorization_code, code, redirect_uri, code_verifier }`。
4. 失败（`invalid_client`/`invalid_grant`）→ 302 failure（`error=exchange_failed`）。
5. 验 id_token：解 JWT，校验 `iss`、`aud`、`exp`、`nonce`。JWKS 验签。失败 → 302 failure（`error=invalid_id_token`）。
6. 拉 userInfo：GET `profileUrl` + `Authorization: Bearer <access_token>`。
7. 映射用户（user-mapper）：取 `userAccount`（或 fallback 字段），拼 `email = ${userAccount}@internal.local`，取 `name`/`department`。
8. 缺 `userAccount` → 302 failure（`error=missing_user_account`）。
9. 解析 manage flags（复用 `resolveManageFlags` + `parseWhitelistSettingsFromEnv`）。
10. 签 token（`signLoginToken`），Set-Cookie（`buildLoginCookie`）。
11. 302 到 success：`/auth/callback/success?returnTo=<过滤后的>`。

> SSO 返回的 `access_token` / `refresh_token` 存内存 state-store（key=新 state 或 session id），供 logout-all 使用。不写进本系统 token、不进 cookie。

### 5.3 `POST /api/auth/sso/logout-all`

逻辑：
1. 读本系统 session（`getUserFromRequest`）。无 session → 401 `{ error: "no session", code: "no_session" }`（playbook 13.12：不让前端误判成功）。
2. 取对应 SSO access_token（从 state-store）。
3. 调 `logoutUrl`：POST，`Authorization: Bearer <access_token>`。
4. 清本系统 cookie。
5. 响应 200 `{ logoutUrl: "/auth/oauth2/session/logout/all" }` 或直接 302 到同域 SSO logout，让浏览器同域清 Cookie。
6. 前端收到后跳转，触发浏览器访问同域 SSO logout → SSO HttpOnly Cookie 被清。

> 大退验收依赖浏览器最终访问同域 `/auth/oauth2/session/logout/all`，后端单方面调 logout 接口不够（playbook 坑 9）。

### 5.4 `GET /api/auth/sso/config`（内部，可选）

返回当前 SSO 是否启用、前端入口可见性（`AGENT_UI_LEGACY_LOGIN_VISIBLE`）。前端登录页据此决定显示哪些入口。

---

## 6. 同域代理与 HTML 改写（`app/auth/[...path]/route.ts`）

### 6.1 代理范围

catch-all 匹配 `/auth/*`，转发到 `${AGENT_UI_SSO_SSO_ORIGIN}/auth/*`：
- `/auth/oauth2/authorize` → SSO origin
- `/auth/login` → SSO origin（HTML）
- `/auth/oauth2/session/logout/all` → SSO origin
- 其它 `/auth/*` → SSO origin

**不代理** `/api/*`、`/system/*`（除明确列出的找回密码接口，见 §6.4）。

### 6.2 请求转发

- 方法透传（GET/POST）。
- 请求头：透传必要的 `content-type`、`accept`、`cookie`（浏览器到本应用域的 cookie 转发给 SSO）。
- body 透传。

### 6.3 HTML 响应改写（仅 `content-type: text/html`）

按 playbook 第 13.8 节：

1. **删 `content-length`**（body 被改写，长度变了）。
2. **删 Google Fonts link**（内网访问不到，改用系统字体）。
3. **生成 nonce**（randomUUID）。
4. **给所有 `<style>` 加 `nonce` 属性**。
5. **给所有 `<script>` 加 `nonce` 属性**。
6. **改写 CSP 响应头**：补 `style-src 'self' 'nonce-...'`、`script-src 'self' 'nonce-...'`，不用 `unsafe-inline`。
7. **改写找回密码接口地址**（见 §6.4）。
8. **改写 Location 重定向**（见 §6.5）：SSO 302 的绝对 URL 改成同域相对路径。

### 6.4 找回密码接口（playbook 坑 11）

策略：把 SSO HTML 里的 `/system/forgotPassword/sendCode`、`/system/forgotPassword/reset` 改写为 **SSO origin 绝对地址**（直连 SSO），不在本系统代理整个 `/system/`（避免覆盖本系统未来可能的路由）。

实现：HTML 改写时正则替换 `action="/system/forgotPassword/..."` 和 `fetch("/system/forgotPassword/...")` 为 `${SSO_ORIGIN}/system/forgotPassword/...`。

> 直连 SSO origin 意味着找回密码是跨域请求，但找回密码本身不依赖 SSO 会话 Cookie（验证码走手机/邮箱），跨域可接受。若 SSO 后台要求同域，则改为代理 `/system/forgotPassword/*`（精确路径）。

### 6.5 Location 重写

SSO 302 返回 `Location: http://<sso-host>:<port>/auth/login?...`，代理改成 `Location: /auth/login?...`（同域相对），保持浏览器不跳出应用域。query 保留。

### 6.6 非 HTML 响应

JSON / 重定向 / 静态资源：透传，不改写 body。仅按 §6.5 改 Location。

---

## 7. 前端改动

### 7.1 `/login` 页（`apps/web/app/login/page.jsx`）

- 保留现有设计（hero + 表单两栏布局）。
- 新增"统一认证登录"主按钮（醒目，置顶）。
- 旧账号密码表单：根据 `AGENT_UI_LEGACY_LOGIN_VISIBLE`（运行时通过 `/api/auth/sso/config` 获取）决定显示。默认 `false`（隐藏），可在开发环境打开。
- SSO 按钮点击：`POST /api/auth/sso/start`，拿 `authorizeUrl` 后 `window.location.href = authorizeUrl`。
- 保留 `?redirect=` 参数透传为 `returnTo`。

### 7.2 `/auth/callback/success`（新增）

- 读取 `?returnTo=`（默认 `/admin`）。
- 调 `/api/me` 刷新登录态。
- `router.replace(returnTo)`。
- 极简 UI：loading spinner + "登录成功，正在跳转..."。

### 7.3 `/auth/callback/failure`（新增）

- 读取 `?error=`。
- 展示中文错误映射：
  - `invalid_state` → "登录状态已过期，请重试"
  - `exchange_failed` → "登录服务暂不可用，请稍后重试或联系管理员"
  - `invalid_id_token` → "登录凭证校验失败，请重试"
  - `missing_user_account` → "未识别到用户身份，请联系管理员"
  - `invalid_request` → "登录请求参数错误"
- 提供"返回登录"按钮 → `/login`。

### 7.4 顶部 auth widget（`auth-status.js` / `logout-button.js`）

- 已登录：现有"退出"按钮改为下拉或两选项：
  - "退出本系统"（调 `/api/logout`，仅清本系统）
  - "退出统一认证"（调 `/api/auth/sso/logout-all`，清本系统 + SSO 全局）
- 默认突出"退出统一认证"（大退）。

---

## 8. 用户映射与 DB（`user-mapper.ts`）

### 8.1 SSO userInfo → 本系统用户

```text
SSO userInfo (profileUrl 返回):
  data.user.userAccount  →  uid（工号）
  data.user.userName / nickName  →  name
  data.user.deptName  →  department（可选）

映射结果:
  uid      = userAccount
  name     = userName || userAccount
  department = deptName
  email    = `${userAccount}@internal.local`  // 占位，供 DB users.email
```

字段名按 SSO 实际返回适配（playbook 12.4-1）。`profileUrl` 的 JSON 层级每个平台不同，`user-mapper` 做多字段 fallback。

### 8.2 DB 写入

复用 `prompt-repository.upsertUserId(email)`：SSO 登录成功后，callback 里调一次 upsert，确保 `users` 表有该 email 记录。`role` 默认 `user`，管理员通过 `WHITELIST_ADMIN_USER_IDS` 在 token 层控制（`can_manage`），不依赖 DB role。

### 8.3 字段缺失处理

- 缺 `userAccount` → failure（`missing_user_account`）。
- 缺 `userName` → 用 `userAccount` 作 name。
- 缺 `department` → undefined（token 里不带，UI 显示"-"）。

---

## 9. 测试策略

### 9.1 单元测试（`tests/unit/auth/sso/`）

| 文件 | 覆盖 |
|---|---|
| `pkce.test.ts` | code_verifier 长度/随机性；code_challenge = base64url(SHA256(verifier))；S256 |
| `state-store.test.ts` | 存取；一次性消费（取后即删）；TTL 过期；并发 |
| `url-helper.test.ts` | base 归一化（末尾 / 与否）；authorizeUrl 拼接；同域路径 |
| `sso-config.test.ts` | enabled 但缺配置 → AuthConfigurationError；disabled → 不报错 |
| `user-mapper.test.ts` | userAccount→uid；email 拼装；字段缺失 fallback；缺 userAccount → throw |
| `proxy-html.test.ts` | style/script 加 nonce；删 google fonts；找回密码改绝对地址；Location 重写；删 content-length |
| `start-route.test.ts` | 返回 authorizeUrl 含 state/nonce/PKCE；returnTo 过滤（拒 javascript://evil/、//evil、http://） |
| `id-token.test.ts` | iss/aud/exp/nonce 校验；JWKS 验签（mock） |

### 9.2 集成测试（`tests/integration/auth-sso.test.ts`）

- start → callback 完整链路（mock SSO token/userInfo 端点）。
- callback state 无效 → failure。
- callback 成功 → Set-Cookie + 302 success。
- token exchange 带 Basic Auth header（断言）。
- logout-all 无 session → 401。
- logout-all 代发 Bearer（断言 fetch 调用）。

### 9.3 E2E（playbook 13.10 大退验收）

- 登录成功 → 进入 /admin。
- callback success → 刷新 session。
- 大退 → 再点 SSO 必须重新认证（**核心验收**）。
- `/auth/login` 页样式正常（无 CSP 报错）。
- 找回密码按钮可点开弹窗。
- 发送验证码请求打到 SSO origin（看 network）。

> E2E 大退验收依赖真实 SSO 环境，标记 `@manual` 或 `@requires-sso`，CI 跳过，验收时手动/browser tool 执行。

### 9.4 现有测试兼容

- `tests/e2e/admin/create-login-redirect.spec.ts`、`tests/e2e/smoke/global-auth-header.spec.ts` 用 `signLoginToken` 直接造 token，**不依赖登录链路**，SSO 改造不影响它们（token 契约 `LoginTokenUser` 不变）。
- 现有 `tests/unit/auth/{session,oa-client,login-route}.test.ts` 保留（旧登录仍在）。

---

## 10. 实现顺序（分阶段，每阶段可独立验证）

| 阶段 | 内容 | 验证点 |
|---|---|---|
| P0 | `.env.example` 补全 + `.gitignore` 加 `.env` + `sso-config.ts` + `pkce.ts` + `url-helper.ts` + 单测 | 单测绿 |
| P1 | `state-store.ts` + `sso-client.ts`（token 交换/id_token 验签/userInfo） + `user-mapper.ts` + 单测 | 单测绿，mock 链路通 |
| P2 | `/api/auth/sso/start` + `/api/auth/sso/callback` + 集成测试 | mock 全链路通 |
| P3 | `/api/auth/sso/logout-all` + 集成测试 | logout 逻辑通 |
| P4 | 同域代理 `app/auth/[...path]/route.ts` + `proxy-html.ts` + 单测 | HTML 改写单测绿 |
| P5 | 前端：`/login` 加 SSO 按钮 + callback success/failure 页 + 顶部退出改造 | 浏览器手动跑通 |
| P6 | 真实 SSO 联调（待管理员给凭据）+ e2e 大退验收 | playbook 12.5 checkbox 全勾 |

> P0-P5 不依赖真实 SSO 凭据（用占位 + mock），可先行落地。P6 阻塞在凭据上。

---

## 11. 风险与开放问题

| # | 风险/问题 | 应对 |
|---|---|---|
| R1 | SSO 真实端点 path 前缀未知（`/oauth2/authorize` vs `/auth/oauth2/authorize`） | `.env.example` 标注占位，联调时按 playbook 坑 1 逐字段 diff |
| R2 | SSO 平台是否强制机密客户端、认证方式（basic vs post） | 按机密 + basic 实现（playbook 案例如此），联调时验证；如要 post 再适配 |
| R3 | userInfo JSON 层级未知 | `user-mapper` 多字段 fallback；联调时打日志确认 |
| R4 | JWKS 验签依赖 `jwksUrl`，SSO 可能不支持 | 先实现，若不支持则降级为只校验 id_token payload（iss/aud/exp/nonce），不验签名（需评审） |
| R5 | 同域代理在生产是否也由 Next.js 承担（还是 nginx） | 设计为 Next.js 承担，开发生产一致；若生产已有 nginx，可在 nginx 层做同域代理，Next.js 代理仅开发用（配置开关） |
| R6 | 找回密码跨域直连 SSO 是否被 CORS 拦 | 直连 POST 可能被 CORS 拦；若拦，改回代理 `/system/forgotPassword/*`（精确路径） |
| R7 | state-store 内存存储在多实例下失效 | 单实例够用；若上多实例，state-store 抽接口，换 Redis（留扩展点） |
| R8 | 旧 OA 登录隐藏后，开发环境怎么测 | `AGENT_UI_LEGACY_LOGIN_VISIBLE=true` 在开发打开 |

---

## 12. 不做的事（YAGNI）

- 不删除旧 OA 登录代码（`oa-client.ts`、`/api/login`）。
- 不做 refresh_token 自动续期（本系统 token TTL 120min 够用，过期重登）。
- 不做 SSO 多 IdP 支持（只接一个 SSO）。
- 不做 RBAC 从 SSO 同步（管理员判定仍走本地白名单）。
- 不做审计日志增强（现有 audit 不动）。
- 不回溯修改 git 历史里的 secret（单独安全工单）。
- 不做 NextAuth/Passport 迁移（保持自研 token 体系）。

---

## 13. 交付给实现的上下文（playbook 13.14）

```text
项目旧登录类型：OA（有度一体化）密码转发
SSO origin：<待管理员提供，占位 http://<sso-host>:<sso-port>>
authorizeUrl：/auth/oauth2/authorize（同域代理后）
tokenUrl：<SSO_ORIGIN>/auth/oauth2/token
profileUrl：<SSO_ORIGIN>/system/user/getInfo
jwksUrl：<SSO_ORIGIN>/auth/oauth2/jwks
issuer：<SSO_ORIGIN>/auth
logoutUrl：<SSO_ORIGIN>/auth/oauth2/session/logout/all
client 认证方式：client_secret_basic（待联调确认）
redirect_uri：http://<app-host>:3010/api/auth/sso/callback
frontendBaseUrl：http://<app-host>:3010
用户身份字段：userAccount（工号）；email = userAccount@internal.local（占位）
是否需要同域代理：是（Next.js catch-all 代理 /auth/*）
忘记密码接口归属：SSO（改写为 SSO origin 绝对地址直连）
验收口径：登录成功、大退后必须重新认证、找回密码可用、/auth/login 页样式正常
```
