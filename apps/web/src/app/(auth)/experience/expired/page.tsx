import Link from "next/link";
import { Clock, Sparkles } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

export default function ExperienceExpiredPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-content-bg px-4 py-10">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-brand-amber-light">
            <Clock className="size-6 text-brand-amber" />
          </div>
          <CardTitle>体验账号已过期</CardTitle>
          <CardDescription>
            您的 7 天演示展会体验已结束。如需继续使用，请联系平台管理员延期体验，或申请转为正式账号。
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Link
            href="/signup/experience"
            className={cn(buttonVariants(), "justify-center")}
          >
            <Sparkles className="mr-2 size-4" />
            重新申请体验
          </Link>
          <Link
            href="/login"
            className={cn(buttonVariants({ variant: "outline" }), "justify-center")}
          >
            返回登录
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
