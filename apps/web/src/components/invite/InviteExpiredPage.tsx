export function InviteExpiredPage({
  reason,
}: {
  reason?: "invalid" | "expired";
}) {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        background: "linear-gradient(160deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)",
        color: "#f8fafc",
        fontFamily:
          '"PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif',
      }}
    >
      <div style={{ maxWidth: 420, textAlign: "center" }}>
        <p style={{ fontSize: 14, letterSpacing: "0.2em", opacity: 0.7 }}>
          玖莅
        </p>
        <h1 style={{ fontSize: 22, margin: "16px 0 12px", fontWeight: 600 }}>
          这个链接已经失效了
        </h1>
        <p style={{ fontSize: 15, lineHeight: 1.7, opacity: 0.85 }}>
          {reason === "expired"
            ? "邀请已过期。请联系主办方重新获取，或前往 9li.co 了解玖莅。"
            : "请联系主办方重新获取，或前往 9li.co 了解玖莅。"}
        </p>
        <a
          href="https://9li.co"
          style={{
            display: "inline-block",
            marginTop: 28,
            padding: "12px 24px",
            background: "#f8fafc",
            color: "#0f172a",
            borderRadius: 8,
            textDecoration: "none",
            fontWeight: 600,
          }}
        >
          了解玖莅
        </a>
      </div>
    </main>
  );
}
