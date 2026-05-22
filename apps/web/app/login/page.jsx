"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

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
    width: "min(1180px, 100%)",
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.08fr) minmax(320px, 0.92fr)",
    border: "1px solid rgba(255, 255, 255, 0.75)",
    borderRadius: "32px",
    overflow: "hidden",
    background: "linear-gradient(135deg, rgba(243, 247, 252, 0.88), rgba(255, 255, 255, 0.97))",
    boxShadow: "0 18px 48px rgba(31, 54, 84, 0.14)",
    backdropFilter: "blur(12px)",
  },
  hero: {
    position: "relative",
    padding: "40px 40px 34px",
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
  heroBadge: {
    padding: "8px 12px",
    borderRadius: "999px",
    border: "1px solid rgba(255, 255, 255, 0.16)",
    background: "rgba(255, 255, 255, 0.08)",
    fontSize: "13px",
    color: "rgba(247, 251, 255, 0.88)",
  },
  heroHeading: {
    margin: 0,
    fontSize: "clamp(32px, 5vw, 48px)",
    lineHeight: 1.12,
    letterSpacing: "0.01em",
  },
  heroSubtitle: {
    margin: "18px 0 0",
    maxWidth: "560px",
    fontSize: "16px",
    lineHeight: 1.75,
    color: "rgba(247, 251, 255, 0.78)",
  },
  heroPanels: {
    display: "grid",
    gap: "16px",
  },
  heroPanel: {
    position: "relative",
    padding: "18px 18px 18px 20px",
    borderRadius: "18px",
    background: "rgba(255, 255, 255, 0.08)",
    border: "1px solid rgba(255, 255, 255, 0.12)",
  },
  heroPanelLine: {
    position: "absolute",
    left: 0,
    top: "16px",
    bottom: "16px",
    width: "3px",
    borderRadius: "999px",
    background: "rgba(255, 255, 255, 0.55)",
  },
  heroPanelTitle: {
    margin: "0 0 8px",
    fontSize: "14px",
    color: "rgba(247, 251, 255, 0.72)",
  },
  heroPanelValue: {
    margin: 0,
    fontSize: "18px",
    fontWeight: 700,
  },
  heroGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "14px",
  },
  heroMetric: {
    padding: "16px",
    borderRadius: "14px",
    background: "rgba(255, 255, 255, 0.08)",
    border: "1px solid rgba(255, 255, 255, 0.1)",
  },
  loginWrap: {
    padding: "40px 36px 34px",
    display: "grid",
    gap: "20px",
    background: "linear-gradient(180deg, rgba(255, 255, 255, 0.88), rgba(255, 255, 255, 0.98))",
  },
  loginHead: {
    display: "grid",
    gap: "8px",
  },
  eyebrow: {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    color: "#1f5f95",
    fontSize: "13px",
    fontWeight: 700,
    letterSpacing: "0.04em",
  },
  loginTitle: {
    margin: 0,
    fontSize: "30px",
    color: "#18212b",
  },
  loginDescription: {
    margin: 0,
    color: "#5f6b7a",
    fontSize: "14px",
    lineHeight: 1.7,
  },
  tabs: {
    display: "inline-flex",
    padding: "5px",
    gap: "6px",
    width: "fit-content",
    borderRadius: "14px",
    background: "#f0f4f8",
    border: "1px solid rgba(24, 33, 43, 0.1)",
  },
  tabActive: {
    padding: "10px 16px",
    borderRadius: "10px",
    border: 0,
    font: "inherit",
    color: "#18212b",
    background: "#ffffff",
    boxShadow: "0 4px 12px rgba(24, 33, 43, 0.08)",
    fontWeight: 700,
  },
  tabMuted: {
    padding: "10px 16px",
    borderRadius: "10px",
    border: 0,
    font: "inherit",
    color: "#5f6b7a",
    background: "transparent",
  },
  card: {
    borderRadius: "22px",
    border: "1px solid rgba(24, 33, 43, 0.1)",
    background: "rgba(255, 255, 255, 0.92)",
    boxShadow: "0 12px 36px rgba(22, 36, 56, 0.08)",
  },
  formCard: {
    padding: "24px",
  },
  banner: {
    marginBottom: "18px",
    padding: "14px 16px",
    borderRadius: "16px",
    background: "linear-gradient(135deg, rgba(31, 95, 149, 0.08), rgba(195, 32, 51, 0.06))",
    border: "1px solid rgba(31, 95, 149, 0.12)",
  },
  fieldList: {
    display: "grid",
    gap: "16px",
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
    fontSize: "14px",
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
    height: "50px",
    padding: "0 14px 0 42px",
    borderRadius: "14px",
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
    marginTop: "4px",
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
    marginTop: "18px",
    width: "100%",
    minHeight: "52px",
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
  status: {
    marginTop: "14px",
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
  helpCard: {
    padding: "22px 24px",
    display: "grid",
    gap: "16px",
  },
  helpGrid: {
    display: "grid",
    gap: "12px",
  },
  helpItem: {
    padding: "14px 16px",
    borderRadius: "16px",
    background: "#f7fafc",
    border: "1px solid #e1e8ef",
  },
  support: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
    padding: "14px 16px",
    borderRadius: "16px",
    background: "linear-gradient(135deg, #f9fbfe, #f3f7fb)",
    border: "1px dashed #cbd8e4",
    flexWrap: "wrap",
  },
  supportLink: {
    color: "#1f5f95",
    fontWeight: 700,
    textDecoration: "none",
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

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState("登录环境检查正常，可提交认证请求。");

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
            <div style={styles.heroBadge}>企业内网访问</div>
          </div>

          <div>
            <h1 style={styles.heroHeading}>有度一体化平台账号登录</h1>
            <p style={styles.heroSubtitle}>
              统一使用企业 OA 身份认证进入提示词管理后台。保留内部系统稳重感，同时补足品牌识别、登录说明和帮助触点，避免当前页面过于朴素。
            </p>
          </div>

          <div style={styles.heroPanels}>
            <div style={styles.heroPanel}>
              <span aria-hidden="true" style={styles.heroPanelLine} />
              <p style={styles.heroPanelTitle}>当前访问系统</p>
              <p style={styles.heroPanelValue}>提示词管理 / 管理后台</p>
            </div>
            <div style={styles.heroPanel}>
              <span aria-hidden="true" style={styles.heroPanelLine} />
              <p style={styles.heroPanelTitle}>推荐登录方式</p>
              <p style={styles.heroPanelValue}>账号密码登录</p>
            </div>
          </div>

          <div style={styles.heroGrid}>
            <div style={styles.heroMetric}>
              <strong style={{ display: "block", marginBottom: "6px", fontSize: "18px" }}>
                统一身份
              </strong>
              <span style={{ fontSize: "13px", lineHeight: 1.6, color: "rgba(247, 251, 255, 0.72)" }}>
                复用有度一体化平台员工账号，减少系统间割裂。
              </span>
            </div>
            <div style={styles.heroMetric}>
              <strong style={{ display: "block", marginBottom: "6px", fontSize: "18px" }}>
                权限隔离
              </strong>
              <span style={{ fontSize: "13px", lineHeight: 1.6, color: "rgba(247, 251, 255, 0.72)" }}>
                登录后仍按本系统会话与管理权限单独校验。
              </span>
            </div>
            <div style={styles.heroMetric}>
              <strong style={{ display: "block", marginBottom: "6px", fontSize: "18px" }}>
                安全提示
              </strong>
              <span style={{ fontSize: "13px", lineHeight: 1.6, color: "rgba(247, 251, 255, 0.72)" }}>
                建议在公司网络或 VPN 环境下访问，避免公共设备保存密码。
              </span>
            </div>
          </div>
        </aside>

        <section style={styles.loginWrap}>
          <header style={styles.loginHead}>
            <span style={styles.eyebrow}>AUTHENTICATION PORTAL</span>
            <h2 style={styles.loginTitle}>欢迎登录</h2>
            <p style={styles.loginDescription}>
              请输入有度一体化平台账号与密码。登录成功后将回到原目标页面，并根据当前账号权限展示对应管理入口。
            </p>
          </header>

          <div style={styles.tabs} aria-label="登录方式">
            <button type="button" style={styles.tabActive}>
              账号密码登录
            </button>
            <button type="button" style={styles.tabMuted} disabled aria-disabled="true">
              统一登录说明
            </button>
          </div>

          <section style={{ ...styles.card, ...styles.formCard }}>
            <div style={styles.banner}>
              <strong style={{ display: "block", marginBottom: "4px", fontSize: "14px" }}>
                当前登录方式：账号密码登录
              </strong>
              <span style={{ fontSize: "13px", color: "#5f6b7a", lineHeight: 1.6 }}>
                适用于员工访问管理后台、分类管理、导入与审核等需要身份校验的操作。
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

            <p
              role="status"
              aria-label="登录状态"
              aria-live="polite"
              style={styles.status}
            >
              <span aria-hidden="true" style={styles.statusDot} />
              <span>{feedback}</span>
            </p>
          </section>

          <section style={{ ...styles.card, ...styles.helpCard }}>
            <h3 style={{ margin: 0, fontSize: "18px", color: "#18212b" }}>登录说明 / 帮助区</h3>
            <div style={styles.helpGrid}>
              <div style={styles.helpItem}>
                <strong style={{ display: "block", marginBottom: "5px", fontSize: "14px" }}>
                  登录说明
                </strong>
                <p style={{ margin: 0, color: "#5f6b7a", fontSize: "13px", lineHeight: 1.65 }}>
                  请使用“有度一体化平台账号登录”。本页面仅负责身份认证入口，登录后仍按本系统权限策略控制管理能力。
                </p>
              </div>
              <div style={styles.helpItem}>
                <strong style={{ display: "block", marginBottom: "5px", fontSize: "14px" }}>
                  常见问题
                </strong>
                <p style={{ margin: 0, color: "#5f6b7a", fontSize: "13px", lineHeight: 1.65 }}>
                  若提示账号或密码错误，请先确认 OA 密码是否已更新；若已登录但无法进入后台，通常是当前账号未被授予管理权限。
                </p>
              </div>
              <div style={styles.helpItem}>
                <strong style={{ display: "block", marginBottom: "5px", fontSize: "14px" }}>
                  安全建议
                </strong>
                <p style={{ margin: 0, color: "#5f6b7a", fontSize: "13px", lineHeight: 1.65 }}>
                  离开工位请主动退出登录。请勿在公共电脑保存密码，不要通过截图或聊天工具传播账号密码。
                </p>
              </div>
            </div>

            <div style={styles.support}>
              <div>
                <strong style={{ display: "block", marginBottom: "4px", fontSize: "14px", color: "#18212b" }}>
                  需要协助？
                </strong>
                <span style={{ color: "#5f6b7a", fontSize: "12px" }}>
                  联系信息化服务台 / 企业应用管理员
                </span>
              </div>
              <a href="#" style={styles.supportLink} onClick={(event) => event.preventDefault()}>
                查看登录帮助文档
              </a>
            </div>
          </section>

          <footer style={styles.footer}>
            <span>Prototype Only · Desktop / Mobile Responsive</span>
            <span>适配场景：有度一体化平台账号登录</span>
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
