import { getLoginCookieName, signLoginToken } from "../../../apps/web/lib/auth/session.ts";

type AuthCookieUser = {
  uid: string;
  name: string;
  department?: string;
  can_manage: boolean;
  can_manage_whitelist?: boolean;
};

export function buildAuthCookie(user: AuthCookieUser): string {
  const token = signLoginToken({
    uid: user.uid,
    name: user.name,
    department: user.department,
    can_manage: user.can_manage,
    can_manage_whitelist: user.can_manage_whitelist ?? false,
  });
  return `${getLoginCookieName()}=${encodeURIComponent(token)}`;
}
