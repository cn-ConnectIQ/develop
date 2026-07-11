import "@/lib/auth-env";
import { getToken } from "next-auth/jwt";
import { NextResponse, type NextRequest } from "next/server";
import { isOrgAdminUsable } from "@/lib/org-access";
import { getPublicBasePath, withPublicPath } from "@/lib/public-path";
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
  return NextResponse.redirect(new URL(withPublicPath(path), request.url));
}

function rewriteStrippedBasePath(request: NextRequest): NextResponse | null {
  const basePath = getPublicBasePath();
  if (!basePath) return null;

  const { pathname } = request.nextUrl;
  if (pathname === basePath || pathname.startsWith(`${basePath}/`)) {
    return null;
  }

  const url = request.nextUrl.clone();
  url.pathname =
    pathname === "/" ? `${basePath}/` : `${basePath}${pathname}`;
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
