"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import type { InviteResolveResult } from "@/lib/invite/claim-types";

type OkData = Extract<InviteResolveResult, { kind: "ok" }>;

function isWeChatUA() {
  if (typeof navigator === "undefined") return false;
  return /MicroMessenger/i.test(navigator.userAgent);
}

function launchMiniProgram(path: string, mpUrlLink?: string | null) {
  // 优先微信官方 URL Link（短信外链 / 浏览器均可）
  if (mpUrlLink?.startsWith("http")) {
    window.location.href = mpUrlLink;
    return;
  }
  const appId = process.env.NEXT_PUBLIC_WX_MINI_APPID?.trim();
  if (appId) {
    const scheme = `weixin://dl/business/?appid=${appId}&path=${encodeURIComponent(
      path.replace(/^\//, ""),
    )}`;
    window.location.href = scheme;
  }
}

export function InviteTransferClient({ data }: { data: OkData }) {
  const [inWeChat, setInWeChat] = useState(false);
  const [copied, setCopied] = useState(false);
  const shortUrl = useMemo(() => {
    if (typeof window !== "undefined") return window.location.href;
    return `https://9li.co/a/${data.token}`;
  }, [data.token]);

  useEffect(() => {
    setInWeChat(isWeChatUA());
  }, []);

  useEffect(() => {
    // 有 URL Link 时优先跳转（微信内/外均可尝试）
    const t = window.setTimeout(() => {
      launchMiniProgram(data.mini_path, data.mp_url_link);
    }, 400);
    return () => window.clearTimeout(t);
  }, [data.mini_path, data.mp_url_link]);

  const copyLink = async () => {
    const toCopy = data.mp_url_link?.startsWith("http")
      ? data.mp_url_link
      : shortUrl;
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

        {inWeChat || data.mp_url_link ? (
          <div style={{ marginTop: 40 }}>
            <p style={{ fontSize: 14, opacity: 0.85, marginBottom: 16 }}>
              正在打开玖莅小程序…
            </p>
            <button
              type="button"
              onClick={() => launchMiniProgram(data.mini_path, data.mp_url_link)}
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
                玖莅 AI 配对在微信小程序内使用，请用微信打开本链接。
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
