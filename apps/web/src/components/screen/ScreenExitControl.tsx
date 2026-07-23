"use client";

import { useEffect, useRef, useState } from "react";

type ScreenExitControlProps = {
  onExit: () => Promise<void>;
};

/**
 * 大屏低调退出：默认几乎看不见，悬停/聚焦才略显；点一次出确认，防误触。
 */
export function ScreenExitControl({ onExit }: ScreenExitControlProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function onPointer(e: MouseEvent) {
      if (!panelRef.current?.contains(e.target as Node)) setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onPointer);
    };
  }, [open]);

  async function confirm() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await onExit();
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "退出失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      ref={panelRef}
      style={{
        position: "absolute",
        left: 16,
        bottom: 14,
        zIndex: 40,
      }}
    >
      {!open ? (
        <button
          type="button"
          aria-label="退出大屏"
          title="退出大屏"
          onClick={() => setOpen(true)}
          style={{
            border: "none",
            background: "transparent",
            color: "rgba(255,255,255,0.28)",
            fontSize: 12,
            letterSpacing: "0.04em",
            padding: "6px 8px",
            cursor: "pointer",
            borderRadius: 6,
            transition: "color 0.2s ease, background 0.2s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "rgba(255,255,255,0.65)";
            e.currentTarget.style.background = "rgba(255,255,255,0.06)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = "rgba(255,255,255,0.28)";
            e.currentTarget.style.background = "transparent";
          }}
          onFocus={(e) => {
            e.currentTarget.style.color = "rgba(255,255,255,0.65)";
          }}
          onBlur={(e) => {
            e.currentTarget.style.color = "rgba(255,255,255,0.28)";
          }}
        >
          退出
        </button>
      ) : (
        <div
          style={{
            minWidth: 200,
            padding: "12px 14px",
            borderRadius: 10,
            background: "rgba(12,14,22,0.92)",
            border: "1px solid rgba(255,255,255,0.12)",
            boxShadow: "0 8px 28px rgba(0,0,0,0.45)",
          }}
        >
          <p
            style={{
              margin: "0 0 10px",
              fontSize: 13,
              color: "rgba(255,255,255,0.82)",
              lineHeight: 1.45,
            }}
          >
            退出当前投影，回到配对码？
          </p>
          {error ? (
            <p
              style={{
                margin: "0 0 8px",
                fontSize: 12,
                color: "#fca5a5",
              }}
            >
              {error}
            </p>
          ) : null}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button
              type="button"
              disabled={busy}
              onClick={() => setOpen(false)}
              style={{
                border: "1px solid rgba(255,255,255,0.14)",
                background: "transparent",
                color: "rgba(255,255,255,0.7)",
                fontSize: 12,
                padding: "6px 10px",
                borderRadius: 6,
                cursor: "pointer",
              }}
            >
              取消
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void confirm()}
              style={{
                border: "none",
                background: "rgba(239,68,68,0.85)",
                color: "#fff",
                fontSize: 12,
                padding: "6px 10px",
                borderRadius: 6,
                cursor: busy ? "wait" : "pointer",
                opacity: busy ? 0.7 : 1,
              }}
            >
              {busy ? "退出中…" : "确认退出"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
