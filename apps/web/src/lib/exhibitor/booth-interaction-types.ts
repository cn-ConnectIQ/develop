export type BoothInteractionItem = {
  id: string;
  sessionCode: string;
  qrUrl: string | null;
  scanUrl: string;
  name: string;
  ownerType: string;
  kind: "poll" | "lottery";
  interactionId: string;
  title: string;
  subType: string;
  status: string;
  participantCount: number;
  isActive: boolean;
  requireLeadCapture: boolean;
  createdAt: string;
  eventId: string;
};

export function boothInteractionGroupStatus(
  kind: "poll" | "lottery",
  status: string,
): "live" | "draft" | "ended" {
  if (kind === "poll") {
    if (status === "LIVE") return "live";
    if (status === "CLOSED") return "ended";
    return "draft";
  }
  if (status === "OPEN" || status === "DRAWING") return "live";
  if (status === "FINISHED") return "ended";
  return "draft";
}
