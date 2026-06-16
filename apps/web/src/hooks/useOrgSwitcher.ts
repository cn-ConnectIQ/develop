"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast } from "sonner";

export function useOrgSwitcher() {
  const { data: session, update } = useSession();
  const router = useRouter();
  const [switching, setSwitching] = useState(false);

  async function switchOrg(orgId: string) {
    if (switching || orgId === session?.user.activeOrgId) return;
    setSwitching(true);

    try {
      const res = await fetch("/api/me/switch-org", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId }),
      });

      const json = (await res.json()) as {
        error?: string;
        data?: { redirectPath: string };
      };

      if (!res.ok) {
        toast.error(json.error ?? "切换组织失败");
        return;
      }

      await update();
      router.push(json.data?.redirectPath ?? "/events");
      router.refresh();
      toast.success("已切换身份");
    } catch {
      toast.error("切换组织失败，请稍后重试");
    } finally {
      setSwitching(false);
    }
  }

  return { switchOrg, switching };
}
