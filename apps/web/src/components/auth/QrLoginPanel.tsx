"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { signIn } from "next-auth/react";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { withPublicPath } from "@/lib/public-path";
import { clearAuthRoleCookies } from "@/lib/auth-redirect";

type QrLoginPanelProps = {
  onLoggedIn: () => Promise<void>;
  onError: (message: string) => void;
};

type SessionPayload = {
  sessionId: string;
  qrPayload: string;
  expiresIn: number;
};

export function QrLoginPanel({ onLoggedIn, onError }: QrLoginPanelProps) {
  const [session, setSession] = useState<SessionPayload | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "pending" | "expired" | "signing">("loading");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPoll = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const startSession = useCallback(async () => {
    stopPoll();
    setStatus("loading");
    setQrDataUrl(null);
    onError("");
    try {
      const res = await fetch(withPublicPath("/api/auth/qr-login"), {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) {
        onError(json.error ?? "无法创建扫码会话");
        setStatus("expired");
        return;
      }
      const data = json.data as SessionPayload;
      setSession(data);

      const QRCode = await import("qrcode");
      const url = await QRCode.toDataURL(data.qrPayload, {
        width: 220,
        margin: 1,
        errorCorrectionLevel: "M",
      });
      setQrDataUrl(url);
      setStatus("pending");

      pollRef.current = setInterval(async () => {
        try {
          const pollRes = await fetch(
            withPublicPath(`/api/auth/qr-login/${data.sessionId}`),
          );
          const pollJson = await pollRes.json();
          if (!pollRes.ok) return;
          const state = pollJson.data as {
            status: string;
            loginToken?: string;
          };
          if (state.status === "expired") {
            stopPoll();
            setStatus("expired");
            return;
          }
          if (state.status === "confirmed" && state.loginToken) {
            stopPoll();
            setStatus("signing");
            clearAuthRoleCookies();
            const result = await signIn("baige-sso", {
              loginToken: state.loginToken,
              redirect: false,
            });
            if (result?.error) {
              onError("扫码登录失败，请重试");
              setStatus("expired");
              return;
            }
            toast.success("扫码登录成功");
            await onLoggedIn();
          }
        } catch {
          // ignore transient poll errors
        }
      }, 2000);
    } catch {
      onError("网络异常，请重试");
      setStatus("expired");
    }
  }, [onError, onLoggedIn, stopPoll]);

  useEffect(() => {
    void startSession();
    return () => stopPoll();
  }, [startSession, stopPoll]);

  return (
    <div className="flex flex-col items-center gap-3 py-2">
      <div className="flex size-[220px] items-center justify-center rounded-xl border border-border-light bg-white p-2">
        {qrDataUrl && status !== "loading" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qrDataUrl} alt="百格 App 扫码登录" className="size-full" />
        ) : (
          <Loader2 className="size-8 animate-spin text-text-muted" />
        )}
      </div>
      <p className="text-center text-sm text-text-muted">
        {status === "signing"
          ? "正在登录…"
          : status === "expired"
            ? "二维码已过期"
            : "打开百格 App「玖莅」Tab，扫一扫登录"}
      </p>
      <p className="text-center text-[11px] text-text-tertiary">
        使用与授权时相同的百格账号手机号 / 邮箱
      </p>
      {(status === "expired" || status === "pending") && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void startSession()}
          disabled={status === "pending" && !session}
        >
          <RefreshCw className="mr-1.5 size-3.5" />
          刷新二维码
        </Button>
      )}
    </div>
  );
}
