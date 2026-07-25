"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Link2, Unlink } from "lucide-react";
import { AdminPageBody } from "@/components/layout/AdminLayout";
import { PageHead } from "@/components/admin/page-head";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ConnectionStatus = {
  linked: boolean;
  status: string;
  externalOrgId: string | null;
  scopes: string[];
  linkedAt: string | null;
  oauthConfigured: boolean;
  devLinkEnabled: boolean;
};

async function fetchStatus(): Promise<ConnectionStatus> {
  const res = await fetch("/api/partner/baige/connection");
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "加载失败");
  return json.data as ConnectionStatus;
}

export function BaigeIntegrationClient() {
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [baigeOrgId, setBaigeOrgId] = useState("");
  const [baigeOrgName, setBaigeOrgName] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["baige-partner-connection"],
    queryFn: fetchStatus,
  });

  useEffect(() => {
    const result = searchParams.get("baige_oauth");
    if (!result) return;
    if (result === "success") toast.success("百格授权连接成功");
    else if (result === "denied") toast.error("已取消百格授权");
    else toast.error(`百格授权失败：${searchParams.get("reason") ?? "unknown"}`);
  }, [searchParams]);

  const partnerState = searchParams.get("partner_state")?.trim() || "";

  const confirmPartner = useMutation({
    mutationFn: async (state: string) => {
      const res = await fetch("/api/partner/baige/app/connection/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "确认授权失败");
      return json.data as {
        linked: boolean;
        redirectUri?: string | null;
      };
    },
    onSuccess: async (payload) => {
      toast.success("已确认百格 App 授权绑定");
      await queryClient.invalidateQueries({
        queryKey: ["baige-partner-connection"],
      });
      if (payload.redirectUri?.startsWith("bagevent://")) {
        window.location.href = payload.redirectUri;
      }
    },
    onError: (err: Error) => toast.error(err.message),
  });

  useEffect(() => {
    if (!partnerState || confirmPartner.isPending || confirmPartner.isSuccess) {
      return;
    }
    confirmPartner.mutate(partnerState);
    // 仅在进入页带 partner_state 时自动确认一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partnerState]);

  const startOAuth = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/partner/baige/oauth/start");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "无法发起授权");
      return json.data as { authorizeUrl: string };
    },
    onSuccess: (payload) => {
      window.location.href = payload.authorizeUrl;
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const linkDev = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/partner/baige/connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baigeOrgId: baigeOrgId.trim(),
          baigeOrgName: baigeOrgName.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "绑定失败");
      return json.data;
    },
    onSuccess: async () => {
      toast.success("已绑定百格组织");
      await queryClient.invalidateQueries({ queryKey: ["baige-partner-connection"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const unlink = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/partner/baige/connection", { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "解绑失败");
      return json.data;
    },
    onSuccess: async () => {
      toast.success("已解除百格绑定");
      await queryClient.invalidateQueries({ queryKey: ["baige-partner-connection"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <>
      <PageHead
        title="百格活动对接"
        description="授权绑定百格组织后，可开通活动并同步报名、签到与采集点"
      />
      <AdminPageBody>
        <div className="mx-auto max-w-2xl space-y-6">
          <div className="rounded-xl border border-border-light bg-white p-6">
            <h2 className="text-base font-semibold text-[var(--admin-ink)]">连接状态</h2>
            {isLoading ? (
              <p className="mt-3 text-sm text-text-muted">加载中…</p>
            ) : data?.linked ? (
              <div className="mt-3 space-y-2 text-sm">
                <p>
                  状态：
                  <span className="font-medium text-brand-green">已连接</span>
                </p>
                <p className="text-text-muted">
                  百格组织 ID：{data.externalOrgId}
                </p>
                {data.linkedAt && (
                  <p className="text-text-muted">
                    绑定时间：{new Date(data.linkedAt).toLocaleString("zh-CN")}
                  </p>
                )}
                <Button
                  type="button"
                  variant="outline"
                  className="mt-3"
                  disabled={unlink.isPending}
                  onClick={() => unlink.mutate()}
                >
                  <Unlink className="mr-2 size-4" />
                  解除绑定
                </Button>
              </div>
            ) : (
              <div className="mt-3 space-y-4">
                <p className="text-sm text-text-muted">尚未绑定百格组织。</p>
                {data?.oauthConfigured ? (
                  <Button
                    type="button"
                    disabled={startOAuth.isPending}
                    onClick={() => startOAuth.mutate()}
                  >
                    <Link2 className="mr-2 size-4" />
                    授权连接百格
                  </Button>
                ) : null}

                {data?.devLinkEnabled ? (
                  <div className="space-y-3 rounded-lg border border-dashed border-border-light p-4">
                    <p className="text-xs text-text-muted">
                      开发联调：OAuth 未就绪时可手工填写百格组织 ID 绑定（不影响原生活动）。
                    </p>
                    <div>
                      <Label>百格组织 ID</Label>
                      <Input
                        className="mt-1"
                        value={baigeOrgId}
                        onChange={(e) => setBaigeOrgId(e.target.value)}
                        placeholder="baige_org_xxx"
                      />
                    </div>
                    <div>
                      <Label>组织名称（可选）</Label>
                      <Input
                        className="mt-1"
                        value={baigeOrgName}
                        onChange={(e) => setBaigeOrgName(e.target.value)}
                        placeholder="百格活动"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={!baigeOrgId.trim() || linkDev.isPending}
                      onClick={() => linkDev.mutate()}
                    >
                      开发模式绑定
                    </Button>
                  </div>
                ) : null}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border-light bg-white p-6 text-sm text-text-muted">
            <p className="font-medium text-[var(--admin-ink)]">下一步</p>
            <ol className="mt-2 list-decimal space-y-1 pl-5">
              <li>完成组织绑定</li>
              <li>
                调用{" "}
                <code className="text-xs">POST /api/partner/baige/events/authorize</code>{" "}
                开通活动（列表将显示「来源百格」）
              </li>
              <li>
                百格推送 Webhook 至{" "}
                <code className="text-xs">/api/webhook/bagevent</code>
              </li>
            </ol>
          </div>
        </div>
      </AdminPageBody>
    </>
  );
}
