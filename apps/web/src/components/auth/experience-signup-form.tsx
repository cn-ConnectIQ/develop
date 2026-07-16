"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { getSession, signIn } from "next-auth/react";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  clearAuthRoleCookies,
  setAuthRoleCookies,
} from "@/lib/auth-redirect";
import { withPublicPath } from "@/lib/public-path";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";

const schema = z.object({
  phone: z.string().regex(/^1[3-9]\d{9}$/, "请输入有效手机号"),
  code: z.string().length(6, "请输入 6 位验证码"),
  contactName: z.string().min(1, "请输入姓名").max(40),
  companyName: z.string().min(2, "请填写公司名称（至少 2 个字符）").max(80),
  email: z.string().email("请输入有效邮箱"),
});

type FormValues = z.infer<typeof schema>;

export function ExperienceSignupForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      phone: "",
      code: "",
      contactName: "",
      companyName: "",
      email: "",
    },
  });

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  async function redirectAfterLogin(eventId: string) {
    for (let attempt = 0; attempt < 15; attempt++) {
      const session = await getSession();
      if (session?.user?.id) {
        setAuthRoleCookies(session.user);
        window.location.href = withPublicPath(`/events/${eventId}`);
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    router.push(withPublicPath(`/events/${eventId}`));
  }

  async function sendCode() {
    const phone = form.getValues("phone");
    const valid = await form.trigger("phone");
    if (!valid) return;

    setError(null);
    const res = await fetch("/api/auth/send-sms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "发送失败");
      return;
    }
    if (json.data?.devCode) {
      form.setValue("code", json.data.devCode);
      toast.info(`测试验证码：${json.data.devCode}`, { duration: 8000 });
    }
    setCountdown(60);
  }

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    clearAuthRoleCookies();

    const res = await fetch("/api/auth/experience-signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: values.phone,
        code: values.code,
        contactName: values.contactName,
        companyName: values.companyName,
        email: values.email.trim().toLowerCase(),
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "开通失败");
      return;
    }

    const signInResult = await signIn("experience-signup", {
      loginToken: json.data.loginToken as string,
      redirect: false,
    });
    if (signInResult?.error) {
      setError("自动登录失败，请返回登录页手动登录");
      return;
    }

    toast.success("体验已开通并进入潜客待审，正在进入演示展会…");
    await redirectAfterLogin(json.data.eventId as string);
  });

  return (
    <Card className="w-full max-w-[440px] rounded-2xl border-border-light bg-white p-8 shadow-sm">
      <CardHeader className="items-center p-0 pb-6 text-center">
        <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-brand-green-soft">
          <Sparkles className="size-6 text-brand-green" />
        </div>
        <CardTitle className="text-2xl font-bold text-brand-blue">
          免费体验演示展会
        </CardTitle>
        <CardDescription className="mt-2 text-sm leading-relaxed">
          进入「智链未来产业博览会 2026」（活动码 TEST1377）完整演示环境，含
          Web 后台 + 小程序观众端；默认 7 天，体验即潜客待审
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="contactName">姓名</Label>
            <Input id="contactName" {...form.register("contactName")} />
            {form.formState.errors.contactName && (
              <p className="text-xs text-destructive">
                {form.formState.errors.contactName.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="companyName">公司</Label>
            <Input
              id="companyName"
              placeholder="与组织申请一致的公司全称"
              {...form.register("companyName")}
            />
            {form.formState.errors.companyName && (
              <p className="text-xs text-destructive">
                {form.formState.errors.companyName.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">邮箱</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="用于审核通知与登录"
              {...form.register("email")}
            />
            {form.formState.errors.email && (
              <p className="text-xs text-destructive">
                {form.formState.errors.email.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">手机号</Label>
            <InputGroup>
              <InputGroupAddon>
                <InputGroupText>+86</InputGroupText>
              </InputGroupAddon>
              <InputGroupInput id="phone" {...form.register("phone")} />
            </InputGroup>
          </div>
          <div className="space-y-2">
            <Label htmlFor="code">验证码</Label>
            <div className="flex gap-2">
              <Input id="code" maxLength={6} {...form.register("code")} />
              <Button
                type="button"
                variant="outline"
                disabled={countdown > 0}
                onClick={() => void sendCode()}
              >
                {countdown > 0 ? `${countdown}s` : "获取验证码"}
              </Button>
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button
            type="submit"
            className="w-full"
            disabled={form.formState.isSubmitting}
          >
            {form.formState.isSubmitting ? "开通中…" : "开始免费体验"}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-text-muted">
          已有账号？{" "}
          <Link href="/login" className="text-brand-blue hover:underline">
            返回登录
          </Link>
        </p>
        <p className="mt-2 text-center text-xs text-text-tertiary">
          体验账号支持单人短信/邮件邀请，不支持批量邀请与创建/发布活动；已同步进入平台潜客待审，审核通过后转正并可付费使用
        </p>
      </CardContent>
    </Card>
  );
}
