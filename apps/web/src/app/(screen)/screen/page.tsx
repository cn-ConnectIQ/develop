import type { Metadata } from "next";
import { ScreenPageClient } from "@/components/screen/ScreenPageClient";

export const metadata: Metadata = {
  title: "ConnectIQ 大屏",
  description: "ConnectIQ 现场互动投影大屏",
};

export default function ScreenPage() {
  return <ScreenPageClient />;
}
