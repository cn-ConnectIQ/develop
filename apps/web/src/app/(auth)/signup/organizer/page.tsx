import Link from "next/link";
import { Building2, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function OrganizerSignupPage() {
  return (
    <div className="flex min-h-full items-center justify-center bg-content-bg px-4 py-10">
      <Card className="w-full max-w-md border-border-light shadow-sm">
        <CardHeader className="space-y-2 text-center">
          <CardTitle className="text-xl">试用自助开通已关闭</CardTitle>
          <CardDescription className="text-sm leading-relaxed">
            正式能力需经平台审核。请选择以下任一通道入驻：
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button asChild className="h-11 w-full justify-start gap-3">
            <Link href="/register/admin">
              <Building2 className="size-4 shrink-0" />
              正式组织申请（审核后开通）
            </Link>
          </Button>
          <Button
            asChild
            variant="outline"
            className="h-11 w-full justify-start gap-3"
          >
            <Link href="/signup/experience">
              <FlaskConical className="size-4 shrink-0" />
              Demo 展会体验（潜客，审核后转正）
            </Link>
          </Button>
          <p className="pt-2 text-center text-xs text-text-muted">
            已有账号？{" "}
            <Link href="/login" className="text-brand-blue underline-offset-2 hover:underline">
              直接登录
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
