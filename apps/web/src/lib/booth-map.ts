import type { BoothStatus } from "@connectiq/database";

export const BOOTH_STATUS_FILL: Record<BoothStatus, string> = {
  OCCUPIED: "#E6F1FB",
  BOOKED: "#FAEEDA",
  AVAILABLE: "none",
};

export const BOOTH_STATUS_STROKE: Record<BoothStatus, string> = {
  OCCUPIED: "#185FA5",
  BOOKED: "#854F0B",
  AVAILABLE: "#D3D1C7",
};

export const BOOTH_STATUS_DOT: Record<BoothStatus, string> = {
  OCCUPIED: "bg-brand-green",
  BOOKED: "bg-brand-amber",
  AVAILABLE: "bg-gray-300",
};

export function classifyLeadGrade(label: string): "A" | "B" | "C" {
  if (
    label.includes("采购") ||
    label.includes("投资") ||
    label.includes("A")
  ) {
    return "A";
  }
  if (
    label.includes("合作") ||
    label.includes("演示") ||
    label.includes("B")
  ) {
    return "B";
  }
  return "C";
}

export function pctFromEvent(
  e: React.MouseEvent,
  container: DOMRect,
): { x: number; y: number } {
  return {
    x: Math.max(0, Math.min(100, ((e.clientX - container.left) / container.width) * 100)),
    y: Math.max(0, Math.min(100, ((e.clientY - container.top) / container.height) * 100)),
  };
}

export function normalizeRect(
  start: { x: number; y: number },
  end: { x: number; y: number },
): { x: number; y: number; width: number; height: number } {
  const x = Math.min(start.x, end.x);
  const y = Math.min(start.y, end.y);
  const width = Math.max(2, Math.abs(end.x - start.x));
  const height = Math.max(2, Math.abs(end.y - start.y));
  return {
    x: Math.min(x, 100 - width),
    y: Math.min(y, 100 - height),
    width: Math.min(width, 100 - x),
    height: Math.min(height, 100 - y),
  };
}
