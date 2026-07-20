import { redirect } from "next/navigation";
import { getScreenPairingPublicUrl } from "@/lib/screen-pairing/public-url";

/** 旧入口 /screen →  canonical https://9li.co/s */
export default function ScreenLegacyRedirectPage() {
  redirect(getScreenPairingPublicUrl());
}
