import { getToken } from "next-auth/jwt";
import { NextResponse, type NextRequest } from "next/server";
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
] as const;

const PUBLIC_PATHS = [
  "/login",
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

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api")) {
    if (request.method === "OPTIONS") {
      return new NextResponse(null, { status: 204, headers: corsHeaders() });
    }
    const response = NextResponse.next();
    for (const [key, value] of Object.entries(corsHeaders())) {
      response.headers.set(key, value);
    }
    return response;
  }

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  const userType =
    request.cookies.get(ROLE_COOKIE_USER_TYPE)?.value ??
    (token?.userType as string | undefined);
  const adminStatus =
    request.cookies.get(ROLE_COOKIE_ADMIN_STATUS)?.value ??
    (token?.adminStatus as string | undefined) ??
    "";

  const applyCookieSync = (response: NextResponse) => {
    if (token?.userType) {
      syncRoleCookies(
        response,
        token.userType as string,
        (token.adminStatus as string | undefined) ?? "",
      );
    }
    return response;
  };

  if (pathname.startsWith(PLATFORM_PREFIX)) {
    if (!token) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    if (userType !== "PLATFORM_ADMIN") {
      return applyCookieSync(
        NextResponse.redirect(new URL("/403", request.url)),
      );
    }
    return applyCookieSync(NextResponse.next());
  }

  if (isAccountAdminRoute(pathname)) {
    if (!token) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    if (userType !== "ACCOUNT_ADMIN") {
      return applyCookieSync(
        NextResponse.redirect(new URL("/403", request.url)),
      );
    }
    if (adminStatus === "SUSPENDED") {
      return applyCookieSync(
        NextResponse.redirect(new URL("/account-suspended", request.url)),
      );
    }
    if (adminStatus !== "APPROVED") {
      const pendingPath =
        adminStatus === "REJECTED" ? "/register/rejected" : "/register/pending";
      return applyCookieSync(
        NextResponse.redirect(new URL(pendingPath, request.url)),
      );
    }
    return applyCookieSync(NextResponse.next());
  }

  if (token?.userType) {
    return applyCookieSync(NextResponse.next());
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/platform",
    "/platform/:path*",
    "/organizer/:path*",
    "/expo/:path*",
    "/exhibitor/:path*",
    "/events",
    "/events/:path*",
    "/expos",
    "/expos/:path*",
    "/booths",
    "/booths/:path*",
    "/members",
    "/members/:path*",
    "/org-profile",
    "/org-profile/:path*",
    "/api/:path*",
  ],
};
