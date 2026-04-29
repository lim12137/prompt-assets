# 类似系统复用登录状态设计说明（V1）

日期：2026-04-29

## 结论

当前建议继续采用 kit 的本地会话模式：每个系统保留自己的 `/login` 与本地 HttpOnly cookie，会话由本系统签发和校验，不共享原始 cookie。

## 本次落地边界

- 已落地：
  - 本地登录页 `/login`
  - 本地鉴权接口 `/api/login`、`/api/me`、`/api/logout`
  - 服务端 HMAC token（非 JWT）+ HttpOnly cookie
  - 管理接口改为服务端解析 cookie（写接口禁用 `x-user-email`）
  - `app/admin/layout.jsx` 页面层守卫（未登录/非管理跳登录）
  - 权限判定 fail-closed（默认 deny）
  - `LOGIN_TOKEN_SECRET` 缺失区分为配置错误（500 + `auth_configuration_error`）
  - OA 两跳登录请求复用会话 cookie
- 未落地（后续）：
  - 统一白名单 CRUD（含 `ADMIN_API_TOKEN`）
  - 前端 RSA 加密提交
  - 跨系统 SSO 标准化

## 为什么不直接跨系统共享 cookie

- cookie 域、路径、SameSite、Secure 策略不同，跨系统直接复用脆弱。
- 每个业务系统权限模型不同，直接共享会放大权限耦合风险。
- kit 已明确“各系统本地会话”更稳妥。

## 可复用方案（后续路线）

### 方案 A：统一校验代理 + 本地换票（短期推荐）

1. 各系统仍使用本地 `/login`。
2. 后端调用统一 OA 校验代理（或直连 OA）验证账号密码。
3. 校验成功后各系统签发自己的本地 token（短 TTL）。
4. 各系统只信任本系统 cookie。

优点：改造小，兼容现有接口。  
风险：仍是多系统重复登录体验。

### 方案 B：OIDC（中长期推荐）

1. 建统一身份提供方（IdP），支持 OIDC Authorization Code + PKCE。
2. 业务系统仅做 OIDC Client。
3. 每系统本地 session 由 OIDC token 换发，不暴露上游 token 给前端。

优点：标准化 SSO、审计和撤销机制完整。  
风险：一次性改造成本较高。

## 接口/会话契约建议

- Token payload 最小字段：`uid/name/can_manage/can_manage_whitelist/exp/nonce`
- Cookie：
  - 名称默认 `auth_token`（可被 `LOGIN_COOKIE_NAME` 覆盖）
  - `HttpOnly; SameSite=Lax; Path=/`
  - 生产默认启用 `Secure`（`NODE_ENV=production`）
  - 可通过 `LOGIN_COOKIE_SECURE=false` 显式关闭（仅建议非生产调试）
- 管理接口统一：
  - `requireManageUser(request)` 从 cookie 解析用户
  - 禁止再使用 `x-user-role/x-user-email` 作为权限依据

## 权限策略（更新）

- `WHITELIST_ENABLED=true`：按 `WHITELIST_DEFAULT_*` 与 `WHITELIST_ADMIN_*` 判定。
- `WHITELIST_ENABLED!=true`：默认 `can_manage=false`（fail-closed）。
- 若需要“登录即管理”，必须显式配置 `ALLOW_ALL_LOGIN_USERS_MANAGE=true`。

## 风险与控制

- `LOGIN_TOKEN_SECRET` 必须稳定且强随机；变更会导致所有会话失效。
- 白名单开启后，`WHITELIST_*` 需配套运维流程，避免误封管理员。
- 管理页面守卫当前统一回跳 `/admin`；深链回跳保留可后续增强。
