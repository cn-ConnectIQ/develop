"use client";

import { getPublicBasePath } from "@/lib/public-path";

let fetchPatched = false;

function resolveBase(): string {
  const base = getPublicBasePath();
  if (base) return base;
  // 双保险：页面已落在 /uc 下时补前缀
  if (typeof window !== "undefined") {
    const path = window.location.pathname || "";
    if (path === "/uc" || path.startsWith("/uc/")) return "/uc";
  }
  return "";
}

function prefixApiUrl(input: string): string {
  const base = resolveBase();
  if (!base) return input;
  if (input.startsWith(`${base}/`) || input === base) return input;
  if (input.startsWith("/api/") || input === "/api") {
    return `${base}${input}`;
  }
  return input;
}

/** 在首屏 React Query 发起请求前同步 patch fetch，避免 /api → COS 404 */
export function installBasePathFetchPatch() {
  if (typeof window === "undefined" || fetchPatched) return;

  const originalFetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    if (typeof input === "string") {
      return originalFetch(prefixApiUrl(input), init);
    }
    if (input instanceof URL && input.origin === window.location.origin) {
      const prefixed = prefixApiUrl(`${input.pathname}${input.search}`);
      return originalFetch(new URL(prefixed, input.origin), init);
    }
    if (input instanceof Request && input.url.startsWith(window.location.origin)) {
      const url = new URL(input.url);
      const prefixed = prefixApiUrl(`${url.pathname}${url.search}`);
      if (prefixed !== `${url.pathname}${url.search}`) {
        return originalFetch(
          new Request(new URL(prefixed, url.origin), input),
          init,
        );
      }
    }
    return originalFetch(input, init);
  };

  fetchPatched = true;
}

installBasePathFetchPatch();

export function BasePathFetchPatch() {
  installBasePathFetchPatch();
  return null;
}
