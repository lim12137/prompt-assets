import "./globals.css";
import { PersistentAuthStatus } from "./_shared/auth-status.server.js";

export const metadata = {
  title: "Prompt Library",
  description: "Prompt Library",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <div className="pm-root-shell">
          <header className="pm-global-header" data-testid="global-auth-header">
            <div className="pm-global-header-inner">
              <PersistentAuthStatus />
            </div>
          </header>
          <div className="pm-global-content">{children}</div>
        </div>
      </body>
    </html>
  );
}
