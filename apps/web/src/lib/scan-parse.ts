export type ScanResultType =
  | "BADGE"
  | "CHECKIN"
  | "BOOTH"
  | "UNKNOWN";

export type ScanParseResult = {
  content: string;
  type: ScanResultType;
  userId?: string;
  badgeQr?: string;
};

/** 解析扫码枪 / 粘贴的二维码内容（与小程序 scanDispatch 对齐） */
export function parseScanContent(content: string): ScanParseResult {
  const trimmed = content.trim();
  if (!trimmed) {
    return { content: trimmed, type: "UNKNOWN" };
  }

  try {
    const url = new URL(trimmed);
    const parts = url.pathname.split("/").filter(Boolean);

    if (url.pathname.startsWith("/card/")) {
      const userId = parts[parts.length - 1];
      return { content: trimmed, type: "BADGE", userId };
    }

    if (parts.includes("checkin") || url.pathname.startsWith("/checkin/")) {
      const last = parts[parts.length - 1];
      const userId = last !== "checkin" ? last : undefined;
      return {
        content: trimmed,
        type: "CHECKIN",
        userId,
        badgeQr: userId ?? trimmed,
      };
    }
  } catch {
    // 非 URL
  }

  try {
    const json = JSON.parse(trimmed) as Record<string, unknown>;
    const kind = String(json.t ?? json.type ?? "").toLowerCase();
    if (kind === "badge" || kind === "card" || kind === "checkin") {
      const userId = String(json.userId ?? json.user_id ?? json.badge_qr ?? "");
      return {
        content: trimmed,
        type: kind === "checkin" ? "CHECKIN" : "BADGE",
        userId: userId || undefined,
        badgeQr: String(json.badge_qr ?? json.badgeQr ?? userId ?? trimmed),
      };
    }
  } catch {
    // 非 JSON
  }

  if (/^[a-z0-9]{25,}$/i.test(trimmed)) {
    return { content: trimmed, type: "BADGE", userId: trimmed };
  }

  return { content: trimmed, type: "CHECKIN", badgeQr: trimmed };
}

/** 从扫码结果提取胸牌码（用于签到 API） */
export function resolveBadgeQr(parsed: ScanParseResult): string {
  if (parsed.badgeQr) return parsed.badgeQr;
  if (parsed.userId) return parsed.userId;
  return parsed.content;
}

/** 从扫码结果提取访客 userId（用于线索采集） */
export function resolveVisitorUserId(parsed: ScanParseResult): string | null {
  if (parsed.userId) return parsed.userId;
  if (parsed.type === "BADGE" && /^[a-z0-9]{25,}$/i.test(parsed.content)) {
    return parsed.content;
  }
  return null;
}
