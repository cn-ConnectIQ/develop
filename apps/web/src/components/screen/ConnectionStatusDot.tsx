export type ConnectionDotState = "waiting" | "connected" | "disconnected";

type ConnectionStatusDotProps = {
  state: ConnectionDotState;
  label?: string;
};

const STATE_STYLES: Record<
  ConnectionDotState,
  { bg: string; shadow: string; title: string }
> = {
  waiting: {
    bg: "#9ca3af",
    shadow: "0 0 8px rgba(156,163,175,0.5)",
    title: "等待配对",
  },
  connected: {
    bg: "#22c55e",
    shadow: "0 0 10px rgba(34,197,94,0.65)",
    title: "已连接",
  },
  disconnected: {
    bg: "#ef4444",
    shadow: "0 0 10px rgba(239,68,68,0.65)",
    title: "连接中断",
  },
};

export function ConnectionStatusDot({ state, label }: ConnectionStatusDotProps) {
  const style = STATE_STYLES[state];

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        fontSize: "13px",
        color: "rgba(255,255,255,0.72)",
      }}
      title={style.title}
      aria-label={style.title}
    >
      <span
        style={{
          width: "12px",
          height: "12px",
          borderRadius: "9999px",
          backgroundColor: style.bg,
          boxShadow: style.shadow,
          flexShrink: 0,
        }}
      />
      {label ? <span>{label}</span> : null}
    </div>
  );
}
