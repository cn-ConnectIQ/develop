"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { getSession, signIn } from "next-auth/react";
import { Building2, CheckCircle2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  clearAuthRoleCookies,
  setAuthRoleCookies,
} from "@/lib/auth-redirect";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
  companyName: z.string().min(2, "企业名称至少 2 个字符"),
  contactName: z.string().optional(),
  agreeTerms: z.literal(true, {
    errorMap: () => ({ message: "请同意服务协议" }),
  }),
});

type FormValues = z.infer<typeof schema>;

const ONBOARDING_STEPS = [
  "注册试用账号",
  "创建第一场活动",
  "Excel 导入名单",
  "生成活动码，现场体验连接",
];

export function OrganizerSignupForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      phone: "",
      code: "",
      companyName: "",
      contactName: "",
      agreeTerms: undefined,
    },
  });

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

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

  async function redirectAfterSignup() {
    for (let attempt = 0; attempt < 15; attempt++) {
      const session = await getSession();
      if (session?.user?.id) {
        setAuthRoleCookies(session.user);
        router.push("/organizer/dashboard");
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    setError("注册成功，但登录未就绪，请手动登录");
  }

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    clearAuthRoleCookies();

    const res = await fetch("/api/auth/organizer-signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: values.phone,
        code: values.code,
        companyName: values.companyName,
        contactName: values.contactName?.trim() || undefined,
        signupSource: "self_service_organizer",
      }),
    });
    const json = await res.json();

    if (!res.ok) {
      setError(json.error ?? "注册失败");
      return;
    }

    const signInResult = await signIn("organizer-signup", {
      loginToken: json.data.loginToken as string,
      redirect: false,
    });

    if (signInResult?.error) {
      toast.success("注册成功，请登录");
      router.push("/login");
      return;
    }

    toast.success("欢迎加入 ConnectIQ 试用！");
    await redirectAfterSignup();
  });

  return (
    <div className="mx-auto grid w-full max-w-4xl gap-8 px-4 py-10 lg:grid-cols-[1fr_400px]">
      <div className="hidden lg:block">
        <div className="sticky top-10 space-y-6">
          <div>
            <p className="text-sm font-medium text-brand-blue">免费试用</p>
            <h1 className="mt-2 text-2xl font-bold leading-snug text-[var(--admin-ink)]">
              办一场活动，体验现场连接
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-text-muted">
              无需百格、MarketUP 或任何第三方平台账号。注册即可独立创建活动、导入
              Excel 名单、生成活动码，在现场感受连接数据与互动价值。
            </p>
          </div>

          <ol className="space-y-3">
            {ONBOARDING_STEPS.map((step, index) => (
              <li
                key={step}
                className="flex items-start gap-3 rounded-xl border border-border-light bg-white px-4 py-3 text-sm"
              >
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-blue/10 text-xs font-semibold text-brand-blue">
                  {index + 1}
                </span>
                <span className="text-[var(--admin-ink)]">{step}</span>
              </li>
            ))}
          </ol>

          <p className="text-xs text-text-muted">
            试用期间可完整体验 1 场活动的核心功能；需要不限场次或高级能力时，再提交正式审核即可。
          </p>
        </div>
      </div>

      <Card className="rounded-2xl border-border-light bg-white shadow-sm">
        <CardHeader className="pb-4 text-center">
          <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-full bg-brand-blue-light">
            <Sparkles className="size-5 text-brand-blue" />
          </div>
          <CardTitle className="text-xl">主办方免费试用</CardTitle>
          <CardDescription className="text-sm">
            手机验证 + 企业名称，30 秒开始第一场活动
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="companyName">企业 / 组织名称 *</Label>
              <InputGroup className="h-11 rounded-xl">
                <InputGroupAddon align="inline-start">
                  <Building2 className="size-4 text-text-muted" />
                </InputGroupAddon>
                <InputGroupInput
                  id="companyName"
                  placeholder="例如：未来科技活动公司"
                  {...form.register("companyName")}
                />
              </InputGroup>
              {form.formState.errors.companyName && (
                <p className="text-xs text-brand-red">
                  {form.formState.errors.companyName.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="contactName">联系人（选填）</Label>
              <Input
                id="contactName"
                placeholder="默认可不填"
                className="h-11 rounded-xl"
                {...form.register("contactName")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">手机号 *</Label>
              <InputGroup className="h-11 rounded-xl">
                <InputGroupAddon align="inline-start">
                  <InputGroupText>+86</InputGroupText>
                </InputGroupAddon>
                <InputGroupInput
                  id="phone"
                  inputMode="numeric"
                  placeholder="用于登录与通知"
                  {...form.register("phone")}
                />
              </InputGroup>
              {form.formState.errors.phone && (
                <p className="text-xs text-brand-red">
                  {form.formState.errors.phone.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="code">短信验证码 *</Label>
              <div className="flex gap-2">
                <Input
                  id="code"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="6 位验证码"
                  className="h-11 rounded-xl text-center tracking-widest"
                  {...form.register("code")}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 shrink-0 rounded-xl px-4"
                  disabled={countdown > 0}
                  onClick={sendCode}
                >
                  {countdown > 0 ? `${countdown}s` : "获取验证码"}
                </Button>
              </div>
              {form.formState.errors.code && (
                <p className="text-xs text-brand-red">
                  {form.formState.errors.code.message}
                </p>
              )}
            </div>

            <label className="flex cursor-pointer items-start gap-3 pt-1">
              <Checkbox
                checked={form.watch("agreeTerms") === true}
                onCheckedChange={(v) =>
                  form.setValue("agreeTerms", v === true ? true : (undefined as never), {
                    shouldValidate: true,
                  })
                }
                className="mt-0.5"
              />
              <span className="text-xs leading-relaxed text-text-muted">
                我已阅读并同意《平台服务协议》和《隐私政策》，了解试用版功能范围
              </span>
            </label>
            {form.formState.errors.agreeTerms && (
              <p className="text-xs text-brand-red">
                {form.formState.errors.agreeTerms.message}
              </p>
            )}

            {error && (
              <p className="rounded-lg bg-brand-red-light px-3 py-2 text-sm text-brand-red">
                {error}
              </p>
            )}

            <Button
              type="submit"
              className="h-11 w-full rounded-xl bg-brand-blue text-base hover:bg-brand-blue/90"
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting ? "注册中…" : "开始免费试用"}
            </Button>

            <p className="text-center text-xs text-text-muted">
              已有账号？{" "}
              <Link href="/login" className="text-brand-blue hover:underline">
                直接登录
              </Link>
            </p>
            <p className="text-center text-xs text-text-tertiary">
              需要企业资质审核的正式账号？{" "}
              <Link
                href="/register/admin"
                className="text-brand-blue hover:underline"
              >
                提交正式申请
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
