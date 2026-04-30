"use client";

export function LogoutButton() {
  async function handleLogout() {
    await fetch("/api/logout", { method: "POST" });
    window.location.reload();
  }

  return (
    <button
      type="button"
      className="pm-auth-link pm-auth-logout-button"
      onClick={handleLogout}
    >
      退出
    </button>
  );
}
