"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Loader2,
  ScanLine,
  Trophy,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  AdminContent,
  AdminHeader,
  AdminPage,
  SectionCard,
} from "@/components/admin/admin-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { extractVerificationCode } from "@/lib/lottery/prize-verification-utils";
import type {
  VerificationLookupResult,
  VerificationStats,
  VerificationWinnerView,
} from "@/lib/lottery/prize-verification-service";
import { cn } from "@/lib/utils";

async function lookupCode(eventId: string, code: string) {
  const normalized = extractVerificationCode(code);
  const res = await fetch(
    `/api/verify/${encodeURIComponent(normalized)}?event_id=${eventId}`,
  );
  if (res.status === 404) {
    return { status: "invalid" as const };
  }
  if (!res.ok) {
    const json = await res.json();
    throw new Error(json.error ?? "查询失败");
  }
  return (await res.json()).data as VerificationLookupResult;
}

async function redeemCode(eventId: string, code: string) {
  const normalized = extractVerificationCode(code);
  const res = await fetch(`/api/verify/${encodeURIComponent(normalized)}/redeem`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event_id: eventId }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "核销失败");
  return json.data as {
    success: boolean;
    stats: VerificationStats;
  };
}

function StatsBar({ stats }: { stats: VerificationStats | null }) {
  if (!stats) return null;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      <div className="rounded-xl border border-brand-green/30 bg-brand-green-light/30 p-4">
        <p className="text-xs text-text-muted">已发奖</p>
        <p className="text-2xl font-bold text-brand-green">
          {stats.redeemed_count}
        </p>
      </div>
      <div className="rounded-xl border border-brand-amber/30 bg-brand-amber-light/20 p-4">
        <p className="text-xs text-text-muted">未领取</p>
        <p className="text-2xl font-bold text-brand-amber">
          {stats.pending_count}
        </p>
      </div>
      <div className="col-span-2 rounded-xl border border-border-light p-4 sm:col-span-1">
        <p className="text-xs text-text-muted">中奖总数</p>
        <p className="text-2xl font-bold">{stats.total_winners}</p>
      </div>
    </div>
  );
}

export type PrizeVerifyClientProps = {
  eventId: string;
  eventName: string;
};

export function PrizeVerifyClient({
  eventId,
  eventName,
}: PrizeVerifyClientProps) {
  const [codeInput, setCodeInput] = useState("");
  const [lookup, setLookup] = useState<VerificationLookupResult | null>(null);
  const [stats, setStats] = useState<VerificationStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [redeeming, setRedeeming] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanLoopRef = useRef<number | null>(null);

  const { data: initialStats } = useQuery({
    queryKey: ["verify-stats", eventId],
    queryFn: async () => {
      const res = await fetch(
        `/api/events/${eventId}/verification-stats`,
      ).catch(() => null);
      if (res?.ok) {
        return (await res.json()).data as VerificationStats;
      }
      return { redeemed_count: 0, pending_count: 0, total_winners: 0 };
    },
  });

  useEffect(() => {
    if (initialStats) setStats(initialStats);
  }, [initialStats]);

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

  async function handleLookup(rawCode?: string) {
    const code = rawCode ?? codeInput;
    if (!code.trim()) {
      toast.error("请输入或扫描核销码");
      return;
    }
    setLoading(true);
    setLookup(null);
    try {
      const result = await lookupCode(eventId, code);
      setLookup(result);
      if (result.status !== "invalid" && "stats" in result) {
        setStats(result.stats);
      }
      if (result.status === "invalid") {
        toast.error("核销码无效");
      }
      stopCamera();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "查询失败");
    } finally {
      setLoading(false);
    }
  }

  async function handleRedeem() {
    if (!codeInput.trim()) return;
    setRedeeming(true);
    try {
      const result = await redeemCode(eventId, codeInput);
      setStats(result.stats);
      toast.success("核销成功，奖品已发放");
      await handleLookup(codeInput);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "核销失败");
    } finally {
      setRedeeming(false);
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
            detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue: string }>>;
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
            const extracted = extractVerificationCode(codes[0].rawValue);
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

  function resetForm() {
    setLookup(null);
    setCodeInput("");
    stopCamera();
  }

  const winner = lookup && lookup.status !== "invalid" ? lookup.winner : null;

  return (
    <AdminPage>
      <AdminHeader
        title="奖品核销"
        description={eventName}
        breadcrumb={["现场运营", "核销"]}
      />

      <AdminContent>
        <div className="mx-auto max-w-2xl space-y-6">
          <StatsBar stats={stats} />

          <SectionCard title="扫描核销码" description="扫描参会者手机上的核销二维码">
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
                  onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                  placeholder="手动输入核销码"
                  className="font-mono uppercase"
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

          {lookup?.status === "invalid" && (
            <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-5 text-red-700">
              <XCircle className="size-8 shrink-0" />
              <div>
                <p className="font-semibold">核销码无效</p>
                <p className="text-sm">请确认码是否正确或是否属于本活动</p>
              </div>
            </div>
          )}

          {lookup?.status === "already_redeemed" && winner && (
            <div className="rounded-xl border border-brand-amber/40 bg-brand-amber-light/20 p-5">
              <div className="flex items-start gap-3">
                <AlertTriangle className="size-8 shrink-0 text-brand-amber" />
                <div className="flex-1">
                  <p className="font-semibold text-brand-amber">已核销，请勿重复发放</p>
                  <p className="mt-1 text-sm text-text-muted">
                    已于{" "}
                    {winner.verified_at
                      ? new Date(winner.verified_at).toLocaleString("zh-CN", {
                          month: "numeric",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "—"}{" "}
                    核销
                    {winner.verifier_name && `（${winner.verifier_name}）`}
                  </p>
                  <WinnerCard winner={winner} />
                </div>
              </div>
              <Button variant="outline" className="mt-4 w-full" onClick={resetForm}>
                扫描下一个
              </Button>
            </div>
          )}

          {lookup?.status === "valid" && winner && (
            <div className="rounded-xl border border-brand-green/40 bg-brand-green-light/10 p-5">
              <div className="mb-4 flex items-center gap-2 text-brand-green">
                <CheckCircle2 className="size-5" />
                <span className="font-semibold">核销码有效，请确认发奖</span>
              </div>
              <WinnerCard winner={winner} />
              <div className="mt-4 flex gap-2">
                <Button
                  className="h-12 flex-1 bg-brand-green text-white hover:bg-brand-green/90"
                  disabled={redeeming}
                  onClick={() => void handleRedeem()}
                >
                  {redeeming ? (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  ) : (
                    <ScanLine className="mr-2 size-4" />
                  )}
                  确认核销
                </Button>
                <Button variant="outline" onClick={resetForm}>
                  取消
                </Button>
              </div>
            </div>
          )}
        </div>
      </AdminContent>
    </AdminPage>
  );
}

function WinnerCard({ winner }: { winner: VerificationWinnerView }) {
  return (
    <div className="mt-4 rounded-lg border border-border-light bg-white p-4">
      <div className="flex items-start gap-3">
        <div className="flex size-12 items-center justify-center rounded-full bg-brand-gold/15">
          <Trophy className="size-6 text-brand-gold" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-lg font-bold">{winner.name}</p>
          <p className="text-sm text-text-muted">{winner.company ?? "—"}</p>
          <p className="mt-2 font-medium text-brand-gold">{winner.prize_name}</p>
          <p className="text-xs text-text-muted">
            {winner.lottery_title}
            {winner.booth_code && ` · 展位 ${winner.booth_code}`}
          </p>
        </div>
      </div>
      <p className="mt-3 rounded-md bg-gray-50 px-3 py-2 text-center text-xs text-text-muted">
        请核对身份后发放奖品，核销后不可撤销
      </p>
    </div>
  );
}
