"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ConnectionStatusDot,
  type ConnectionDotState,
} from "@/components/screen/ConnectionStatusDot";
import { QRDisplay } from "@/components/screen/QRDisplay";
import { ScreenContentRouter } from "@/components/screen/ScreenContentRouter";
import {
  subscribeScreenPairing,
  type ScreenPairingBroadcastMessage,
} from "@/lib/screen-pairing/realtime";
import type { ScreenPairingStatusPayload } from "@/lib/screen-pairing/service";
import { TOKEN_TTL_SECONDS } from "@/lib/screen-pairing/service";

/** 每个浏览器标签页独立存储,避免多块屏互相覆盖 token */
const STORAGE_KEY = "connectiq_screen_pairing_token";
const HEARTBEAT_MS = 10_000;
const POLL_MS = 3_000;

type ScreenPhase = "loading" | "waiting" | "paired";

function supportsWebSocket() {
  return typeof WebSocket !== "undefined";
}

function readStoredToken(): string | null {
  try {
    return sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStoredToken(token: string) {
  try {
    sessionStorage.setItem(STORAGE_KEY, token);
  } catch {
    // ignore storage failures on embedded browsers
  }
}

function clearStoredToken() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

async function fetchPairingStatus(
  token: string,
): Promise<ScreenPairingStatusPayload | null> {
  const res = await fetch(`/api/screen-pairing/${encodeURIComponent(token)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("加载配对状态失败");
  const json = await res.json();
  return json.data as ScreenPairingStatusPayload;
}

async function createPairingSession(): Promise<ScreenPairingStatusPayload> {
  const res = await fetch("/api/screen-pairing/create", { method: "POST" });
  if (!res.ok) throw new Error("创建配对会话失败");
  const json = await res.json();
  const created = json.data as {
    pairingToken: string;
    qrContent: string;
    expiresIn: number;
  };
  writeStoredToken(created.pairingToken);
  const status = await fetchPairingStatus(created.pairingToken);
  if (!status) throw new Error("创建后无法读取配对状态");
  return status;
}

async function refreshPairingToken(token: string): Promise<{
  token: string;
  qrContent?: string;
  status: ScreenPairingStatusPayload;
}> {
  const res = await fetch(
    `/api/screen-pairing/${encodeURIComponent(token)}/refresh`,
    { method: "POST" },
  );
  if (!res.ok) throw new Error("刷新配对码失败");
  const json = await res.json();
  const data = json.data as {
    pairingToken?: string;
    qrContent?: string;
    status?: string;
  } & ScreenPairingStatusPayload;

  const nextToken = data.pairingToken ?? token;
  writeStoredToken(nextToken);

  if (data.status === "PAIRED" || data.eventId) {
    const status = await fetchPairingStatus(nextToken);
    if (!status) throw new Error("刷新后无法读取配对状态");
    return { token: nextToken, status };
  }

  const status = await fetchPairingStatus(nextToken);
  if (!status) throw new Error("刷新后无法读取配对状态");
  return { token: nextToken, qrContent: data.qrContent, status };
}

function applyPairedFromBroadcast(
  current: ScreenPairingStatusPayload | null,
  message: ScreenPairingBroadcastMessage,
  token: string,
): ScreenPairingStatusPayload {
  if (message.type !== "PAIRED") {
    return (
      current ?? {
        id: "",
        pairingToken: token,
        status: "WAITING",
        tokenExpiresAt: new Date().toISOString(),
        screenOnline: true,
        eventId: null,
        eventName: null,
        interactionType: null,
        interactionId: null,
        interactionName: null,
        displayTarget: null,
        pairedBy: null,
        pairedAt: null,
        lastHeartbeatAt: null,
        createdAt: new Date().toISOString(),
      }
    );
  }

  return {
    ...(current ?? {
      id: "",
      pairingToken: token,
      tokenExpiresAt: new Date().toISOString(),
      screenOnline: true,
      displayTarget: null,
      pairedBy: null,
      pairedAt: null,
      lastHeartbeatAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    }),
    pairingToken: token,
    status: "PAIRED",
    eventId: message.data.eventId,
    eventName: message.data.eventName,
    interactionType: message.data.interactionType,
    interactionId: message.data.interactionId,
    interactionName: message.data.interactionName,
    pairedAt: message.data.pairedAt,
    displayTarget: null,
  };
}

export function ScreenPageClient() {
  const [phase, setPhase] = useState<ScreenPhase>("loading");
  const [pairingToken, setPairingToken] = useState<string>("");
  const [qrContent, setQrContent] = useState<string | undefined>(undefined);
  const [pairing, setPairing] = useState<ScreenPairingStatusPayload | null>(
    null,
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [connectionState, setConnectionState] =
    useState<ConnectionDotState>("waiting");
  const [showReconnectBanner, setShowReconnectBanner] = useState(false);
  const [usePollingFallback, setUsePollingFallback] = useState(false);
  const [fadeKey, setFadeKey] = useState(0);

  const pairingTokenRef = useRef("");
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const lastHeartbeatOkRef = useRef(true);
  const realtimeConnectedRef = useRef(true);

  const clearRefreshTimer = useCallback(() => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
  }, []);

  const clearHeartbeatTimer = useCallback(() => {
    if (heartbeatTimerRef.current) {
      clearInterval(heartbeatTimerRef.current);
      heartbeatTimerRef.current = null;
    }
  }, []);

  const clearPollTimer = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const clearSubscription = useCallback(() => {
    unsubscribeRef.current?.();
    unsubscribeRef.current = null;
  }, []);

  const updateConnectionIndicator = useCallback(() => {
    if (phase !== "paired") {
      setConnectionState("waiting");
      setShowReconnectBanner(false);
      return;
    }

    const online = lastHeartbeatOkRef.current && realtimeConnectedRef.current;
    setConnectionState(online ? "connected" : "disconnected");
    setShowReconnectBanner(!online);
  }, [phase]);

  const scheduleQrRefresh = useCallback(
    (token: string, expiresIn?: number) => {
      clearRefreshTimer();
      const delaySec = Math.max(
        5,
        Math.min(expiresIn ?? TOKEN_TTL_SECONDS, TOKEN_TTL_SECONDS) - 5,
      );
      refreshTimerRef.current = setTimeout(() => {
        void (async () => {
          try {
            const refreshed = await refreshPairingToken(token);
            pairingTokenRef.current = refreshed.token;
            setPairingToken(refreshed.token);
            setQrContent(refreshed.qrContent);

            if (refreshed.status.status === "PAIRED") {
              setPairing(refreshed.status);
              setPhase("paired");
              setFadeKey((k) => k + 1);
              return;
            }

            setPairing(refreshed.status);
            setPhase("waiting");
            scheduleQrRefresh(
              refreshed.token,
              refreshed.status.expiresIn ?? TOKEN_TTL_SECONDS,
            );
          } catch {
            scheduleQrRefresh(token, TOKEN_TTL_SECONDS);
          }
        })();
      }, delaySec * 1000);
    },
    [clearRefreshTimer],
  );

  const handleStatusUpdate = useCallback(
    (status: ScreenPairingStatusPayload) => {
      setPairing(status);
      setPairingToken(status.pairingToken);
      pairingTokenRef.current = status.pairingToken;
      writeStoredToken(status.pairingToken);

      if (status.status === "PAIRED" && status.eventId) {
        setPhase("paired");
        setFadeKey((k) => k + 1);
        clearRefreshTimer();
        return;
      }

      if (status.status === "EXPIRED") {
        void (async () => {
          try {
            const refreshed = await refreshPairingToken(status.pairingToken);
            pairingTokenRef.current = refreshed.token;
            setPairingToken(refreshed.token);
            setQrContent(refreshed.qrContent);
            handleStatusUpdate(refreshed.status);
          } catch {
            clearStoredToken();
            const created = await createPairingSession();
            handleStatusUpdate(created);
          }
        })();
        return;
      }

      setPhase("waiting");
      scheduleQrRefresh(
        status.pairingToken,
        status.expiresIn ?? TOKEN_TTL_SECONDS,
      );
    },
    [clearRefreshTimer, scheduleQrRefresh],
  );

  const handlePairedBroadcast = useCallback(
    (message: ScreenPairingBroadcastMessage) => {
      const token = pairingTokenRef.current;
      setPhase("paired");
      setFadeKey((k) => k + 1);
      setPairing((prev) => applyPairedFromBroadcast(prev, message, token));
      clearRefreshTimer();

      void (async () => {
        try {
          const status = await fetchPairingStatus(token);
          if (status) handleStatusUpdate(status);
        } catch {
          // optimistic UI already applied
        }
      })();
    },
    [clearRefreshTimer, handleStatusUpdate],
  );

  const pollPairingStatus = useCallback(async () => {
    const token = pairingTokenRef.current;
    if (!token) return;

    try {
      const status = await fetchPairingStatus(token);
      if (!status) return;

      if (status.status === "PAIRED" && status.eventId) {
        handleStatusUpdate(status);
        return;
      }

      if (status.status === "WAITING" || status.status === "EXPIRED") {
        if (phase === "paired") {
          setFadeKey((k) => k + 1);
        }
        handleStatusUpdate(status);
        return;
      }

      setPairing(status);
      lastHeartbeatOkRef.current = true;
      updateConnectionIndicator();
    } catch {
      if (phase === "paired") {
        lastHeartbeatOkRef.current = false;
        updateConnectionIndicator();
      }
    }
  }, [handleStatusUpdate, phase, updateConnectionIndicator]);

  const subscribePairingChannel = useCallback(
    (token: string) => {
      const unsub = subscribeScreenPairing(
        token,
        (message) => {
          realtimeConnectedRef.current = true;
          updateConnectionIndicator();

          if (message.type === "PAIRED") {
            handlePairedBroadcast(message);
          }

          if (message.type === "RESET") {
            void (async () => {
              const status = await fetchPairingStatus(pairingTokenRef.current);
              if (status) {
                setFadeKey((k) => k + 1);
                handleStatusUpdate(status);
              }
            })();
          }
        },
        {
          onConnectionChange: (connected) => {
            realtimeConnectedRef.current = connected;
            if (!connected) {
              setUsePollingFallback(true);
            }
            updateConnectionIndicator();
          },
        },
      );

      if (!unsub) {
        setUsePollingFallback(true);
        realtimeConnectedRef.current = false;
      } else {
        unsubscribeRef.current = unsub;
        realtimeConnectedRef.current = true;
      }
    },
    [handlePairedBroadcast, handleStatusUpdate, updateConnectionIndicator],
  );

  const bootstrap = useCallback(async () => {
    setLoadError(null);
    setPhase("loading");
    setUsePollingFallback(!supportsWebSocket());

    try {
      const stored = readStoredToken();
      if (stored) {
        const status = await fetchPairingStatus(stored);
        if (status) {
          handleStatusUpdate(status);
          return;
        }
        clearStoredToken();
      }

      const created = await createPairingSession();
      handleStatusUpdate(created);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "初始化失败");
      try {
        clearStoredToken();
        const created = await createPairingSession();
        setLoadError(null);
        handleStatusUpdate(created);
      } catch {
        setPhase("waiting");
      }
    }
  }, [handleStatusUpdate]);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    clearSubscription();
    clearPollTimer();
    clearHeartbeatTimer();

    const token = pairingTokenRef.current || pairingToken;
    if (!token) return undefined;

    if (phase === "waiting") {
      subscribePairingChannel(token);

      pollTimerRef.current = setInterval(() => {
        void pollPairingStatus();
      }, POLL_MS);

      return () => {
        clearSubscription();
        clearPollTimer();
      };
    }

    if (phase === "paired") {
      lastHeartbeatOkRef.current = true;
      updateConnectionIndicator();

      subscribePairingChannel(token);

      heartbeatTimerRef.current = setInterval(() => {
        void (async () => {
          try {
            const res = await fetch(
              `/api/screen-pairing/${encodeURIComponent(pairingTokenRef.current)}/heartbeat`,
              { method: "POST" },
            );
            lastHeartbeatOkRef.current = res.ok;
          } catch {
            lastHeartbeatOkRef.current = false;
          }
          updateConnectionIndicator();
        })();
      }, HEARTBEAT_MS);

      pollTimerRef.current = setInterval(() => {
        void pollPairingStatus();
      }, POLL_MS);

      void fetch(
        `/api/screen-pairing/${encodeURIComponent(token)}/heartbeat`,
        { method: "POST" },
      ).catch(() => {
        lastHeartbeatOkRef.current = false;
        updateConnectionIndicator();
      });
    }

    return () => {
      clearSubscription();
      clearPollTimer();
      clearHeartbeatTimer();
    };
  }, [
    phase,
    pairingToken,
    clearSubscription,
    clearPollTimer,
    clearHeartbeatTimer,
    pollPairingStatus,
    subscribePairingChannel,
    updateConnectionIndicator,
  ]);

  useEffect(() => {
    return () => {
      clearRefreshTimer();
      clearHeartbeatTimer();
      clearPollTimer();
      clearSubscription();
    };
  }, [
    clearRefreshTimer,
    clearHeartbeatTimer,
    clearPollTimer,
    clearSubscription,
  ]);

  useEffect(() => {
    if (phase !== "paired" || !pairing?.eventId || pairing.displayTarget) {
      return;
    }

    void (async () => {
      try {
        const status = await fetchPairingStatus(pairing.pairingToken);
        if (status) setPairing(status);
      } catch {
        // ignore
      }
    })();
  }, [phase, pairing]);

  const pairedInteractionType =
    pairing?.interactionType === "POLL" ||
    pairing?.interactionType === "LOTTERY" ||
    pairing?.interactionType === "QA"
      ? pairing.interactionType
      : null;

  return (
    <div
      style={{
        position: "relative",
        minHeight: "100vh",
        width: "100%",
        backgroundColor: "#0b0b14",
        color: "#ffffff",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: "20px",
          right: "24px",
          zIndex: 30,
        }}
      >
        <ConnectionStatusDot state={connectionState} />
      </div>

      {showReconnectBanner && phase === "paired" ? (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            zIndex: 25,
            backgroundColor: "rgba(127,29,29,0.82)",
            color: "#fff",
            textAlign: "center",
            padding: "10px 16px",
            fontSize: "15px",
            fontWeight: 600,
          }}
        >
          连接中断，正在重连…
        </div>
      ) : null}

      {phase === "paired" && pairing?.eventId ? (
        <div
          style={{
            position: "relative",
            zIndex: 20,
            padding: "16px 72px 8px 24px",
            fontSize: "14px",
            color: "rgba(255,255,255,0.72)",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
            backgroundColor: "rgba(0,0,0,0.25)",
          }}
        >
          已连接：{pairing.eventName ?? "活动"} · 当前：
          {pairing.interactionName ?? "互动"}
        </div>
      ) : null}

      <div
        key={fadeKey}
        style={{
          minHeight: phase === "paired" ? "calc(100vh - 52px)" : "100vh",
          display: "flex",
          flexDirection: "column",
          opacity: 1,
          transition: "opacity 0.45s ease",
        }}
      >
        {phase === "loading" ? (
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "22px",
              color: "rgba(255,255,255,0.55)",
            }}
          >
            正在启动大屏…
          </div>
        ) : null}

        {phase === "waiting" ? (
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "48px 24px",
            }}
          >
            {loadError ? (
              <p
                style={{
                  marginBottom: "24px",
                  color: "#fca5a5",
                  fontSize: "16px",
                }}
              >
                {loadError}
              </p>
            ) : null}
            {pairingToken ? (
              <QRDisplay pairingToken={pairingToken} qrContent={qrContent} />
            ) : (
              <p style={{ color: "rgba(255,255,255,0.55)" }}>正在创建配对码…</p>
            )}
          </div>
        ) : null}

        {phase === "paired" && pairing?.eventId && pairedInteractionType ? (
          <div
            style={{
              flex: 1,
              minHeight: 0,
              position: "relative",
              opacity: showReconnectBanner ? 0.72 : 1,
              transition: "opacity 0.3s ease",
            }}
          >
            <ScreenContentRouter
              eventId={pairing.eventId}
              eventName={pairing.eventName}
              interactionType={pairedInteractionType}
              interactionName={pairing.interactionName}
              displayTarget={pairing.displayTarget}
              usePolling={usePollingFallback}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
