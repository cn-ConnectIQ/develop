"use client";

import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { getSession, signIn } from "next-auth/react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Phone } from "lucide-react";
import { toast } from "sonner";
import {
  clearAuthRoleCookies,
  getPostLoginRedirectPath,
  setAuthRoleCookies,
} from "@/lib/auth-redirect";
import { withPublicPath } from "@/lib/public-path";
import {
  PLATFORM_ADMIN_EMAIL,
  SEED_PASSWORD,
  SEED_TEST_ACCOUNTS,
} from "@/lib/test-accounts";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/brand/BrandLogo";
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

const emailPasswordSchema = z.object({
  email: z.string().email("请输入有效邮箱"),
  password: z.string().min(6, "密码至少 6 位"),
});

const emailCodeSchema = z.object({
  email: z.string().email("请输入有效邮箱"),
  code: z.string().length(6, "请输入 6 位验证码"),
});

type PhoneFormValues = z.infer<typeof phoneSchema>;
type EmailPasswordFormValues = z.infer<typeof emailPasswordSchema>;
type EmailCodeFormValues = z.infer<typeof emailCodeSchema>;

const TEST_ACCOUNT_OPTIONS = [
  {
    key: "platformAdmin",
    label: "平台管理员",
    account: SEED_TEST_ACCOUNTS.platformAdmin,
  },
  {
    key: "accountAdmin",
    label: "账号管理员",
    account: SEED_TEST_ACCOUNTS.accountAdmin,
  },
] as const;

export function LoginForm() {
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [emailCountdown, setEmailCountdown] = useState(0);
  const [selectedAccount, setSelectedAccount] =
    useState<(typeof TEST_ACCOUNT_OPTIONS)[number]["key"]>("platformAdmin");

  const phoneForm = useForm<PhoneFormValues>({
    resolver: zodResolver(phoneSchema),
    defaultValues: { phone: SEED_TEST_ACCOUNTS.platformAdmin.phone, code: "" },
  });

  const emailPasswordForm = useForm<EmailPasswordFormValues>({
    resolver: zodResolver(emailPasswordSchema),
    defaultValues: {
      email: PLATFORM_ADMIN_EMAIL,
      password: SEED_PASSWORD,
    },
  });

  const emailCodeForm = useForm<EmailCodeFormValues>({
    resolver: zodResolver(emailCodeSchema),
    defaultValues: {
      email: PLATFORM_ADMIN_EMAIL,
      code: "",
    },
  });

  function applyTestAccount(key: (typeof TEST_ACCOUNT_OPTIONS)[number]["key"]) {
    const option = TEST_ACCOUNT_OPTIONS.find((item) => item.key === key);
    if (!option) return;
    setSelectedAccount(key);
    phoneForm.setValue("phone", option.account.phone);
    emailPasswordForm.setValue("email", option.account.email);
    emailPasswordForm.setValue("password", SEED_PASSWORD);
    emailCodeForm.setValue("email", option.account.email);
    emailCodeForm.setValue("code", "");
    setError(null);
  }

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  useEffect(() => {
    if (emailCountdown <= 0) return;
    const timer = setTimeout(() => setEmailCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [emailCountdown]);

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
              window.location.href = withPublicPath(json.data.path as string);
              return;
            }
          }
        } catch {
          // fallback below
        }
        window.location.href = withPublicPath(
          getPostLoginRedirectPath(session.user),
        );
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    setError("登录会话未就绪，请刷新页面后重试");
  }

  async function sendSmsCode() {
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

  async function sendEmailCode() {
    const email = emailCodeForm.getValues("email");
    const valid = await emailCodeForm.trigger("email");
    if (!valid) return;

    setError(null);
    const res = await fetch("/api/auth/send-email-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "发送失败");
      return;
    }
    if (json.data?.devCode) {
      emailCodeForm.setValue("code", json.data.devCode);
      toast.info(`测试验证码：${json.data.devCode}`, { duration: 8000 });
    } else {
      toast.success("验证码已发送到邮箱");
    }
    setEmailCountdown(60);
  }

  const onPhoneSubmit = phoneForm.handleSubmit(async (values) => {
    setError(null);
    clearAuthRoleCookies();
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

  const onEmailPasswordSubmit = emailPasswordForm.handleSubmit(async (values) => {
    setError(null);
    clearAuthRoleCookies();
    const result = await signIn("credentials", {
      email: values.email.trim().toLowerCase(),
      password: values.password.trim(),
      redirect: false,
    });
    if (result?.error) {
      setError(
        result.error === "CredentialsSignin"
          ? "邮箱或密码错误"
          : "登录失败，请稍后重试",
      );
      return;
    }
    await redirectAfterLogin();
  });

  const onEmailCodeSubmit = emailCodeForm.handleSubmit(async (values) => {
    setError(null);
    clearAuthRoleCookies();
    const result = await signIn("email-code", {
      email: values.email.trim().toLowerCase(),
      code: values.code,
      redirect: false,
    });
    if (result?.error) {
      setError("验证码错误或已过期");
      return;
    }
    await redirectAfterLogin();
  });

  return (
    <Card className="w-full max-w-[400px] rounded-2xl border-border-light bg-white p-8 shadow-sm">
      <CardHeader className="items-center p-0 pb-6 text-center">
        <BrandLogo size={56} priority className="mb-4 rounded-[14px] shadow-sm" />
        <CardTitle className="text-2xl font-bold text-brand-green">
          玖莅
        </CardTitle>
        <CardDescription>管理后台</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <Tabs defaultValue="email-code">
          <TabsList className="mb-4 grid w-full grid-cols-3">
            <TabsTrigger value="email-code">邮箱验证码</TabsTrigger>
            <TabsTrigger value="email">账号密码</TabsTrigger>
            <TabsTrigger value="phone">手机号</TabsTrigger>
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
              平台管理员推荐「邮箱验证码」：{PLATFORM_ADMIN_EMAIL}；密码 {SEED_PASSWORD}
            </p>
          </div>

          <TabsContent value="email-code">
            <form onSubmit={onEmailCodeSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email-code-email">邮箱</Label>
                <Input
                  id="email-code-email"
                  type="email"
                  autoComplete="email"
                  {...emailCodeForm.register("email")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email-code">验证码</Label>
                <div className="flex gap-2">
                  <Input
                    id="email-code"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="6 位验证码"
                    className="text-center text-lg tracking-widest"
                    {...emailCodeForm.register("code")}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="shrink-0"
                    disabled={emailCountdown > 0}
                    onClick={sendEmailCode}
                  >
                    {emailCountdown > 0 ? `${emailCountdown}s` : "获取验证码"}
                  </Button>
                </div>
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button
                type="submit"
                className="w-full bg-brand-blue hover:bg-brand-blue/90"
                disabled={emailCodeForm.formState.isSubmitting}
              >
                {emailCodeForm.formState.isSubmitting ? "登录中..." : "登录"}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="email">
            <form onSubmit={onEmailPasswordSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">邮箱</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  {...emailPasswordForm.register("email")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">密码</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  {...emailPasswordForm.register("password")}
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button
                type="submit"
                className="w-full bg-brand-blue hover:bg-brand-blue/90"
                disabled={emailPasswordForm.formState.isSubmitting}
              >
                {emailPasswordForm.formState.isSubmitting ? "登录中..." : "登录"}
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
                    onClick={sendSmsCode}
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
            </form>
          </TabsContent>
        </Tabs>

        <div className="mt-6 space-y-2 border-t border-border-light pt-5 text-left">
          <p className="text-center text-xs text-text-muted">还没有账号？选择入驻方式</p>
          <Link
            href="/signup/experience"
            className="flex flex-col rounded-xl border border-brand-blue/25 bg-brand-blue/5 px-3.5 py-3 transition-colors hover:border-brand-blue/50 hover:bg-brand-blue/10"
          >
            <span className="text-sm font-semibold text-brand-blue">
              免费体验演示展会
            </span>
            <span className="mt-0.5 text-xs leading-relaxed text-text-muted">
              7 天试用 Demo 展会后台（含活动码 TEST1377），无需审核即可上手
            </span>
          </Link>
          <Link
            href="/register/admin"
            className="flex flex-col rounded-xl border border-border-light bg-white px-3.5 py-3 transition-colors hover:border-brand-green/40 hover:bg-brand-green/5"
          >
            <span className="text-sm font-semibold text-[var(--admin-ink,#1a1a1a)]">
              申请正式主办账号
            </span>
            <span className="mt-0.5 text-xs leading-relaxed text-text-muted">
              提交组织资料，平台审核通过后可创建活动并充值邀约
            </span>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
