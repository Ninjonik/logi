import type { NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";

import {routing} from "@/i18n/routing";

const handleI18nRouting = createMiddleware(routing);

export default async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isStaticAsset =
    pathname.startsWith("/img/") ||
    /^\/[a-zA-Z-]+\/img\//.test(pathname) ||
    /\.[a-zA-Z0-9]+$/.test(pathname);

  if (isStaticAsset) {
    return;
  }

  const localeMatch = pathname.match(/^\/([a-zA-Z-]+)(\/.*)?$/);
  const locale = localeMatch?.[1] ?? "en";
  const localizedLogin = `/${locale}/login`;
  const localizedDashboard = `/${locale}/dashboard`;
  const isDashboardRoute =
    pathname === localizedDashboard || pathname.startsWith(`${localizedDashboard}/`);
  const hasSessionCookie = Boolean(request.cookies.get("token")?.value);

  if (isDashboardRoute && !hasSessionCookie) {
    return Response.redirect(new URL(localizedLogin, request.url));
  }

  return handleI18nRouting(request);
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|\\.well-known|img).*)"],
};
