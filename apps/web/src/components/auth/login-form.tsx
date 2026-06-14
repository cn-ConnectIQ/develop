"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { getSession, signIn } from "next-auth/react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Phone } from "lucide-react";
import { getRoleDashboardPath } from "@connectiq/utils";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";

const phoneSchema = z.object({
  phone: z.string().regex(/^1[3-9]\d{9}$/, "请输入有效手机号"),
  code: z.string().length(6, "请输入 6 位验证码"),
});

const emailSchema = z.object({
  email: z.string().email("请输入有效邮箱"),
  password: z.string().min(6, "密码至少 6 位"),
});

type PhoneFormValues = z.infer<typeof phoneSchema>;
type EmailFormValues = z.infer<typeof emailSchema>;

export function LoginForm() {
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);

  const phoneForm = useForm<PhoneFormValues>({
    resolver: zodResolver(phoneSchema),
    defaultValues: { phone: "13800000002", code: "" },
  });

  const emailForm = useForm<EmailFormValues>({
    resolver: zodResolver(emailSchema),
    defaultValues: {
      email: "admin@connectiq.test",
      password: "ConnectIQ2024!",
    },
  });

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  async function redirectAfterLogin() {
    const session = await getSession();
    window.location.href = getRoleDashboardPath(
      session?.user?.role ?? "",
      session?.user?.entityId,
      session?.user?.hasPlatformAdmin,
    );
  }

  async function sendCode() {
    const phone = phoneForm.getValues("phone");
    const valid = await phoneForm.trigger("phone");
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
    setCountdown(60);
  }

  const onPhoneSubmit = phoneForm.handleSubmit(async (values) => {
    setError(null);
    const result = await signIn("phone", {
      phone: values.phone,
      code: values.code,
      redirect: false,
    });
    if (result?.error) {
      setError("验证码错误或已过期");
      return;
    }
    await redirectAfterLogin();
  });

  const onEmailSubmit = emailForm.handleSubmit(async (values) => {
    setError(null);
    const result = await signIn("credentials", {
      email: values.email,
      password: values.password,
      redirect: false,
    });
    if (result?.error) {
      setError("邮箱或密码错误");
      return;
    }
    await redirectAfterLogin();
  });

  return (
    <Card className="w-full max-w-[400px] rounded-2xl border-border-light bg-white p-8 shadow-sm">
      <CardHeader className="items-center p-0 pb-6 text-center">
        <CardTitle className="text-2xl font-bold text-brand-blue">
          ConnectIQ
        </CardTitle>
        <CardDescription>管理后台</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <Tabs defaultValue="phone">
          <TabsList className="mb-6 grid w-full grid-cols-2">
            <TabsTrigger value="phone">手机号登录</TabsTrigger>
            <TabsTrigger value="email">账号密码</TabsTrigger>
          </TabsList>

          <TabsContent value="phone">
            <form onSubmit={onPhoneSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="phone">手机号</Label>
                <InputGroup>
                  <InputGroupAddon>
                    <InputGroupText>+86</InputGroupText>
                  </InputGroupAddon>
                  <InputGroupInput
                    id="phone"
                    inputMode="numeric"
                    placeholder="请输入手机号"
                    {...phoneForm.register("phone")}
                  />
                  <InputGroupAddon align="inline-end">
                    <Phone className="size-4 text-text-tertiary" />
                  </InputGroupAddon>
                </InputGroup>
              </div>
              <div className="space-y-2">
                <Label htmlFor="code">验证码</Label>
                <div className="flex gap-2">
                  <Input
                    id="code"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="6 位验证码"
                    className="text-center text-lg tracking-widest"
                    {...phoneForm.register("code")}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="shrink-0"
                    disabled={countdown > 0}
                    onClick={sendCode}
                  >
                    {countdown > 0 ? `${countdown}s` : "获取验证码"}
                  </Button>
                </div>
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button
                type="submit"
                className="w-full bg-brand-blue hover:bg-brand-blue/90"
                disabled={phoneForm.formState.isSubmitting}
              >
                {phoneForm.formState.isSubmitting ? "登录中..." : "登录"}
              </Button>
              <p className="text-center text-xs text-text-tertiary">
                首次登录将自动创建账号
              </p>
            </form>
          </TabsContent>

          <TabsContent value="email">
            <form onSubmit={onEmailSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">邮箱</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  {...emailForm.register("email")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">密码</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  {...emailForm.register("password")}
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button
                type="submit"
                className="w-full bg-brand-blue hover:bg-brand-blue/90"
                disabled={emailForm.formState.isSubmitting}
              >
                {emailForm.formState.isSubmitting ? "登录中..." : "登录"}
              </Button>
              <p className="text-xs text-text-tertiary">
                测试账号：admin / organizer1 / expo / exhibitor @connectiq.test
                <br />
                密码：ConnectIQ2024!
                <br />
                平台概览页需使用 <strong>admin@connectiq.test</strong>（平台管理员）
              </p>
            </form>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
