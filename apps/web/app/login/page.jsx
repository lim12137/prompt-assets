"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const LOGIN_FEATURES = [
  { label: "提交改进版", icon: "spark" },
  { label: "点赞和评分", icon: "star" },
  { label: "进入管理页", icon: "shield" },
];

const styles = {
  page: {
    minHeight: "100vh",
    padding: "clamp(16px, 4vw, 28px)",
    display: "grid",
    placeItems: "center",
    background:
      "radial-gradient(circle at top left, rgba(31, 95, 149, 0.15), transparent 28%), radial-gradient(circle at right 20%, rgba(195, 32, 51, 0.1), transparent 24%), linear-gradient(180deg, #f4f7fb 0%, #eef3f8 56%, #e9eff6 100%)",
  },
  shell: {
    width: "min(1080px, 100%)",
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.08fr) minmax(320px, 0.92fr)",
    border: "1px solid rgba(255, 255, 255, 0.75)",
    borderRadius: "28px",
    overflow: "hidden",
    background: "linear-gradient(135deg, rgba(243, 247, 252, 0.88), rgba(255, 255, 255, 0.97))",
    boxShadow: "0 18px 48px rgba(31, 54, 84, 0.14)",
    backdropFilter: "blur(12px)",
  },
  hero: {
    position: "relative",
    padding: "30px 32px 26px",
    color: "#f7fbff",
    background:
      "linear-gradient(160deg, rgba(20, 54, 86, 0.96), rgba(28, 79, 119, 0.9)), linear-gradient(135deg, #204764, #17374e)",
    display: "grid",
    gap: "28px",
  },
  heroTopbar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "16px",
    flexWrap: "wrap",
  },
  brand: {
    display: "inline-flex",
    alignItems: "center",
    gap: "12px",
    fontWeight: 700,
    letterSpacing: "0.02em",
  },
  brandMark: {
    width: "42px",
    height: "42px",
    borderRadius: "12px",
    display: "grid",
    placeItems: "center",
    fontSize: "18px",
    background: "linear-gradient(135deg, rgba(255, 255, 255, 0.24), rgba(255, 255, 255, 0.08))",
    border: "1px solid rgba(255, 255, 255, 0.18)",
  },
  heroHeading: {
    margin: 0,
    fontSize: "clamp(28px, 4vw, 40px)",
    lineHeight: 1.12,
    letterSpacing: "0.01em",
  },
  heroSubtitle: {
    margin: "14px 0 0",
    maxWidth: "560px",
    fontSize: "15px",
    lineHeight: 1.65,
    color: "rgba(247, 251, 255, 0.78)",
  },
  heroFeatureGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "12px",
    marginTop: "14px",
  },
  heroFeatureCard: {
    display: "grid",
    justifyItems: "start",
    gap: "10px",
    padding: "14px",
    borderRadius: "18px",
    background: "linear-gradient(180deg, rgba(255, 255, 255, 0.12), rgba(255, 255, 255, 0.06))",
    border: "1px solid rgba(255, 255, 255, 0.14)",
    minHeight: "92px",
  },
  heroFeatureIcon: {
    width: "38px",
    height: "38px",
    borderRadius: "12px",
    display: "grid",
    placeItems: "center",
    background: "rgba(255, 255, 255, 0.14)",
    color: "#ffffff",
    boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.16)",
  },
  heroFeatureLabel: {
    fontSize: "14px",
    lineHeight: 1.4,
    color: "rgba(247, 251, 255, 0.94)",
    fontWeight: 600,
  },
  loginWrap: {
    padding: "28px 28px 24px",
    display: "grid",
    gap: "14px",
    background: "linear-gradient(180deg, rgba(255, 255, 255, 0.88), rgba(255, 255, 255, 0.98))",
  },
  loginHead: {
    display: "grid",
    gap: "8px",
  },
  loginTitle: {
    margin: 0,
    fontSize: "28px",
    color: "#18212b",
  },
  loginDescription: {
    margin: 0,
    color: "#5f6b7a",
    fontSize: "14px",
    lineHeight: 1.55,
  },
  card: {
    borderRadius: "18px",
    border: "1px solid rgba(24, 33, 43, 0.1)",
    background: "rgba(255, 255, 255, 0.92)",
    boxShadow: "0 12px 36px rgba(22, 36, 56, 0.08)",
  },
  formCard: {
    padding: "18px",
  },
  banner: {
    marginBottom: "14px",
    padding: "12px 14px",
    borderRadius: "14px",
    background: "linear-gradient(135deg, rgba(31, 95, 149, 0.08), rgba(195, 32, 51, 0.06))",
    border: "1px solid rgba(31, 95, 149, 0.12)",
  },
  fieldList: {
    display: "grid",
    gap: "12px",
  },
  field: {
    display: "grid",
    gap: "8px",
  },
  fieldRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
    flexWrap: "wrap",
  },
  fieldLabel: {
    fontSize: "13px",
    fontWeight: 700,
    color: "#18212b",
  },
  helperText: {
    color: "#5f6b7a",
    fontSize: "12px",
  },
  inputWrap: {
    position: "relative",
  },
  inputIcon: {
    position: "absolute",
    left: "14px",
    top: "50%",
    transform: "translateY(-50%)",
    color: "#7b8794",
    fontSize: "15px",
  },
  input: {
    width: "100%",
    height: "46px",
    padding: "0 14px 0 42px",
    borderRadius: "12px",
    border: "1px solid #d4dde7",
    background: "#fbfdff",
    font: "inherit",
    color: "#18212b",
    outline: "none",
  },
  formMeta: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
    marginTop: "2px",
    fontSize: "13px",
    color: "#5f6b7a",
    flexWrap: "wrap",
  },
  remember: {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
  },
  rememberDot: {
    width: "16px",
    height: "16px",
    borderRadius: "5px",
    border: "1px solid #c5d1dc",
    background: "linear-gradient(180deg, #ffffff, #f2f6fa)",
    position: "relative",
    flexShrink: 0,
  },
  rememberDotInner: {
    position: "absolute",
    inset: "3px",
    borderRadius: "3px",
    background: "#c32033",
  },
  submit: {
    marginTop: "10px",
    width: "100%",
    minHeight: "48px",
    border: 0,
    borderRadius: "14px",
    background: "linear-gradient(135deg, #c32033, #d83a4d)",
    color: "#ffffff",
    font: "inherit",
    fontSize: "16px",
    fontWeight: 700,
    letterSpacing: "0.02em",
    boxShadow: "0 14px 28px rgba(195, 32, 51, 0.24)",
    cursor: "pointer",
  },
  ssoButton: {
    width: "100%",
    minHeight: "48px",
    border: "1px solid rgba(31, 95, 149, 0.32)",
    borderRadius: "14px",
    background: "linear-gradient(135deg, #1f5f95, #2a72ad)",
    color: "#ffffff",
    font: "inherit",
    fontSize: "16px",
    fontWeight: 700,
    letterSpacing: "0.02em",
    boxShadow: "0 14px 28px rgba(31, 95, 149, 0.22)",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "10px",
  },
  divider: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    margin: "14px 0 4px",
    color: "#9aa6b2",
    fontSize: "12px",
  },
  dividerLine: {
    flex: 1,
    height: "1px",
    background: "rgba(24, 33, 43, 0.1)",
  },
  status: {
    marginTop: "10px",
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "12px 14px",
    borderRadius: "14px",
    background: "rgba(22, 121, 77, 0.08)",
    color: "#16794d",
    fontSize: "13px",
    lineHeight: 1.6,
    wordBreak: "break-word",
  },
  statusDot: {
    width: "10px",
    height: "10px",
    borderRadius: "999px",
    background: "currentColor",
    boxShadow: "0 0 0 4px rgba(22, 121, 77, 0.12)",
    flexShrink: 0,
  },
  footer: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    fontSize: "12px",
    color: "#5f6b7a",
    flexWrap: "wrap",
  },
};

function FeatureIcon({ type }) {
  if (type === "spark") {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z" />
      </svg>
    );
  }

  if (type === "star") {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3.5l2.6 5.3 5.9.9-4.2 4.1 1 5.8-5.3-2.8-5.3 2.8 1-5.8-4.2-4.1 5.9-.9L12 3.5z" />
      </svg>
    );
  }

  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l7 3v5c0 4.6-2.8 8.8-7 10-4.2-1.2-7-5.4-7-10V6l7-3z" />
      <path d="M9.5 12.5l1.7 1.7 3.3-3.7" />
    </svg>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState("登录环境检查正常，可提交认证请求。");
  // SSO 配置：是否启用、是否显示旧账号密码表单
  const [ssoEnabled, setSsoEnabled] = useState(false);
  const [legacyVisible, setLegacyVisible] = useState(false);
  const [ssoStarting, setSsoStarting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/sso/config", { credentials: "same-origin" })
      .then((res) => (res.ok ? res.json() : { ssoEnabled: false, legacyLoginVisible: false }))
      .then((data) => {
        if (cancelled) {
          return;
        }
        setSsoEnabled(data.ssoEnabled === true);
        // SSO 启用且未显式开 legacy 时，隐藏旧表单
        setLegacyVisible(data.legacyLoginVisible === true || data.ssoEnabled !== true);
      })
      .catch(() => {
        if (!cancelled) {
          setLegacyVisible(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSsoLogin() {
    if (ssoStarting) {
      return;
    }
    setSsoStarting(true);
    try {
      const returnTo = searchParams.get("redirect") ?? "/admin";
      const response = await fetch("/api/auth/sso/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ returnTo }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || typeof payload.authorizeUrl !== "string") {
        throw new Error(
          typeof payload.error === "string" && payload.error ? payload.error : "无法发起统一认证登录",
        );
      }
      // 跳转到同域 authorize（由 /auth/* 代理转发到 SSO）
      window.location.href = payload.authorizeUrl;
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "统一认证登录失败");
      setSsoStarting(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) {
      return;
    }

    setSubmitting(true);
    setFeedback("登录中...");
    try {
      const redirect = searchParams.get("redirect") ?? "/admin";
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, password, redirect }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          typeof payload.error === "string" && payload.error ? payload.error : "登录失败",
        );
      }
      router.replace(typeof payload.redirect === "string" ? payload.redirect : "/admin");
      router.refresh();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "登录失败");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main style={styles.page}>
      <section style={styles.shell} aria-label="有度一体化平台账号登录">
        <aside style={styles.hero}>
          <div style={styles.heroTopbar}>
            <div style={styles.brand}>
              <div style={styles.brandMark}>YD</div>
              <span>提示词资产管理门户</span>
            </div>
          </div>

          <div>
            <h1 style={styles.heroHeading}>有度一体化平台账号登录</h1>
            <p style={styles.heroSubtitle}>
              使用有度一体化平台账号登录，进入提示词管理后台。
            </p>
          </div>
          <div style={styles.heroFeatureGrid}>
            {LOGIN_FEATURES.map((item) => (
              <div key={item.label} style={styles.heroFeatureCard}>
                <div style={styles.heroFeatureIcon}>
                  <FeatureIcon type={item.icon} />
                </div>
                <div style={styles.heroFeatureLabel}>{item.label}</div>
              </div>
            ))}
          </div>
        </aside>

        <section style={styles.loginWrap}>
          <header style={styles.loginHead}>
            <h2 style={styles.loginTitle}>登录</h2>
            <p style={styles.loginDescription}>
              {ssoEnabled ? "使用统一认证账号登录，进入提示词管理后台。" : "请输入有度一体化平台账号与密码。"}
            </p>
          </header>

          {ssoEnabled ? (
            <button
              type="button"
              onClick={handleSsoLogin}
              disabled={ssoStarting}
              aria-busy={ssoStarting}
              style={{
                ...styles.ssoButton,
                opacity: ssoStarting ? 0.72 : 1,
                cursor: ssoStarting ? "progress" : "pointer",
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 2l8 4v6c0 5-3.5 9.5-8 10-4.5-.5-8-5-8-10V6l8-4z" />
                <path d="M9 12l2 2 4-4" />
              </svg>
              {ssoStarting ? "正在跳转..." : "统一认证登录"}
            </button>
          ) : null}

          {ssoEnabled && legacyVisible ? (
            <div style={styles.divider}>
              <span style={styles.dividerLine} />
              <span>或使用账号密码</span>
              <span style={styles.dividerLine} />
            </div>
          ) : null}

          {legacyVisible ? (
          <section style={{ ...styles.card, ...styles.formCard }}>
            <div style={styles.banner}>
              <strong style={{ display: "block", marginBottom: "4px", fontSize: "14px" }}>
                账号密码登录
              </strong>
              <span style={{ fontSize: "13px", color: "#5f6b7a", lineHeight: 1.6 }}>
                登录成功后将回到原目标页面。
              </span>
            </div>

            <form onSubmit={handleSubmit} style={styles.fieldList}>
              <div style={styles.field}>
                <div style={styles.fieldRow}>
                  <label htmlFor="username" style={styles.fieldLabel}>
                    账号
                  </label>
                  <small style={styles.helperText}>通常为 OA 用户名</small>
                </div>
                <div style={styles.inputWrap}>
                  <span aria-hidden="true" style={styles.inputIcon}>
                    工
                  </span>
                  <input
                    id="username"
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    placeholder="请输入有度一体化平台账号"
                    autoComplete="username"
                    required
                    style={styles.input}
                  />
                </div>
              </div>

              <div style={styles.field}>
                <div style={styles.fieldRow}>
                  <label htmlFor="password" style={styles.fieldLabel}>
                    密码
                  </label>
                  <small style={styles.helperText}>请输入当前账号密码</small>
                </div>
                <div style={styles.inputWrap}>
                  <span aria-hidden="true" style={styles.inputIcon}>
                    密
                  </span>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="请输入账号密码"
                    autoComplete="current-password"
                    required
                    style={styles.input}
                  />
                </div>
              </div>

              <div style={styles.formMeta}>
                <div style={styles.remember}>
                  <span aria-hidden="true" style={styles.rememberDot}>
                    <span style={styles.rememberDotInner} />
                  </span>
                  <span>本机 8 小时内保持登录状态</span>
                </div>
                <span>将自动回跳至原访问页面</span>
              </div>

              <button
                type="submit"
                disabled={submitting}
                aria-busy={submitting}
                style={{
                  ...styles.submit,
                  opacity: submitting ? 0.72 : 1,
                  cursor: submitting ? "progress" : "pointer",
                }}
              >
                {submitting ? "正在登录..." : "登录并进入系统"}
              </button>
            </form>
          </section>
          ) : null}

          <p
            role="status"
            aria-label="登录状态"
            aria-live="polite"
            style={styles.status}
          >
            <span aria-hidden="true" style={styles.statusDot} />
            <span>{feedback}</span>
          </p>

          <footer style={styles.footer}>
            <span>{ssoEnabled ? "统一认证 / 账号密码登录" : "有度一体化平台账号登录"}</span>
            <span>桌面端 / 移动端自适应</span>
          </footer>
        </section>
      </section>

      <style jsx>{`
        @media (max-width: 960px) {
          section[aria-label="有度一体化平台账号登录"] {
            grid-template-columns: 1fr !important;
          }

          section[aria-label="有度一体化平台账号登录"] aside,
          section[aria-label="有度一体化平台账号登录"] > section {
            padding: 26px 22px !important;
          }

          section[aria-label="有度一体化平台账号登录"] aside > div:last-child {
            grid-template-columns: 1fr !important;
          }
        }

        @media (max-width: 560px) {
          section[aria-label="有度一体化平台账号登录"] {
            border-radius: 24px !important;
          }
        }

        input:focus {
          border-color: rgba(31, 95, 149, 0.72);
          box-shadow: 0 0 0 4px rgba(31, 95, 149, 0.12);
          background: #ffffff;
        }
      `}</style>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
