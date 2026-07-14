import { redirect } from "next/navigation";

/**
 * 「免费试用 / 办一场活动」已与 Demo 体验合并。
 * 旧链接统一跳到体验注册，避免与正式申请混淆。
 */
export default function OrganizerSignupPage() {
  redirect("/signup/experience");
}
