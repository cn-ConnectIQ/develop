"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  Download,
  FileSpreadsheet,
  RefreshCw,
  Settings,
  Sparkles,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { AdminPageBody } from "@/components/layout/AdminLayout";
import { EventMarketupSyncClient } from "@/components/integrations/EventMarketupSyncClient";
import { ImportSheet } from "@/components/participants/ImportSheet";
import { LockedOverlay } from "@/components/events/EventReviewBanner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useIsEventReviewLocked } from "@/hooks/useEventReviewLock";
import { buildImportTemplateCsv } from "@/lib/participants";
import { cn } from "@/lib/utils";
import { UpgradeHookCard } from "@/components/conversion/UpgradeHookCard";

type ImportTab = "excel" | "baige" | "marketup";

async function fetchBaigeSyncStatus(eventId: string) {
  const res = await fetch(`/api/events/${eventId}/participants/sync-baige`);
  if (!res.ok) {
    return {
      lastSyncAt: null as string | null,
      baigeEventId: null as string | null,
      platformConnected: false,
    };
  }
  return (await res.json()).data as {
    lastSyncAt: string | null;
    baigeEventId: string | null;
    platformConnected: boolean;
  };
}

export function EventDataImportClient({ eventId }: { eventId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isReviewLocked = useIsEventReviewLocked(eventId);
  const initialTab = (searchParams.get("tab") as ImportTab | null) ?? "excel";
  const [tab, setTab] = useState<ImportTab>(
    initialTab === "baige" || initialTab === "marketup" ? initialTab : "excel",
  );
  const [importOpen, setImportOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const { data: baigeStatus, refetch: refetchBaige } = useQuery({
    queryKey: ["baige-sync-status", eventId],
    queryFn: () => fetchBaigeSyncStatus(eventId),
  });

  useEffect(() => {
    const fromUrl = searchParams.get("tab") as ImportTab | null;
    if (fromUrl === "excel" || fromUrl === "baige" || fromUrl === "marketup") {
      setTab(fromUrl);
    }
  }, [searchParams]);

  const handleTabChange = useCallback(
    (value: string) => {
      const next = value as ImportTab;
      setTab(next);
      router.replace(`/events/${eventId}/data-import?tab=${next}`, {
        scroll: false,
      });
    },
    [eventId, router],
  );

  function downloadTemplate() {
    const csv = buildImportTemplateCsv();
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "参会名单导入模板.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleBaigeSync() {
    setSyncing(true);
    try {
      const res = await fetch(
        `/api/events/${eventId}/participants/sync-baige`,
        { method: "POST" },
      );
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error?.message ?? json.error ?? "同步失败");
        return;
      }
      toast.success(json.data.message);
      void refetchBaige();
    } finally {
      setSyncing(false);
    }
  }

  return (
    <AdminPageBody>
      <div className="mb-6">
        <div className="mb-1 flex flex-wrap items-center gap-2 text-[12px] text-text-tertiary">
          <Link href={`/events/${eventId}/participants`} className="hover:text-brand-blue">
            名单管理
          </Link>
          <span>/</span>
          <span>数据导入</span>
        </div>
        <h1 className="text-xl font-bold text-[var(--admin-ink)]">数据导入</h1>
        <p className="mt-1 text-sm text-text-muted">
          从 Excel、百格或 MarketUP 导入数据——均为可选来源，可按需使用
        </p>
      </div>

      <Tabs value={tab} onValueChange={handleTabChange}>
        <TabsList variant="line" className="mb-6 w-full justify-start border-b pb-0">
          <TabsTrigger value="excel" className="gap-1.5 px-4 pb-3">
            <FileSpreadsheet className="size-4" />
            Excel 导入
          </TabsTrigger>
          <TabsTrigger value="baige" className="gap-1.5 px-4 pb-3">
            <RefreshCw className="size-4" />
            从百格同步
          </TabsTrigger>
          <TabsTrigger value="marketup" className="gap-1.5 px-4 pb-3">
            <Sparkles className="size-4" />
            从 MarketUP 同步
          </TabsTrigger>
        </TabsList>

        <TabsContent value="excel">
          <div className="admin-card admin-card-pad-lg max-w-2xl">
            <h2 className="text-sm font-semibold text-[var(--admin-ink)]">
              Excel 导入参会名单
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-text-muted">
              支持从 Cvent、活动行、自建表格等任意来源导出的 Excel/CSV
              名单。上传后按字段映射即可完成导入，无需绑定特定办会平台。
            </p>

            <ul className="mt-4 space-y-2 text-sm text-text-muted">
              <li>· 必填字段：姓名、手机号</li>
              <li>· 可选字段：邮箱、公司、职位、票种等</li>
              <li>· 系统自动去重，重复手机号可选择更新或跳过</li>
            </ul>

            <div className="mt-6 flex flex-wrap gap-3">
              <Button variant="outline" onClick={downloadTemplate}>
                <Download className="mr-1 size-4" />
                下载导入模板
              </Button>
              <LockedOverlay locked={isReviewLocked} tooltip="审核通过后可用">
                <Button
                  className="bg-brand-blue text-white hover:bg-brand-blue/90"
                  disabled={isReviewLocked}
                  onClick={() => !isReviewLocked && setImportOpen(true)}
                >
                  <Upload className="mr-1 size-4" />
                  上传 Excel 文件
                </Button>
              </LockedOverlay>
              <Link
                href={`/events/${eventId}/participants`}
                className={cn(buttonVariants({ variant: "ghost" }))}
              >
                查看已导入名单 →
              </Link>
            </div>

            <UpgradeHookCard
              className="mt-6"
              target="BAGEVENT"
              context="excel_import"
              trigger="manual_excel_import"
              eventId={eventId}
            />
          </div>
        </TabsContent>

        <TabsContent value="baige">
          <div className="admin-card admin-card-pad-lg max-w-2xl">
            <h2 className="text-sm font-semibold text-[var(--admin-ink)]">
              从百格同步报名
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-text-muted">
              若您使用百格办会，可在此一键同步报名名单至 ConnectIQ。未使用百格的主办方可跳过此步骤，改用
              Excel 导入或手动添加。
            </p>

            {baigeStatus?.platformConnected === false && (
              <div className="mt-4 rounded-lg border border-border-light bg-content px-4 py-3 text-sm text-text-muted">
                当前账号尚未连接百格。如需使用此功能，请联系平台管理员配置百格集成。
              </div>
            )}

            {baigeStatus?.platformConnected && !baigeStatus.baigeEventId && (
              <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                请先在活动设置中配置百格活动 ID（baige_event_id），再执行同步。
                <Link
                  href={`/events/${eventId}/settings`}
                  className="ml-1 inline-flex items-center text-brand-blue hover:underline"
                >
                  <Settings className="mr-0.5 inline size-3.5" />
                  前往活动设置
                </Link>
              </div>
            )}

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Button
                variant="outline"
                disabled={
                  syncing ||
                  !baigeStatus?.platformConnected ||
                  !baigeStatus?.baigeEventId
                }
                onClick={() => void handleBaigeSync()}
              >
                <RefreshCw
                  className={cn("mr-1 size-4", syncing && "animate-spin")}
                />
                立即同步
              </Button>
              {baigeStatus?.lastSyncAt ? (
                <span className="text-xs text-text-muted">
                  最后同步 {format(new Date(baigeStatus.lastSyncAt), "yyyy/M/d HH:mm")}
                </span>
              ) : (
                <span className="text-xs text-text-muted">尚未同步</span>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="marketup">
          <div className="mb-4 max-w-3xl rounded-lg border border-border-light bg-content px-4 py-3 text-sm text-text-muted">
            MarketUP 同步用于将现场采集线索回流至 CRM。若您未使用 MarketUP，可忽略此 Tab。
          </div>
          <UpgradeHookCard
            className="mb-4 max-w-3xl"
            target="MARKETUP"
            context="marketup_sync_visible"
            trigger="crm_data_synced"
            eventId={eventId}
          />
          <EventMarketupSyncClient eventId={eventId} embedded />
        </TabsContent>
      </Tabs>

      <ImportSheet
        eventId={eventId}
        open={importOpen}
        onOpenChange={setImportOpen}
        onSuccess={() => {
          setImportOpen(false);
          router.push(`/events/${eventId}/participants`);
        }}
      />
    </AdminPageBody>
  );
}
