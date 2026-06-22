"use client";

import { getSession, signIn, useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import { StepProgress } from "./step-progress";

type ApplicationData = {
  status: string;
  orgName: string;
  orgCreditCode: string | null;
  orgWebsite: string | null;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  description: string;
  rejectionReason: string | null;
};

const fieldClass =
  "h-11 w-full rounded-xl border border-border-light bg-white px-4 text-sm outline-none transition-colors focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20";

export function AdminRegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status: sessionStatus } = useSession();
  const isLoggedIn = sessionStatus === "authenticated" && !!session?.user?.id;
  const isAddMode = searchParams.get("mode") === "add";

  const initialStep = isAddMode
    ? 2
    : searchParams.get("step") === "2"
      ? 2
      : 1;
  const [step, setStep] = useState<1 | 2 | 3>(initialStep as 1 | 2 | 3);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [ownedOrgNames, setOwnedOrgNames] = useState<Set<string>>(new Set());

  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [email, setEmail] = useState("");

  const [orgName, setOrgName] = useState("");
  const [orgCreditCode, setOrgCreditCode] = useState("");
  const [orgWebsite, setOrgWebsite] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [description, setDescription] = useState("");

  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreeTruth, setAgreeTruth] = useState(false);

  const loadExistingApplication = useCallback(async () => {
    try {
      const res = await fetch("/api/applications/organizer/me");
      if (!res.ok) return;
      const json = await res.json();
      const apps = (Array.isArray(json.data) ? json.data : []) as ApplicationData[];

      const owned = new Set<string>();
      for (const app of apps) {
        if (app.status === "APPROVED") {
          owned.add(app.orgName.trim());
        }
      }
      for (const org of session?.user?.ownedOrgs ?? []) {
        if (org.admin_status === "APPROVED") {
          owned.add(org.name.trim());
        }
      }
      setOwnedOrgNames(owned);

      if (isAddMode) {
        return;
      }

      if (apps.length === 0) return;

      const pending = apps.find((a) => a.status === "PENDING");
      if (pending) {
        router.replace("/register/pending");
        return;
      }

      const hasApprovedOrg =
        apps.some((a) => a.status === "APPROVED") ||
        (session?.user?.ownedOrgs?.some((o) => o.admin_status === "APPROVED") ??
          false);
      if (hasApprovedOrg && apps.every((a) => a.status !== "REJECTED")) {
        router.replace("/events");
        return;
      }

      const rejected = apps.find((a) => a.status === "REJECTED");
      if (rejected) {
        setOrgName(rejected.orgName);
        setOrgCreditCode(rejected.orgCreditCode ?? "");
        setOrgWebsite(rejected.orgWebsite ?? "");
        setContactName(rejected.contactName);
        setContactEmail(rejected.contactEmail);
        setContactPhone(rejected.contactPhone);
        setDescription(rejected.description);
        setEmail(rejected.contactEmail);
        setPhone(rejected.contactPhone);
        if (searchParams.get("step") === "2") {
          setStep(2);
        }
      }
    } catch {
      // ignore
    }
  }, [isAddMode, router, searchParams, session?.user?.ownedOrgs]);

  useEffect(() => {
    if (sessionStatus === "loading") return;
    if (isAddMode && sessionStatus === "unauthenticated") {
      router.replace(
        `/login?callbackUrl=${encodeURIComponent("/register/admin?mode=add")}`,
      );
      return;
    }
    if (isLoggedIn) {
      setEmail(session.user.email ?? "");
      setPhone(session.user.phone ?? "");
      setContactName((prev) => session.user.name ?? prev);
      setContactEmail((prev) => session.user.email ?? prev);
      setContactPhone((prev) => session.user.phone ?? prev);
      void loadExistingApplication();
    }
  }, [
    isAddMode,
    isLoggedIn,
    loadExistingApplication,
    router,
    session,
    sessionStatus,
  ]);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  async function sendCode() {
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      setError("请输入有效的手机号");
      return;
    }
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

  async function handleStep1Next() {
    setError(null);
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("请输入有效邮箱");
      return;
    }

    if (isLoggedIn) {
      setContactEmail(email);
      setContactPhone(phone || session?.user?.phone || "");
      setStep(2);
      return;
    }

    if (!/^1[3-9]\d{9}$/.test(phone)) {
      setError("请输入有效的手机号");
      return;
    }
    if (code.length !== 6) {
      setError("请输入 6 位验证码");
      return;
    }

    const result = await signIn("phone", {
      phone,
      code,
      redirect: false,
    });
    if (result?.error) {
      setError("验证码错误或已过期");
      return;
    }

    setContactEmail(email);
    setContactPhone(phone);
    setStep(2);
  }

  function handleStep2Next() {
    setError(null);
    const trimmedOrgName = orgName.trim();
    if (ownedOrgNames.has(trimmedOrgName)) {
      setError("你已拥有该组织，无需重复申请");
      return;
    }
    if (!trimmedOrgName) {
      setError("请输入组织/公司名称");
      return;
    }
    if (orgCreditCode && !/^[0-9A-HJ-NPQRTUWXY]{2}\d{6}[0-9A-HJ-NPQRTUWXY]{10}$/.test(orgCreditCode)) {
      setError("请输入 18 位统一社会信用代码");
      return;
    }
    if (orgWebsite && !/^https?:\/\/.+/.test(orgWebsite)) {
      setError("官网地址需以 https:// 开头");
      return;
    }
    if (!contactName.trim()) {
      setError("请输入联系人姓名");
      return;
    }
    if (!contactEmail.trim()) {
      setError("请输入联系邮箱");
      return;
    }
    if (!/^1[3-9]\d{9}$/.test(contactPhone)) {
      setError("请输入有效的联系手机");
      return;
    }
    if (description.length < 100 || description.length > 500) {
      setError("申请说明需 100-500 字");
      return;
    }
    setStep(3);
  }

  async function handleSubmit() {
    if (!agreeTerms || !agreeTruth) {
      setError("请勾选并同意相关条款");
      return;
    }
    setError(null);
    setSubmitting(true);

    try {
      const currentSession = await getSession();
      const hasSession = !!currentSession?.user?.id;

      const payload = {
        email,
        orgName,
        orgCreditCode: orgCreditCode || undefined,
        orgWebsite: orgWebsite || undefined,
        contactName,
        contactEmail,
        contactPhone,
        description,
        ...(hasSession ? {} : { phone, code }),
      };

      const res = await fetch("/api/applications/organizer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();

      if (!res.ok) {
        setError(json.error ?? "提交失败，请稍后重试");
        return;
      }

      if (!hasSession && phone && code) {
        await signIn("phone", { phone, code, redirect: false });
      }

      router.push("/register/pending");
    } catch {
      setError("提交失败，请稍后重试");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-[560px] px-4 py-12">
      <div className="mb-8 text-center">
        <Link href="/" className="text-2xl font-bold text-brand-blue">
          ConnectIQ
        </Link>
        <h1 className="mt-2 text-lg font-semibold text-[var(--admin-ink)]">
          {isAddMode ? "申请新组织" : "申请组织账号"}
        </h1>
        <p className="mt-1 text-sm text-text-muted">
          组织审核通过后，可发布会议/展览活动并管理展位
        </p>
      </div>

      <StepProgress currentStep={step} mode={isAddMode ? "add" : "default"} />

      {error && (
        <div className="mb-4 rounded-xl border border-brand-red/20 bg-brand-red-light px-4 py-3 text-sm text-brand-red">
          {error}
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          {isLoggedIn && (
            <div className="rounded-xl border border-brand-blue/20 bg-brand-blue-light/30 px-4 py-3 text-sm text-brand-blue">
              使用已登录账号：{session?.user?.phone || session?.user?.email}
            </div>
          )}

          {!isLoggedIn && (
            <>
              <div>
                <Label className="mb-1 text-sm font-medium">手机号</Label>
                <InputGroup className="h-11 rounded-xl border-border-light">
                  <InputGroupAddon align="inline-start">
                    <InputGroupText>+86</InputGroupText>
                  </InputGroupAddon>
                  <InputGroupInput
                    placeholder="请输入手机号"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="h-11"
                  />
                </InputGroup>
              </div>

              <div>
                <Label className="mb-1 text-sm font-medium">验证码</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="6 位验证码"
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className={fieldClass}
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
              </div>
            </>
          )}

          <div>
            <Label className="mb-1 text-sm font-medium">邮箱</Label>
            <Input
              type="email"
              placeholder="用于接收审核结果通知"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={fieldClass}
            />
          </div>

          <Button
            type="button"
            className="mt-2 h-11 w-full rounded-xl bg-brand-blue text-base hover:bg-[#14538f]"
            onClick={handleStep1Next}
          >
            下一步 →
          </Button>
        </div>
      )}

      {step === 2 && (
        <div>
          {isAddMode && isLoggedIn && (
            <div className="mb-4 rounded-xl border border-border-light bg-content-bg px-4 py-3 text-sm text-text-muted">
              当前账号：
              <span className="ml-1 font-medium text-[var(--admin-ink)]">
                {session?.user?.phone || session?.user?.email}
              </span>
            </div>
          )}

          <div className="space-y-4">
            {[
              {
                label: "组织/公司名称",
                required: true,
                value: orgName,
                onChange: setOrgName,
                placeholder: "请输入组织/公司名称",
              },
              {
                label: "统一社会信用代码",
                required: false,
                value: orgCreditCode,
                onChange: setOrgCreditCode,
                placeholder: "18 位，选填，有则优先审核",
              },
              {
                label: "官网地址",
                required: false,
                value: orgWebsite,
                onChange: setOrgWebsite,
                placeholder: "https://...",
              },
              {
                label: "联系人姓名",
                required: true,
                value: contactName,
                onChange: setContactName,
                placeholder: "请输入联系人姓名",
              },
              {
                label: "联系邮箱",
                required: true,
                value: contactEmail,
                onChange: setContactEmail,
                placeholder: "请输入联系邮箱",
                type: "email",
              },
              {
                label: "联系手机",
                required: true,
                value: contactPhone,
                onChange: setContactPhone,
                placeholder: "请输入联系手机",
              },
            ].map((field) => (
              <div key={field.label}>
                <Label className="mb-1 text-sm font-medium">
                  {field.label}
                  {field.required && (
                    <span className="ml-0.5 text-brand-red">*</span>
                  )}
                </Label>
                <Input
                  type={field.type ?? "text"}
                  placeholder={field.placeholder}
                  value={field.value}
                  onChange={(e) => field.onChange(e.target.value)}
                  className={fieldClass}
                />
              </div>
            ))}

            <div>
              <Label className="mb-1 text-sm font-medium">
                申请说明<span className="ml-0.5 text-brand-red">*</span>
              </Label>
              <div className="relative">
                <Textarea
                  placeholder="请简要说明贵组织的背景，以及希望如何使用 ConnectIQ（100-500字）"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="min-h-[100px] rounded-xl border-border-light px-4 py-3 text-sm"
                />
                <span className="absolute right-3 bottom-2 text-xs text-text-muted">
                  {description.length}/500
                </span>
              </div>
            </div>
          </div>

          <div className="mt-6 flex gap-3">
            <Button
              type="button"
              variant="outline"
              className="h-11 flex-1 rounded-xl"
              onClick={() =>
                isAddMode ? router.push("/events") : setStep(1)
              }
            >
              ← 上一步
            </Button>
            <Button
              type="button"
              className="h-11 flex-1 rounded-xl bg-brand-blue hover:bg-[#14538f]"
              onClick={handleStep2Next}
            >
              下一步 →
            </Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div>
          <div className="space-y-3 rounded-2xl border border-border-light bg-white p-6">
            {[
              ["组织/公司名称", orgName],
              ["统一社会信用代码", orgCreditCode || "—"],
              ["官网地址", orgWebsite || "—"],
              ["联系人", contactName],
              ["联系邮箱", contactEmail],
              ["联系手机", contactPhone],
              ["通知邮箱", email],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4 text-sm">
                <span className="shrink-0 text-text-muted">{label}</span>
                <span className="text-right font-medium text-[var(--admin-ink)]">
                  {value}
                </span>
              </div>
            ))}
            <div className="border-t border-border-light pt-3">
              <span className="text-sm text-text-muted">申请说明</span>
              <p className="mt-1 text-sm leading-relaxed text-[var(--admin-ink)]">
                {description}
              </p>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            <label className="flex cursor-pointer items-start gap-3">
              <Checkbox
                checked={agreeTerms}
                onCheckedChange={(v) => setAgreeTerms(v === true)}
                className="mt-0.5"
              />
              <span className="text-sm text-text-muted">
                我已阅读并同意《平台服务协议》和《隐私政策》
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-3">
              <Checkbox
                checked={agreeTruth}
                onCheckedChange={(v) => setAgreeTruth(v === true)}
                className="mt-0.5"
              />
              <span className="text-sm text-text-muted">
                我确认以上信息真实有效，授权平台进行组织资质审核
              </span>
            </label>
            {isAddMode && (
              <p className="text-sm text-text-muted">
                提交后平台审核，通过后可在组织切换器中使用新组织。
              </p>
            )}
          </div>

          <div className="mt-6 flex gap-3">
            <Button
              type="button"
              variant="outline"
              className="h-11 flex-1 rounded-xl"
              onClick={() => setStep(2)}
            >
              ← 上一步
            </Button>
            <Button
              type="button"
              className="h-12 flex-1 rounded-xl bg-brand-blue text-base font-semibold hover:bg-[#14538f]"
              disabled={submitting || !agreeTerms || !agreeTruth}
              onClick={handleSubmit}
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  提交中...
                </>
              ) : (
                "提交申请"
              )}
            </Button>
          </div>
        </div>
      )}

      <p className="mt-8 text-center text-sm text-text-muted">
        已有账号？{" "}
        <Link href="/login" className="text-brand-blue hover:underline">
          返回登录
        </Link>
      </p>
    </div>
  );
}
