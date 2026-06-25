"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { AccountType } from "@connectiq/database";
import {
  Camera,
  ExternalLink,
  ImageIcon,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { AdminPageBody } from "@/components/layout/AdminLayout";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ACCOUNT_TYPE_LABELS } from "@/lib/account-type-labels";
import { maskOrgCreditCode as maskCreditCode } from "@/lib/mask-utils";
import type { ApiPublicOrgEvent } from "@/lib/org-public-service";
import type { OrgProfileData } from "@/lib/org-profile-types";
import { cn } from "@/lib/utils";

type ProfileForm = {
  slug: string;
  bio: string;
  website: string;
  contactEmail: string;
  logoUrl: string | null;
  coverUrl: string | null;
};

async function fetchPublicPreview(slug: string) {
  const res = await fetch(`/api/org/${encodeURIComponent(slug)}`);
  if (!res.ok) return null;
  return (await res.json()).data as {
    upcomingEvents: ApiPublicOrgEvent[];
    pastEvents: ApiPublicOrgEvent[];
    org: { event_count: number };
  };
}

async function fetchProfile() {
  const res = await fetch("/api/org/profile");
  if (!res.ok) throw new Error("加载失败");
  return (await res.json()).data as OrgProfileData;
}

async function uploadImage(file: File) {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/upload", { method: "POST", body: form });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error ?? "上传失败");
  }
  return (await res.json()).data.url as string;
}

async function patchProfile(body: Record<string, unknown>) {
  const res = await fetch("/api/org/profile", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error ?? "保存失败");
  }
  return (await res.json()).data as OrgProfileData;
}

async function checkSlug(slug: string) {
  const res = await fetch(
    `/api/org/check-slug?slug=${encodeURIComponent(slug)}`,
  );
  if (!res.ok) return { available: false, slug, reason: "校验失败" };
  return (await res.json()).data as {
    available: boolean;
    slug: string;
    reason: string | null;
  };
}

function profileToForm(profile: OrgProfileData): ProfileForm {
  return {
    slug: profile.slug,
    bio: profile.bio ?? "",
    website: profile.website ?? "",
    contactEmail: profile.contactEmail ?? "",
    logoUrl: profile.logoUrl,
    coverUrl: profile.coverUrl,
  };
}

function formToPayload(form: ProfileForm) {
  return {
    slug: form.slug,
    bio: form.bio || null,
    website: form.website || null,
    contact_email: form.contactEmail || null,
    logo_url: form.logoUrl,
    cover_url: form.coverUrl,
  };
}

export function OrgProfilePageClient() {
  const queryClient = useQueryClient();
  const { data: profile, isLoading } = useQuery({
    queryKey: ["org-profile"],
    queryFn: fetchProfile,
  });

  const [form, setForm] = useState<ProfileForm | null>(null);
  const [originalSlug, setOriginalSlug] = useState("");
  const [slugStatus, setSlugStatus] = useState<
    "idle" | "checking" | "available" | "taken" | "invalid"
  >("idle");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">(
    "idle",
  );
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [previewTab, setPreviewTab] = useState<"upcoming" | "past">("upcoming");
  const [manualSaving, setManualSaving] = useState(false);

  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const slugCheckTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipAutoSave = useRef(true);

  const previewSlug = form?.slug || profile?.slug;
  const { data: previewData } = useQuery({
    queryKey: ["org-profile-preview", previewSlug],
    queryFn: () => fetchPublicPreview(previewSlug!),
    enabled: Boolean(previewSlug),
  });

  useEffect(() => {
    if (profile && !form) {
      setForm(profileToForm(profile));
      setOriginalSlug(profile.slug);
      skipAutoSave.current = true;
    }
  }, [profile, form]);

  const canSaveSlug =
    form?.slug === originalSlug ||
    slugStatus === "available" ||
    slugStatus === "idle";

  const saveProfile = useCallback(
    async (nextForm: ProfileForm, silent = false) => {
      if (!canSaveSlug && nextForm.slug !== originalSlug) {
        if (!silent) toast.error("主页链接不可用，请修改后再保存");
        return false;
      }

      setSaveStatus("saving");
      try {
        const updated = await patchProfile(formToPayload(nextForm));
        queryClient.setQueryData(["org-profile"], updated);
        void queryClient.invalidateQueries({
          queryKey: ["org-profile-preview"],
        });
        setOriginalSlug(updated.slug);
        setSaveStatus("saved");
        if (!silent) toast.success("已保存");
        return true;
      } catch (err) {
        setSaveStatus("idle");
        toast.error(err instanceof Error ? err.message : "保存失败");
        return false;
      }
    },
    [canSaveSlug, originalSlug, queryClient],
  );

  useEffect(() => {
    if (!form || skipAutoSave.current) {
      skipAutoSave.current = false;
      return;
    }

    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      void saveProfile(form, true);
    }, 1000);

    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, [form, saveProfile]);

  useEffect(() => {
    if (!form) return;

    if (form.slug === originalSlug) {
      setSlugStatus("idle");
      return;
    }

    if (slugCheckTimer.current) clearTimeout(slugCheckTimer.current);
    setSlugStatus("checking");

    slugCheckTimer.current = setTimeout(async () => {
      const result = await checkSlug(form.slug);
      if (result.reason && result.reason !== "已被使用") {
        setSlugStatus("invalid");
      } else if (result.available) {
        setSlugStatus("available");
        if ("slug" in result && result.slug) {
          setForm((prev) => (prev ? { ...prev, slug: result.slug } : prev));
        }
      } else {
        setSlugStatus("taken");
      }
    }, 800);

    return () => {
      if (slugCheckTimer.current) clearTimeout(slugCheckTimer.current);
    };
  }, [form?.slug, originalSlug]);

  function updateField<K extends keyof ProfileForm>(
    key: K,
    value: ProfileForm[K],
  ) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
    setSaveStatus("idle");
  }

  async function handleImageUpload(
    file: File,
    field: "coverUrl" | "logoUrl",
  ) {
    const setUploading = field === "coverUrl" ? setUploadingCover : setUploadingLogo;
    setUploading(true);
    try {
      const url = await uploadImage(file);
      updateField(field, url);
      toast.success("上传成功");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "上传失败");
    } finally {
      setUploading(false);
    }
  }

  async function handleManualSave() {
    if (!form) return;
    setManualSaving(true);
    await saveProfile(form, false);
    setManualSaving(false);
  }

  if (isLoading || !profile || !form) {
    return (
      <AdminPageBody>
        <div className="flex min-h-[320px] items-center justify-center text-sm text-text-muted">
          <Loader2 className="mr-2 size-4 animate-spin" />
          加载组织信息...
        </div>
      </AdminPageBody>
    );
  }

  const previewProfile = { ...profile, ...form };

  return (
    <AdminPageBody>
      <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
        {/* 左侧编辑区 */}
        <div className="min-w-0 flex-1 space-y-6">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold">主办方信誉展示页</h1>
              <p className="mt-1 text-sm text-text-muted">
                配置对外展示的名称、简介、Logo 与活动列表。客户关系请通过现场线索同步至
                MarketUP CRM。
              </p>
            </div>
            <a
              href={`/org/${form.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-8 items-center gap-1 rounded-lg border border-border-light bg-white px-3 text-sm font-medium hover:bg-content"
            >
              预览主页
              <ExternalLink className="size-3.5" />
            </a>
          </div>

          {/* Section 1 Logo 与封面 */}
          <section className="space-y-3">
            <h2 className="text-sm font-semibold">品牌展示</h2>
            <div className="space-y-5 rounded-2xl border border-border-light bg-white p-6">
              <div className="space-y-2">
                <Label>封面图</Label>
                <label className="relative block h-32 w-full cursor-pointer overflow-hidden rounded-xl border-2 border-dashed border-border-light bg-content">
                  {form.coverUrl ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={form.coverUrl}
                        alt="封面"
                        className="size-full object-cover"
                      />
                      <span className="absolute right-2 top-2 rounded-lg bg-black/50 px-2 py-1 text-xs text-white">
                        {uploadingCover ? "上传中..." : "点击替换"}
                      </span>
                    </>
                  ) : (
                    <span className="flex size-full flex-col items-center justify-center gap-2 text-text-muted">
                      {uploadingCover ? (
                        <Loader2 className="size-6 animate-spin" />
                      ) : (
                        <ImageIcon className="size-8 text-text-muted/60" />
                      )}
                      <span className="text-xs">
                        点击上传封面图（推荐 1440×400px）
                      </span>
                    </span>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={uploadingCover}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void handleImageUpload(file, "coverUrl");
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>

              <div className="space-y-2">
                <Label>Logo</Label>
                <label className="relative inline-flex size-20 cursor-pointer items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-border-light bg-content">
                  {form.logoUrl ? (
                    <Avatar className="size-20">
                      <AvatarImage src={form.logoUrl} alt="Logo" />
                      <AvatarFallback>{profile.name.slice(0, 1)}</AvatarFallback>
                    </Avatar>
                  ) : uploadingLogo ? (
                    <Loader2 className="size-5 animate-spin text-text-muted" />
                  ) : (
                    <Camera className="size-6 text-text-muted/60" />
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={uploadingLogo}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void handleImageUpload(file, "logoUrl");
                      e.target.value = "";
                    }}
                  />
                </label>
                <p className="text-xs text-text-muted">
                  建议 200×200px，PNG 格式
                </p>
              </div>
            </div>
          </section>

          {/* Section 2 名称 / 简介 / 链接 */}
          <section className="space-y-3">
            <h2 className="text-sm font-semibold">基本信息</h2>
            <div className="space-y-4 rounded-2xl border border-border-light bg-white p-6">
              <div className="space-y-1">
                <Label>组织名称</Label>
                <Input
                  value={profile.name}
                  disabled
                  className="bg-content text-text-muted"
                />
                <p className="text-xs text-text-muted">
                  如需修改组织名称，请联系平台客服
                </p>
              </div>

              <div className="space-y-1">
                <Label>主页链接</Label>
                <div className="flex items-center">
                  <span className="flex h-10 shrink-0 items-center rounded-l-lg border border-r-0 border-border-light bg-content px-3 text-sm text-text-muted">
                    app.connectiq.cn/org/
                  </span>
                  <Input
                    value={form.slug}
                    onChange={(e) => updateField("slug", e.target.value)}
                    className="h-10 flex-1 rounded-l-none rounded-r-lg border-l-0"
                  />
                </div>
                {slugStatus === "checking" && (
                  <p className="text-xs text-text-muted">校验中...</p>
                )}
                {slugStatus === "available" && (
                  <p className="text-xs text-brand-green">✓ 可用</p>
                )}
                {slugStatus === "taken" && (
                  <p className="text-xs text-brand-red">✕ 已被使用</p>
                )}
                {slugStatus === "invalid" && (
                  <p className="text-xs text-brand-red">
                    ✕ 格式不正确（小写字母、数字、连字符）
                  </p>
                )}
              </div>

              <div className="relative space-y-1">
                <Label>简介</Label>
                <Textarea
                  value={form.bio}
                  onChange={(e) =>
                    updateField("bio", e.target.value.slice(0, 300))
                  }
                  placeholder="一句话介绍你的组织（展示在主页和活动列表）"
                  className="min-h-[100px] resize-none pb-6"
                />
                <span className="absolute bottom-2 right-3 text-xs text-text-muted">
                  {form.bio.length}/300
                </span>
              </div>

              <div className="space-y-1">
                <Label>官网</Label>
                <Input
                  type="url"
                  value={form.website}
                  onChange={(e) => updateField("website", e.target.value)}
                  placeholder="https://..."
                />
              </div>

              <div className="space-y-1">
                <Label>联系邮箱</Label>
                <Input
                  type="email"
                  value={form.contactEmail}
                  onChange={(e) => updateField("contactEmail", e.target.value)}
                  placeholder="contact@example.com"
                />
              </div>
            </div>
          </section>

          {/* Section 3 认证信息 */}
          <section className="space-y-3">
            <h2 className="text-sm font-semibold">认证信息（只读）</h2>
            <div className="rounded-2xl border border-border-light bg-white p-6">
              {profile.isVerified ? (
                <p className="flex items-center gap-2 font-medium text-brand-green">
                  <ShieldCheck className="size-5 text-brand-green" />
                  ✓ 已通过平台认证
                </p>
              ) : (
                <p className="text-sm text-text-muted">尚未通过平台认证</p>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <AccountTypeBadge type={profile.accountType} />
                <span className="font-mono text-sm text-text-muted">
                  {maskCreditCode(profile.orgCreditCode)}
                </span>
              </div>
            </div>
          </section>

          {/* 保存 */}
          <div className="flex items-center gap-4 pb-8">
            <Button
              className="h-11 bg-brand-blue px-8 text-white hover:bg-brand-blue/90"
              onClick={() => void handleManualSave()}
              disabled={manualSaving || !canSaveSlug}
            >
              {manualSaving ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  保存中...
                </>
              ) : (
                "保存更改"
              )}
            </Button>
            <span className="text-xs text-text-muted">
              {saveStatus === "saving" && "保存中..."}
              {saveStatus === "saved" && "自动保存 ✓"}
              {saveStatus === "idle" && "修改后将自动保存"}
            </span>
          </div>
        </div>

        {/* 右侧预览 */}
        <aside className="sticky top-6 w-full shrink-0 lg:w-[340px]">
          <p className="mb-3 text-xs uppercase tracking-wide text-text-muted">
            移动端主页预览
          </p>
          <OrgProfilePreview
            profile={previewProfile}
            tab={previewTab}
            onTabChange={setPreviewTab}
            upcomingEvents={previewData?.upcomingEvents ?? []}
            pastEvents={previewData?.pastEvents ?? []}
            eventCount={
              previewData?.org.event_count ?? previewProfile.eventCount
            }
          />
        </aside>
      </div>
    </AdminPageBody>
  );
}

function AccountTypeBadge({ type }: { type: AccountType | null }) {
  const label = type ? ACCOUNT_TYPE_LABELS[type] : ACCOUNT_TYPE_LABELS.ORGANIZATION;
  return (
    <span className="inline-flex rounded-full bg-brand-blue-light px-2.5 py-0.5 text-xs font-medium text-brand-blue">
      {label}
    </span>
  );
}

function OrgProfilePreview({
  profile,
  tab,
  onTabChange,
  upcomingEvents,
  pastEvents,
  eventCount,
}: {
  profile: Omit<OrgProfileData, "foundedYear"> & ProfileForm;
  tab: "upcoming" | "past";
  onTabChange: (tab: "upcoming" | "past") => void;
  upcomingEvents: ApiPublicOrgEvent[];
  pastEvents: ApiPublicOrgEvent[];
  eventCount: number;
}) {
  const events = tab === "upcoming" ? upcomingEvents : pastEvents;

  return (
    <div className="mx-auto w-[220px] overflow-hidden rounded-3xl border-4 border-gray-800 bg-white">
      <div
        className="origin-top scale-[0.6]"
        style={{ width: 367, marginBottom: "-45%" }}
      >
        <div className="w-[367px] bg-white pb-6">
          <div className="relative h-40 w-full bg-content">
            {profile.coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.coverUrl}
                alt=""
                className="size-full object-cover"
              />
            ) : null}
          </div>

          <div className="relative z-10 -mt-8 ml-4">
            <Avatar className="size-16 border-[3px] border-white">
              {profile.logoUrl ? (
                <AvatarImage src={profile.logoUrl} alt={profile.name} />
              ) : null}
              <AvatarFallback className="text-lg">
                {profile.name.slice(0, 1)}
              </AvatarFallback>
            </Avatar>
          </div>

          <div className="mt-2 px-4">
            <div className="flex items-center gap-1">
              <h3 className="text-lg font-bold">{profile.name}</h3>
              {profile.isVerified && (
                <span className="text-xs text-brand-blue">✓</span>
              )}
            </div>
            {profile.bio ? (
              <p className="mt-1 line-clamp-2 text-xs text-text-muted">
                {profile.bio}
              </p>
            ) : (
              <p className="mt-1 text-xs text-text-muted/50">暂无简介</p>
            )}
          </div>

          <div className="mt-2 px-4">
            <span className="text-xs text-text-muted">{eventCount} 场活动</span>
          </div>

          <div className="mt-4 px-4">
            <div className="flex gap-4 border-b border-border-light pb-2">
              <button
                type="button"
                className={cn(
                  "text-xs font-medium",
                  tab === "upcoming"
                    ? "border-b-2 border-brand-blue text-brand-blue"
                    : "text-text-muted",
                )}
                onClick={() => onTabChange("upcoming")}
              >
                即将举行
              </button>
              <button
                type="button"
                className={cn(
                  "text-xs font-medium",
                  tab === "past"
                    ? "border-b-2 border-brand-blue text-brand-blue"
                    : "text-text-muted",
                )}
                onClick={() => onTabChange("past")}
              >
                往期活动
              </button>
            </div>
            <div className="mt-2 max-h-28 space-y-2 overflow-hidden">
              {events.length === 0 ? (
                <p className="rounded-lg bg-content px-2 py-3 text-center text-[10px] text-text-muted">
                  {tab === "upcoming" ? "暂无即将举行的活动" : "暂无往期活动"}
                </p>
              ) : (
                events.slice(0, 2).map((event) => (
                  <div
                    key={event.id}
                    className="rounded-lg border border-border-light px-2 py-1.5"
                  >
                    <p className="line-clamp-1 text-[11px] font-medium">
                      {event.name}
                    </p>
                    <p className="text-[10px] text-text-muted">
                      {event.city || event.venue || "地点待定"}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
