"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import type { InviteResolveResult } from "@/lib/invite/claim-types";

type OkData = Extract<InviteResolveResult, { kind: "ok" }>;

function isWeChatUA() {
  if (typeof navigator === "undefined") return false;
  return /MicroMessenger/i.test(navigator.userAgent);
}

function isLaunchHref(value: string | null | undefined): value is string {
  return Boolean(
    value &&
      (value.startsWith("http://") ||
        value.startsWith("https://") ||
        value.startsWith("weixin://")),
  );
}

function buildWeixinBusinessHref(miniPath: string, appId: string) {
  const raw = miniPath.replace(/^\//, "");
  const qIndex = raw.indexOf("?");
  const path = qIndex >= 0 ? raw.slice(0, qIndex) : raw;
  const query = qIndex >= 0 ? raw.slice(qIndex + 1) : "";
  const params = new URLSearchParams({
    appid: appId,
    path,
  });
  if (query) params.set("query", query);
  return `weixin://dl/business/?${params.toString()}`;
}

function launchMiniProgram(input: {
  miniPath: string;
  mpUrlLink?: string | null;
  miniAppId?: string | null;
}) {
  if (isLaunchHref(input.mpUrlLink)) {
    window.location.href = input.mpUrlLink;
    return true;
  }
  const appId =
    input.miniAppId?.trim() ||
    process.env.NEXT_PUBLIC_WX_MINI_APPID?.trim() ||
    "";
  if (appId) {
    window.location.href = buildWeixinBusinessHref(input.miniPath, appId);
    return true;
  }
  return false;
}

export function InviteTransferClient({ data }: { data: OkData }) {
  const [inWeChat, setInWeChat] = useState(false);
  const [copied, setCopied] = useState(false);
  const [launchAttempted, setLaunchAttempted] = useState(false);
  const [launchOk, setLaunchOk] = useState(false);
  const shortUrl = useMemo(() => {
    if (typeof window !== "undefined") return window.location.href;
    return `https://9li.co/a/${data.token}`;
  }, [data.token]);

  useEffect(() => {
    setInWeChat(isWeChatUA());
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => {
      const ok = launchMiniProgram({
        miniPath: data.mini_path,
        mpUrlLink: data.mp_url_link,
        miniAppId: data.mini_app_id,
      });
      setLaunchAttempted(true);
      setLaunchOk(ok);
    }, 400);
    return () => window.clearTimeout(t);
  }, [data.mini_path, data.mp_url_link, data.mini_app_id]);

  const copyLink = async () => {
    const toCopy = isLaunchHref(data.mp_url_link) ? data.mp_url_link : shortUrl;
    try {
      await navigator.clipboard.writeText(toCopy);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      const input = document.createElement("input");
      input.value = toCopy;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
      setCopied(true);
    }
  };

  const canAutoLaunch =
    isLaunchHref(data.mp_url_link) || Boolean(data.mini_app_id?.trim());

  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(ellipse at top, #1e3a5f 0%, #0f172a 55%, #020617 100%)",
        color: "#f8fafc",
        fontFamily:
          '"PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif',
        padding: "48px 20px 32px",
      }}
    >
      <div style={{ maxWidth: 440, margin: "0 auto" }}>
        <p
          style={{
            fontSize: 13,
            letterSpacing: "0.25em",
            opacity: 0.65,
            marginBottom: 24,
          }}
        >
          玖莅 · 9li.co
        </p>

        <h1 style={{ fontSize: 26, fontWeight: 600, lineHeight: 1.35 }}>
          {data.invitee.honorific}，
          <br />
          欢迎来到「{data.event.short_name || data.event.name}」
        </h1>
        <p style={{ marginTop: 12, fontSize: 15, opacity: 0.8, lineHeight: 1.6 }}>
          {data.event.location
            ? `${data.event.location}`
            : "开启 AI 配对，提前锁定值得见的人"}
        </p>

        {canAutoLaunch || inWeChat ? (
          <div style={{ marginTop: 40 }}>
            <p style={{ fontSize: 14, opacity: 0.85, marginBottom: 16 }}>
              {launchAttempted && !launchOk
                ? "未能自动打开小程序，请扫码或点击下方按钮"
                : "正在打开玖莅小程序…"}
            </p>
            <button
              type="button"
              onClick={() =>
                launchMiniProgram({
                  miniPath: data.mini_path,
                  mpUrlLink: data.mp_url_link,
                  miniAppId: data.mini_app_id,
                })
              }
              style={primaryBtn}
            >
              打开小程序继续
            </button>
          </div>
        ) : (
          <div style={{ marginTop: 40 }}>
            <div
              style={{
                padding: 20,
                borderRadius: 12,
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.1)",
                marginBottom: 20,
              }}
            >
              <p style={{ fontSize: 15, lineHeight: 1.7 }}>
                {data.invitee.honorific}，
                <strong>{data.event.name}</strong>{" "}
                邀请你开启 AI 配对。
              </p>
              <p style={{ fontSize: 13, opacity: 0.7, marginTop: 10 }}>
                请用微信扫下方小程序码，或复制链接后用微信打开。
              </p>
            </div>
            <button type="button" onClick={() => void copyLink()} style={primaryBtn}>
              {copied ? "已复制，请打开微信粘贴访问" : "复制链接，用微信打开"}
            </button>
            {data.session_user_id && data.identity_match !== false ? (
              <a
                href={data.app_join_fallback}
                style={{
                  display: "block",
                  textAlign: "center",
                  marginTop: 16,
                  fontSize: 13,
                  color: "rgba(248,250,252,0.7)",
                }}
              >
                已登录？在网页查看推荐 →
              </a>
            ) : null}
          </div>
        )}

        {data.wxacode_url ? (
          <div style={{ marginTop: 28, textAlign: "center" }}>
            <img
              src={data.wxacode_url}
              alt="玖莅小程序码"
              width={200}
              height={200}
              style={{
                width: 200,
                height: 200,
                borderRadius: 12,
                background: "#fff",
                padding: 10,
              }}
            />
            <p style={{ marginTop: 10, fontSize: 13, opacity: 0.7 }}>
              微信扫一扫，直接进入活动
            </p>
          </div>
        ) : null}
      </div>
    </main>
  );
}

const primaryBtn: CSSProperties = {
  width: "100%",
  padding: "14px 20px",
  borderRadius: 10,
  border: "none",
  background: "#f8fafc",
  color: "#0f172a",
  fontSize: 16,
  fontWeight: 600,
  cursor: "pointer",
};
