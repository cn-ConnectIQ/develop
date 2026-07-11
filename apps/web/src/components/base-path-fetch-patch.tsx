"use client";

import { useEffect } from "react";
import { getPublicBasePath } from "@/lib/public-path";

let fetchPatched = false;

function prefixApiUrl(input: string): string {
  const base = getPublicBasePath();
  if (!base) return input;
  if (input.startsWith("/api/") || input === "/api") {
    return `${base}${input}`;
  }
  return input;
}

export function BasePathFetchPatch() {
  useEffect(() => {
    const base = getPublicBasePath();
    if (!base || fetchPatched) return;

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
        return originalFetch(new Request(new URL(prefixed, url.origin), input), init);
      }
      return originalFetch(input, init);
    };

    fetchPatched = true;
  }, []);

  return null;
}
