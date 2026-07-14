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

function isPublicPath(pathname: string) {
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

function isGatewayStrippedHost(host: string): boolean {
  return host.includes("9li.co");
}

/**
 * CloudBase 自定义域名会在网关剥 /uc 前缀；next.config 已设 basePath=/uc 时，
 * middleware 看到的 pathname 不含 /uc，不能再 rewrite 到 /uc/xxx（会变成 /uc/uc/xxx）。
 */
function rewriteStrippedBasePath(request: NextRequest): NextResponse | null {
  const host = request.headers.get("host") ?? "";
  const basePath = getPublicBasePathWithFallback(host);
  if (!basePath) return null;

  const incomingPath = getIncomingPathname(request);

  // 请求 URL 已带 /uc（如云托管默认域名 /uc/login）——交给 Next.js basePath 处理
  if (incomingPath === basePath || incomingPath.startsWith(`${basePath}/`)) {
    return null;
  }

  // 缺 /uc 前缀的 /api/*：必须 rewrite/redirect，否则 Next basePath 下会 404
  if (incomingPath === "/api" || incomingPath.startsWith("/api/")) {
    const target = new URL(request.url);
    target.pathname = `${basePath}${incomingPath}`;
    if (!isGatewayStrippedHost(host)) {
      return NextResponse.redirect(target);
    }
    return NextResponse.rewrite(target);
  }

  // 非 9li.co 网关：缺 /uc 前缀时重定向到带前缀的 URL（默认 *.run.tcloudbase.com）
  if (!isGatewayStrippedHost(host)) {
    const target = new URL(request.url);
    target.pathname =
      incomingPath === "/"
        ? `${basePath}/`
        : `${basePath}${incomingPath}`;
    return NextResponse.redirect(target);
  }

  // 9li.co 网关已剥前缀：rewrite 到内部 pathname，勿再拼 /uc
  const { pathname } = request.nextUrl;
  const url = request.nextUrl.clone();
  url.pathname = pathname === "/" ? "/" : pathname;
  return NextResponse.rewrite(url);
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
  const { pathname } = request.nextUrl;

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
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
