/** 管理端侧栏导航模式：平台级 vs 单活动上下文 */
export type AdminNavMode = "platform" | "event";

const EVENT_ROUTE =
  /^\/events\/[^/]+(?:\/|$)|^\/expos\/[^/]+(?:\/|$)|^\/exhibitor\/booths\/[^/]+(?:\/|$)/;

export function getAdminNavMode(pathname: string): AdminNavMode {
  return EVENT_ROUTE.test(pathname) ? "event" : "platform";
}

export function isEventScopedRoute(pathname: string): boolean {
  return getAdminNavMode(pathname) === "event";
}

export function extractEventIdFromPath(pathname: string): string | null {
  const eventMatch = pathname.match(/\/events\/([^/]+)/);
  if (eventMatch) return eventMatch[1];
  const expoMatch = pathname.match(/\/expos\/([^/]+)/);
  if (expoMatch) return expoMatch[1];
  const boothMatch = pathname.match(/\/exhibitor\/booths\/([^/]+)/);
  return boothMatch?.[1] ?? null;
}

/** 判断侧栏菜单是否激活（精确匹配路径、query 与 hash，避免父路径误匹配） */
export function isNavItemActive(
  href: string,
  pathname: string,
  searchParams: { get: (key: string) => string | null } | null = null,
  hash = "",
) {
  const hashIdx = href.indexOf("#");
  const hrefHash = hashIdx >= 0 ? href.slice(hashIdx + 1) : "";
  const pathAndQuery = hashIdx >= 0 ? href.slice(0, hashIdx) : href;

  const qIdx = pathAndQuery.indexOf("?");
  const hrefPath = qIdx >= 0 ? pathAndQuery.slice(0, qIdx) : pathAndQuery;
  const hrefQueryStr = qIdx >= 0 ? pathAndQuery.slice(qIdx + 1) : "";
  const hrefParams = hrefQueryStr ? new URLSearchParams(hrefQueryStr) : null;

  const currentPath = pathname.split("?")[0];

  if (hrefPath === "/platform/overview") return currentPath === "/platform/overview";
  if (hrefPath === "/events") return currentPath === "/events";

  if (currentPath !== hrefPath) return false;

  if (hrefHash) return hash === hrefHash;

  if (hash) return false;

  if (hrefParams && [...hrefParams.keys()].length > 0) {
    for (const [key, value] of hrefParams.entries()) {
      if (searchParams?.get(key) !== value) return false;
    }
    return true;
  }

  if (hrefPath.endsWith("/leads")) {
    if (searchParams?.get("grade") || searchParams?.get("status")) return false;
  }

  return true;
}

/** 账号管理员平台级首页（活动列表 / 账号中心） */
export function getAccountCenterHref(): string {
  return "/events";
}

export function getAccountCenterLabel(): string {
  return "返回账号中心";
}

/** 平台级首页：有平台管理员权限时返回平台概览 */
export function getPlatformHomeHref(
  role: string,
  hasPlatformAdmin = false,
): string {
  if (role === "PLATFORM_ADMIN" || hasPlatformAdmin) {
    return "/platform/overview";
  }
  return "/events";
}

export function getPlatformHomeLabel(
  role: string,
  hasPlatformAdmin = false,
): string {
  if (role === "PLATFORM_ADMIN" || hasPlatformAdmin) {
    return "返回平台概览";
  }
  return "返回活动列表";
}
