"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider } from "next-auth/react";
import { useState } from "react";
import { BasePathFetchPatch } from "@/components/base-path-fetch-patch";
import { Toaster } from "@/components/ui/sonner";
import { getAuthApiBasePath } from "@/lib/public-path";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            gcTime: 300_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );

  return (
    <SessionProvider basePath={getAuthApiBasePath()}>
      <QueryClientProvider client={queryClient}>
        <BasePathFetchPatch />
        {children}
        <Toaster richColors position="top-center" />
      </QueryClientProvider>
    </SessionProvider>
  );
}
