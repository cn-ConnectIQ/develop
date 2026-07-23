export const TOKEN_TTL_SECONDS = 90;
export const ONLINE_WINDOW_MS = 30 * 1000;

export type PairingStatusValue = "WAITING" | "PAIRED" | "EXPIRED";
export type InteractionTypeValue = "POLL" | "LOTTERY" | "QA";

export type ScreenPairingDisplayTarget = {
  pollId: string | null;
  lotteryId: string | null;
};

export type ScreenPairingStatusPayload = {
  id: string;
  pairingToken: string;
  status: PairingStatusValue;
  tokenExpiresAt: string;
  expiresIn?: number;
  screenOnline: boolean;
  eventId: string | null;
  eventName: string | null;
  interactionType: InteractionTypeValue | null;
  interactionId: string | null;
  interactionName: string | null;
  displayTarget: ScreenPairingDisplayTarget | null;
  pairedBy: string | null;
  pairedAt: string | null;
  lastHeartbeatAt: string | null;
  createdAt: string;
};

export function buildQrContent(pairingToken: string): string {
  // 带 token 的公开页 URL：小程序 scanCode 可直接解析；浏览器打开仍可进入大屏页
  return `https://9li.co/uc/s?token=${encodeURIComponent(pairingToken)}`
}

export const SCREEN_PAIRING_BROADCAST_EVENT = "screen-pairing";

export type ScreenPairingPairedPayload = {
  eventId: string;
  eventName: string | null;
  interactionType: InteractionTypeValue;
  interactionId: string;
  interactionName: string | null;
  pairedAt: string;
};

export type ScreenPairingBroadcast =
  | { type: "PAIRED"; data: ScreenPairingPairedPayload }
  | { type: "RESET"; data: { pairingToken: string } };

export type ScreenPairingBroadcastMessage = ScreenPairingBroadcast & {
  at: string;
};

export function screenPairingChannelName(pairingToken: string) {
  return `screen:${pairingToken}`;
}
