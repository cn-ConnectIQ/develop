import "@/lib/auth-env";
import { getToken } from "next-auth/jwt";
import { NextResponse, type NextRequest } from "next/server";
import { isOrgAdminUsable } from "@/lib/org-access";
import { getPublicBasePathWithFallback } from "@/lib/public-path";
import {
  ROLE_COOKIE_ADMIN_STATUS,
  ROLE_COOKIE_USER_TYPE,
} from "@/lib/auth-redirect";

const PLATFORM_PREFIX = "/platform";
const ACCOUNT_ADMIN_PREFIXES = [
  "/organizer",
  "/expo",
  "/exhibitor",
  "/events",
  "/expos",
  "/booths",
  "/members",
  "/org-profile",
  "/integrations",
] as const;

const PUBLIC_PATHS = [
  "/login",
  "/signup",
  "/403",
  "/account-suspended",
  "/register",
  "/join",
  "/i/",
  "/a/",
  "/b/",
  "/o/",
  "/j/",
  "/optout",
] as const;

/** 现场投影大屏：可不登录打开（投票/抽奖 display） */
function isPublicScreenPath(pathname: string) {
  return (
    pathname.includes("/screen/poll-display") ||
    pathname.includes("/screen/lottery-display")
  );
}

function isPublicPath(pathname: string) {
  if (isPublicScreenPath(pathname)) return true;
  return PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

function isAccountAdminRoute(pathname: string) {
  return ACCOUNT_ADMIN_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
  };
}

function syncRoleCookies(
  response: NextResponse,
  userType: string,
  adminStatus: string,
) {
  const cookieOptions = {
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    sameSite: "lax" as const,
  };
  response.cookies.set(ROLE_COOKIE_USER_TYPE, userType, cookieOptions);
  response.cookies.set(ROLE_COOKIE_ADMIN_STATUS, adminStatus, cookieOptions);
}

function redirectTo(request: NextRequest, path: string) {
  const host = request.headers.get("host") ?? "";
  const base = getPublicBasePathWithFallback(host);
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const targetPath =
    !base || normalized === base || normalized.startsWith(`${base}/`)
      ? normalized
      : `${base}${normalized}`;
  return NextResponse.redirect(new URL(targetPath, request.url));
}

function getIncomingPathname(request: NextRequest): string {
  return new URL(request.url).pathname;
}

/** 鉴权用 pathname：去掉 basePath，使 /uc/login 与 /login 判定一致 */
function getAppPathname(request: NextRequest): string {
  const host = request.headers.get("host") ?? "";
  const basePath = getPublicBasePathWithFallback(host);
  const incoming = getIncomingPathname(request);
  if (basePath && (incoming === basePath || incoming.startsWith(`${basePath}/`))) {
    const rest = incoming.slice(basePath.length);
    return rest || "/";
  }
  // 网关已剥前缀：incoming 已是应用路径
  return request.nextUrl.pathname || incoming;
}

function isGatewayStrippedHost(host: string): boolean {
  return host.includes("9li.co");
}

/**
 * CloudBase 自定义域名路径前缀 `/uc` 会在网关**剥掉**再转发：
 *   浏览器: https://9li.co/uc/api/live  →  容器内: /api/live
 * Next.js 又配置了 basePath=/uc，必须把剥掉的前缀 rewrite 回去，否则全部 404。
 *
 * 注意：middleware matcher 必须 `basePath: false`，否则剥前缀后的路径根本进不了本函数。
 */
function rewriteStrippedBasePath(request: NextRequest): NextResponse | null {
  const host = request.headers.get("host") ?? "";
  const basePath = getPublicBasePathWithFallback(host);
  if (!basePath) return null;

  const incomingPath = getIncomingPathname(request);

  // 已带 /uc（云托管默认域名）——交给 Next basePath
  if (incomingPath === basePath || incomingPath.startsWith(`${basePath}/`)) {
    return null;
  }

  const restored =
    incomingPath === "/" ? `${basePath}/` : `${basePath}${incomingPath}`;
  const target = request.nextUrl.clone();
  target.pathname = restored;

  // 非网关域名（默认 *.run.tcloudbase.com）：浏览器应看见带 /uc 的 URL
  if (!isGatewayStrippedHost(host)) {
    return NextResponse.redirect(target);
  }

  // 9li.co：对外 URL 已有 /uc，容器内被剥掉 —— rewrite 补回，不改变浏览器地址栏
  return NextResponse.rewrite(target);
}

function finish(request: NextRequest, response: NextResponse) {
  const rewrite = rewriteStrippedBasePath(request);
  if (!rewrite) return response;

  response.headers.forEach((value, key) => {
    rewrite.headers.set(key, value);
  });
  for (const cookie of response.cookies.getAll()) {
    rewrite.cookies.set(cookie);
  }
  return rewrite;
}

export async function middleware(request: NextRequest) {
  // 统一成无 /uc 前缀的路径做鉴权与公开页判断
  const pathname = getAppPathname(request);

  if (pathname.startsWith("/api")) {
    if (request.method === "OPTIONS") {
      return finish(
        request,
        new NextResponse(null, { status: 204, headers: corsHeaders() }),
      );
    }
    const response = NextResponse.next();
    for (const [key, value] of Object.entries(corsHeaders())) {
      response.headers.set(key, value);
    }
    return finish(request, response);
  }

  if (isPublicPath(pathname)) {
    return finish(request, NextResponse.next());
  }

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  const userType =
    (token?.userType as string | undefined) ??
    request.cookies.get(ROLE_COOKIE_USER_TYPE)?.value;
  const adminStatus =
    (token?.activeAdminStatus as string | undefined) ??
    (token?.adminStatus as string | undefined) ??
    request.cookies.get(ROLE_COOKIE_ADMIN_STATUS)?.value ??
    "";

  const applyCookieSync = (response: NextResponse) => {
    if (token?.userType) {
      syncRoleCookies(
        response,
        token.userType as string,
        (token.activeAdminStatus as string | undefined) ??
          (token.adminStatus as string | undefined) ??
          "",
      );
    }
    return response;
  };

  if (pathname.startsWith(PLATFORM_PREFIX)) {
    if (!token) {
      return redirectTo(request, "/login");
    }
    if (userType !== "PLATFORM_ADMIN") {
      return applyCookieSync(redirectTo(request, "/403"));
    }
    return finish(request, applyCookieSync(NextResponse.next()));
  }

  if (isAccountAdminRoute(pathname)) {
    if (!token) {
      return redirectTo(request, "/login");
    }
    if (userType !== "ACCOUNT_ADMIN") {
      return applyCookieSync(redirectTo(request, "/403"));
    }
    if (adminStatus === "SUSPENDED") {
      return applyCookieSync(redirectTo(request, "/account-suspended"));
    }
    if (!isOrgAdminUsable(adminStatus)) {
      const pendingPath =
        adminStatus === "REJECTED"
          ? "/register/rejected"
          : adminStatus === "PENDING_REVIEW"
            ? "/register/pending"
            : "/login";
      return applyCookieSync(redirectTo(request, pendingPath));
    }
    return finish(request, applyCookieSync(NextResponse.next()));
  }

  if (token?.userType) {
    return finish(request, applyCookieSync(NextResponse.next()));
  }

  return finish(request, NextResponse.next());
}

export const config = {
  // Next 16 Turbopack 不支持 matcher 对象里的 basePath:false；
  // 剥 /uc 后的路径由 next.config rewrites 补回，middleware 仍匹配带 /uc 的路径。
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
