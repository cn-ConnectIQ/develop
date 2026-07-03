"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Camera,
  Gift,
  Loader2,
  ScanLine,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  AdminContent,
  AdminHeader,
  AdminPage,
  SectionCard,
} from "@/components/admin/admin-header";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type {
  RedemptionLogView,
  RedemptionPrizeView,
} from "@/lib/lottery/redemption";
import { cn } from "@/lib/utils";

type RedemptionLookup = {
  user: {
    name: string;
    company: string | null;
    avatar: string;
  };
  prizes: RedemptionPrizeView[];
};

type RedemptionLogRow = RedemptionLogView;

const CATEGORY_LABELS: Record<string, string> = {
  POOL_DRAW: "奖池抽奖",
  AUTO_PROBABILITY: "概率抽奖",
  INSTANT_CLAIM: "即时领取",
};

function extractRedemptionCode(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";

  try {
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      const url = new URL(trimmed);
      const pathParts = url.pathname.split("/").filter(Boolean);
      const redemptionIdx = pathParts.indexOf("redemption-code");
      if (redemptionIdx >= 0 && pathParts[redemptionIdx + 1]) {
        return pathParts[redemptionIdx + 1]!;
      }
      const codeParam = url.searchParams.get("code");
      if (codeParam) return codeParam.trim();
    }
  } catch {
    // not a URL
  }

  if (trimmed.includes("code=")) {
    const match = trimmed.match(/code=([A-Za-z0-9_-]+)/i);
    if (match?.[1]) return match[1];
  }

  return trimmed;
}

function formatTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatLogTime(iso: string): string {
  return new Date(iso).toLocaleString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    month: "numeric",
    day: "numeric",
  });
}

function sortPrizes(prizes: RedemptionPrizeView[]): RedemptionPrizeView[] {
  return [...prizes].sort((a, b) => {
    if (a.verified !== b.verified) return a.verified ? 1 : -1;
    return new Date(b.wonAt).getTime() - new Date(a.wonAt).getTime();
  });
}

async function lookupRedemptionCode(eventId: string, code: string) {
  const normalized = extractRedemptionCode(code);
  const res = await fetch(
    `/api/redemption-code/${encodeURIComponent(normalized)}?eventId=${eventId}`,
  );
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error ?? "查询失败");
  }
  return { code: normalized, data: json.data as RedemptionLookup };
}

async function verifyPrize(code: string, winnerId: string) {
  const res = await fetch(
    `/api/redemption-code/${encodeURIComponent(code)}/verify/${winnerId}`,
    { method: "POST" },
  );
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error ?? "核销失败");
  }
  return json.data.prize as RedemptionPrizeView;
}

async function fetchTodayLogs(eventId: string): Promise<RedemptionLogRow[]> {
  const res = await fetch(`/api/events/${eventId}/redemption-logs`);
  if (!res.ok) return [];
  const json = await res.json();
  return (json.data?.logs ?? []) as RedemptionLogRow[];
}

export type RedemptionScanPanelProps = {
  eventId: string;
  eventName: string;
};

export function RedemptionScanPanel({
  eventId,
  eventName,
}: RedemptionScanPanelProps) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("scan");
  const [codeInput, setCodeInput] = useState("");
  const [activeCode, setActiveCode] = useState<string | null>(null);
  const [lookup, setLookup] = useState<RedemptionLookup | null>(null);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [confirmWinnerId, setConfirmWinnerId] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanLoopRef = useRef<number | null>(null);

  const { data: todayLogs = [], isLoading: logsLoading } = useQuery({
    queryKey: ["redemption-logs", eventId],
    queryFn: () => fetchTodayLogs(eventId),
    enabled: activeTab === "logs",
    refetchInterval: activeTab === "logs" ? 30_000 : false,
  });

  const stopCamera = useCallback(() => {
    if (scanLoopRef.current) {
      cancelAnimationFrame(scanLoopRef.current);
      scanLoopRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setScanning(false);
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  const handleLookup = useCallback(
    async (rawCode?: string) => {
      const code = rawCode ?? codeInput;
      if (!code.trim()) {
        toast.error("请输入或扫描核销码");
        return;
      }
      setLoading(true);
      setLookup(null);
      try {
        const result = await lookupRedemptionCode(eventId, code);
        setActiveCode(result.code);
        setCodeInput(result.code);
        setLookup(result.data);
        stopCamera();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "查询失败");
      } finally {
        setLoading(false);
      }
    },
    [codeInput, eventId, stopCamera],
  );

  async function handleVerify() {
    if (!confirmWinnerId || !activeCode) return;
    setVerifying(true);
    try {
      const updated = await verifyPrize(activeCode, confirmWinnerId);
      setLookup((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          prizes: prev.prizes.map((p) =>
            p.winnerId === updated.winnerId ? updated : p,
          ),
        };
      });
      toast.success("已核销");
      void queryClient.invalidateQueries({
        queryKey: ["redemption-logs", eventId],
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "核销失败");
    } finally {
      setVerifying(false);
      setConfirmWinnerId(null);
    }
  }

  async function startCamera() {
    setScanError(null);
    stopCamera();

    if (!navigator.mediaDevices?.getUserMedia) {
      setScanError("当前浏览器不支持摄像头");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      setScanning(true);

      await new Promise((r) => setTimeout(r, 100));
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      await video.play();

      const Detector = (
        window as unknown as {
          BarcodeDetector?: new (opts: { formats: string[] }) => {
            detect: (
              source: HTMLVideoElement,
            ) => Promise<Array<{ rawValue: string }>>;
          };
        }
      ).BarcodeDetector;

      if (!Detector) {
        setScanError("浏览器不支持扫码，请手动输入核销码");
        return;
      }

      const detector = new Detector({ formats: ["qr_code"] });

      async function scanFrame() {
        if (!videoRef.current || !streamRef.current) return;
        try {
          const codes = await detector.detect(videoRef.current);
          if (codes.length > 0 && codes[0]?.rawValue) {
            const extracted = extractRedemptionCode(codes[0].rawValue);
            setCodeInput(extracted);
            void handleLookup(extracted);
            return;
          }
        } catch {
          // ignore frame errors
        }
        scanLoopRef.current = requestAnimationFrame(scanFrame);
      }

      scanLoopRef.current = requestAnimationFrame(scanFrame);
    } catch {
      setScanError("无法访问摄像头，请检查权限或改用手动输入");
      stopCamera();
    }
  }

  function resetScan() {
    setLookup(null);
    setActiveCode(null);
    setCodeInput("");
    stopCamera();
  }

  const confirmPrize = lookup?.prizes.find((p) => p.winnerId === confirmWinnerId);
  const sortedPrizes = lookup ? sortPrizes(lookup.prizes) : [];

  return (
    <AdminPage>
      <AdminHeader
        title="统一核销台"
        description={eventName}
        breadcrumb={["现场运营", "核销台"]}
      />

      <AdminContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="scan">扫码核销</TabsTrigger>
            <TabsTrigger value="logs">今日核销记录</TabsTrigger>
          </TabsList>

          <TabsContent value="scan" className="mt-6 space-y-6">
            <div className="mx-auto max-w-2xl space-y-6">
              <SectionCard
                title="扫描参会者核销码"
                description="使用摄像头扫码，或手动输入统一核销码查询待领奖品"
              >
                <div className="space-y-4 p-5">
                  <div
                    className={cn(
                      "relative overflow-hidden rounded-xl border border-border-light bg-black/5",
                      scanning ? "aspect-[4/3]" : "hidden",
                    )}
                  >
                    <video
                      ref={videoRef}
                      className="size-full object-cover"
                      playsInline
                      muted
                    />
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                      <div className="size-48 rounded-lg border-2 border-brand-gold/70" />
                    </div>
                  </div>

                  {scanError && (
                    <p className="text-sm text-brand-amber">{scanError}</p>
                  )}

                  <div className="flex gap-2">
                    <Input
                      value={codeInput}
                      onChange={(e) => setCodeInput(e.target.value)}
                      placeholder="手动输入核销码"
                      className="font-mono"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void handleLookup();
                      }}
                    />
                    <Button
                      variant="outline"
                      disabled={loading}
                      onClick={() => void handleLookup()}
                    >
                      {loading ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        "查询"
                      )}
                    </Button>
                  </div>

                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => (scanning ? stopCamera() : void startCamera())}
                  >
                    {scanning ? (
                      <>
                        <XCircle className="mr-2 size-4" />
                        关闭摄像头
                      </>
                    ) : (
                      <>
                        <Camera className="mr-2 size-4" />
                        打开摄像头扫码
                      </>
                    )}
                  </Button>
                </div>
              </SectionCard>

              {lookup && (
                <SectionCard title="参会者信息">
                  <div className="flex items-center gap-4 p-5">
                    <Avatar className="size-14">
                      <AvatarImage src={lookup.user.avatar} alt={lookup.user.name} />
                      <AvatarFallback>
                        {lookup.user.name.slice(0, 1)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="text-lg font-semibold">{lookup.user.name}</p>
                      <p className="text-sm text-text-muted">
                        {lookup.user.company ?? "—"}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="ml-auto shrink-0"
                      onClick={resetScan}
                    >
                      扫描下一个
                    </Button>
                  </div>
                </SectionCard>
              )}

              {lookup && sortedPrizes.length === 0 && (
                <div className="rounded-xl border border-border-light bg-muted/30 p-6 text-center text-sm text-text-muted">
                  该参会者暂无中奖记录
                </div>
              )}

              {lookup && sortedPrizes.length > 0 && (
                <SectionCard
                  title="待核销奖品"
                  description="未核销项在前，已核销项置底"
                >
                  <ul className="divide-y divide-border-light">
                    {sortedPrizes.map((prize) => (
                      <PrizeRow
                        key={prize.winnerId}
                        prize={prize}
                        onVerify={() => setConfirmWinnerId(prize.winnerId)}
                      />
                    ))}
                  </ul>
                </SectionCard>
              )}
            </div>
          </TabsContent>

          <TabsContent value="logs" className="mt-6">
            <SectionCard title="今日核销记录">
              {logsLoading ? (
                <div className="flex items-center justify-center gap-2 p-10 text-sm text-text-muted">
                  <Loader2 className="size-4 animate-spin" />
                  加载中…
                </div>
              ) : todayLogs.length === 0 ? (
                <p className="p-8 text-center text-sm text-text-muted">
                  今日暂无核销记录
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-sm">
                    <thead>
                      <tr className="border-b border-border-light text-left text-xs text-text-muted">
                        <th className="px-5 py-3 font-medium">时间</th>
                        <th className="px-5 py-3 font-medium">参会者</th>
                        <th className="px-5 py-3 font-medium">奖品</th>
                        <th className="px-5 py-3 font-medium">核销人</th>
                      </tr>
                    </thead>
                    <tbody>
                      {todayLogs.map((log) => (
                        <tr
                          key={log.id}
                          className="border-b border-border-light/60 last:border-0"
                        >
                          <td className="whitespace-nowrap px-5 py-3 text-text-muted">
                            {formatLogTime(log.verifiedAt)}
                          </td>
                          <td className="px-5 py-3">
                            <p className="font-medium">{log.attendeeName}</p>
                            {log.attendeeCompany && (
                              <p className="text-xs text-text-muted">
                                {log.attendeeCompany}
                              </p>
                            )}
                          </td>
                          <td className="px-5 py-3">
                            <p>{log.prizeName}</p>
                            <p className="text-xs text-text-muted">
                              {log.lotteryTitle}
                            </p>
                          </td>
                          <td className="px-5 py-3 text-text-muted">
                            {log.verifierName ?? "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </SectionCard>
          </TabsContent>
        </Tabs>
      </AdminContent>

      <AlertDialog
        open={!!confirmWinnerId}
        onOpenChange={(open) => {
          if (!open) setConfirmWinnerId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认核销该奖品？</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmPrize && lookup ? (
                <>
                  奖品「{confirmPrize.prizeName}」（{confirmPrize.lotteryTitle}），
                  参会者 {lookup.user.name}
                  {lookup.user.company ? ` · ${lookup.user.company}` : ""}。
                  核销后不可撤销，请核对身份后再确认。
                </>
              ) : (
                "核销后不可撤销，请核对身份后再确认。"
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={verifying}>取消</AlertDialogCancel>
            <AlertDialogAction
              disabled={verifying}
              className="bg-brand-green text-white hover:bg-brand-green/90"
              onClick={(e) => {
                e.preventDefault();
                void handleVerify();
              }}
            >
              {verifying ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <ScanLine className="mr-2 size-4" />
              )}
              确认核销
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminPage>
  );
}

function PrizeRow({
  prize,
  onVerify,
}: {
  prize: RedemptionPrizeView;
  onVerify: () => void;
}) {
  const categoryLabel =
    CATEGORY_LABELS[prize.lotteryCategory] ?? prize.lotteryCategory;

  return (
    <li
      className={cn(
        "flex items-center gap-4 p-5",
        prize.verified && "bg-muted/30 opacity-70",
      )}
    >
      <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border-light bg-muted/40">
        {prize.prizeImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={prize.prizeImage}
            alt={prize.prizeName}
            className="size-full object-cover"
          />
        ) : (
          <Gift className="size-6 text-brand-gold" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "font-medium",
            prize.verified && "text-text-muted line-through decoration-border-light",
          )}
        >
          {prize.prizeName}
        </p>
        <p className="mt-0.5 text-xs text-text-muted">
          来自：{prize.lotteryTitle}
        </p>
        <Badge variant="outline" className="mt-2">
          {categoryLabel}
        </Badge>
      </div>

      <div className="shrink-0">
        {prize.verified ? (
          <span className="text-xs text-text-muted">
            已于 {formatTime(prize.verifiedAt)} 核销
          </span>
        ) : (
          <Button
            size="sm"
            className="bg-brand-green text-white hover:bg-brand-green/90"
            onClick={onVerify}
          >
            核销
          </Button>
        )}
      </div>
    </li>
  );
}
