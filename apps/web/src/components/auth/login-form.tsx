"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { getSession, signIn } from "next-auth/react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Phone } from "lucide-react";
import { toast } from "sonner";
import {
  getPostLoginRedirectPath,
  setAuthRoleCookies,
} from "@/lib/auth-redirect";
import { SEED_PASSWORD, SEED_TEST_ACCOUNTS } from "@/lib/test-accounts";
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

const TEST_ACCOUNT_OPTIONS = [
  { key: "platformAdmin", label: "001 平台管理员", account: SEED_TEST_ACCOUNTS.platformAdmin },
  { key: "conferenceOrganizer", label: "002 会议主办方", account: SEED_TEST_ACCOUNTS.conferenceOrganizer },
  { key: "expoOrganizer", label: "003 展览主办方", account: SEED_TEST_ACCOUNTS.expoOrganizer },
  { key: "exhibitor", label: "004 参展商", account: SEED_TEST_ACCOUNTS.exhibitor },
] as const;

export function LoginForm() {
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [selectedAccount, setSelectedAccount] =
    useState<(typeof TEST_ACCOUNT_OPTIONS)[number]["key"]>("conferenceOrganizer");

  const phoneForm = useForm<PhoneFormValues>({
    resolver: zodResolver(phoneSchema),
    defaultValues: { phone: SEED_TEST_ACCOUNTS.conferenceOrganizer.phone, code: "" },
  });

  const emailForm = useForm<EmailFormValues>({
    resolver: zodResolver(emailSchema),
    defaultValues: {
      email: SEED_TEST_ACCOUNTS.conferenceOrganizer.email,
      password: SEED_PASSWORD,
    },
  });

  function applyTestAccount(key: (typeof TEST_ACCOUNT_OPTIONS)[number]["key"]) {
    const option = TEST_ACCOUNT_OPTIONS.find((item) => item.key === key);
    if (!option) return;
    setSelectedAccount(key);
    phoneForm.setValue("phone", option.account.phone);
    emailForm.setValue("email", option.account.email);
    emailForm.setValue("password", SEED_PASSWORD);
    setError(null);
  }

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  async function redirectAfterLogin() {
    for (let attempt = 0; attempt < 15; attempt++) {
      const session = await getSession();
      if (session?.user?.id) {
        setAuthRoleCookies(session.user);
        try {
          const res = await fetch("/api/me/home-route");
          if (res.ok) {
            const json = await res.json();
            if (json.data?.path) {
              window.location.href = json.data.path as string;
              return;
            }
          }
        } catch {
          // fallback below
        }
        window.location.href = getPostLoginRedirectPath(session.user);
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    setError("登录会话未就绪，请刷新页面后重试");
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
    if (json.data?.devCode) {
      phoneForm.setValue("code", json.data.devCode);
      toast.info(`测试验证码：${json.data.devCode}`, { duration: 8000 });
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
      email: values.email.trim().toLowerCase(),
      password: values.password.trim(),
      redirect: false,
    });
    if (result?.error) {
      setError(
        result.error === "CredentialsSignin"
          ? "邮箱或密码错误（请确认已运行 pnpm db:seed 写入测试账号）"
          : "登录失败，请稍后重试",
      );
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
        <Tabs defaultValue="email">
          <TabsList className="mb-4 grid w-full grid-cols-2">
            <TabsTrigger value="email">账号密码</TabsTrigger>
            <TabsTrigger value="phone">手机号登录</TabsTrigger>
          </TabsList>

          <div className="mb-4 space-y-2">
            <Label htmlFor="test-account">测试账号</Label>
            <select
              id="test-account"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={selectedAccount}
              onChange={(e) =>
                applyTestAccount(
                  e.target.value as (typeof TEST_ACCOUNT_OPTIONS)[number]["key"],
                )
              }
            >
              {TEST_ACCOUNT_OPTIONS.map((item) => (
                <option key={item.key} value={item.key}>
                  {item.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-text-tertiary">
              线上环境请优先使用「账号密码」；密码均为 {SEED_PASSWORD}
            </p>
          </div>

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
            </form>
          </TabsContent>

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
                未配置短信服务时，获取验证码后会在页面提示 6 位码
              </p>
            </form>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
