"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { BarChart3, Bot, Bell, ClipboardList, Handshake, Send, Trophy, Users } from "lucide-react";
import { toast } from "sonner";
import { SectionCard } from "@/components/admin/admin-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useEventFeatureFlags } from "@/hooks/useEventFeatureFlags";

type ExpoSettingsPayload = {
  settings: Record<string, Record<string, unknown>>;
  staff: Array<{
    id: string;
    role: string;
    user: { id: string; name: string; phone: string | null };
  }>;
};

function getSetting<T extends Record<string, unknown>>(
  settings: Record<string, Record<string, unknown>>,
  key: string,
  defaults: T,
): T {
  const raw = settings[key];
  if (!raw || typeof raw !== "object") return defaults;
  return { ...defaults, ...(raw as T) };
}

async function fetchExpoSettings(expoId: string) {
  const res = await fetch(`/api/events/${expoId}/expo-settings`);
  if (!res.ok) throw new Error("加载配置失败");
  return (await res.json()).data as ExpoSettingsPayload;
}

export function ExpoOverviewSections({ expoId }: { expoId: string }) {
  const queryClient = useQueryClient();
  const { data: featureFlags } = useEventFeatureFlags(expoId);
  const { data } = useQuery({
    queryKey: ["expo-settings", expoId],
    queryFn: () => fetchExpoSettings(expoId),
  });

  const registration = getSetting(data?.settings ?? {}, "expo_registration", {
    enabled: true,
    deadline: "",
    require_company: true,
    notes: "",
  });
  const buyer = getSetting(data?.settings ?? {}, "expo_buyer", {
    enabled: true,
    hosted_buyer_quota: 50,
    qualification: "",
  });
  const matching = getSetting(data?.settings ?? {}, "expo_matching", {
    enabled: true,
    min_score: 70,
    auto_notify: true,
  });
  const notifications = getSetting(data?.settings ?? {}, "expo_notifications", {
    checkin_reminder: true,
    matching_digest: true,
    custom_message: "",
  });

  const [regForm, setRegForm] = useState(registration);
  const [buyerForm, setBuyerForm] = useState(buyer);
  const [matchForm, setMatchForm] = useState(matching);
  const [notifyForm, setNotifyForm] = useState(notifications);

  useEffect(() => {
    if (data) {
      setRegForm(getSetting(data.settings, "expo_registration", registration));
      setBuyerForm(getSetting(data.settings, "expo_buyer", buyer));
      setMatchForm(getSetting(data.settings, "expo_matching", matching));
      setNotifyForm(getSetting(data.settings, "expo_notifications", notifications));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  async function save(key: string, value: object) {
    const res = await fetch(`/api/events/${expoId}/expo-settings`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [key]: value }),
    });
    if (!res.ok) {
      toast.error("保存失败");
      return;
    }
    toast.success("已保存");
    void queryClient.invalidateQueries({ queryKey: ["expo-settings", expoId] });
  }

  async function sendExpoNotify() {
    const res = await fetch(`/api/events/${expoId}/participants/notify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        all: true,
        title: "展会通知",
        body: notifyForm.custom_message || "欢迎参加本次展会！",
      }),
    });
    if (!res.ok) {
      toast.error("请先在名单中选择参会者，或填写通知内容");
      return;
    }
    const json = await res.json();
    toast.success(`已发送 ${json.data.sent} 条通知`);
  }

  return (
    <div className="space-y-6">
      <SectionCard
        id="registration"
        title="展商报名配置"
        description="控制展商报名字段与截止时间"
      >
        <div className="grid max-w-xl gap-4">
          <div className="flex items-center justify-between">
            <Label>开放展商报名</Label>
            <Switch
              checked={Boolean(regForm.enabled)}
              onCheckedChange={(v) => setRegForm({ ...regForm, enabled: v })}
            />
          </div>
          <div>
            <Label>报名截止</Label>
            <Input
              type="date"
              value={String(regForm.deadline ?? "")}
              onChange={(e) =>
                setRegForm({ ...regForm, deadline: e.target.value })
              }
            />
          </div>
          <div>
            <Label>说明</Label>
            <Textarea
              value={String(regForm.notes ?? "")}
              onChange={(e) => setRegForm({ ...regForm, notes: e.target.value })}
            />
          </div>
          <Button
            className="w-fit bg-brand-blue text-white"
            onClick={() => void save("expo_registration", regForm)}
          >
            保存展商配置
          </Button>
        </div>
      </SectionCard>

      <SectionCard
        id="buyer"
        title="买家报名配置"
        description="Hosted Buyer 配额与资质要求"
      >
        <div className="grid max-w-xl gap-4">
          <div className="flex items-center justify-between">
            <Label>开放买家报名</Label>
            <Switch
              checked={Boolean(buyerForm.enabled)}
              onCheckedChange={(v) => setBuyerForm({ ...buyerForm, enabled: v })}
            />
          </div>
          <div>
            <Label>Hosted Buyer 配额</Label>
            <Input
              type="number"
              value={Number(buyerForm.hosted_buyer_quota ?? 50)}
              onChange={(e) =>
                setBuyerForm({
                  ...buyerForm,
                  hosted_buyer_quota: Number(e.target.value),
                })
              }
            />
          </div>
          <div>
            <Label>资质要求</Label>
            <Textarea
              value={String(buyerForm.qualification ?? "")}
              onChange={(e) =>
                setBuyerForm({ ...buyerForm, qualification: e.target.value })
              }
            />
          </div>
          <Button
            className="w-fit bg-brand-blue text-white"
            onClick={() => void save("expo_buyer", buyerForm)}
          >
            保存买家配置
          </Button>
        </div>
      </SectionCard>

      <SectionCard id="staff" title="工作人员" description="组织内负责本场展会的成员">
        <div className="space-y-2">
          {(data?.staff ?? []).length === 0 ? (
            <p className="text-sm text-text-muted">暂无工作人员，请在组织设置中添加</p>
          ) : (
            data?.staff.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between rounded-lg border border-border-light px-4 py-3"
              >
                <div>
                  <p className="font-medium">{s.user.name}</p>
                  <p className="text-xs text-text-muted">{s.user.phone ?? "—"}</p>
                </div>
                <span className="text-xs text-text-muted">{s.role}</span>
              </div>
            ))
          )}
        </div>
      </SectionCard>

      <SectionCard
        id="notifications"
        title="通知发送"
        description="向参会者推送展会通知"
      >
        <div className="grid max-w-xl gap-4">
          <div className="flex items-center justify-between">
            <Label>签到提醒</Label>
            <Switch
              checked={Boolean(notifyForm.checkin_reminder)}
              onCheckedChange={(v) =>
                setNotifyForm({ ...notifyForm, checkin_reminder: v })
              }
            />
          </div>
          <div>
            <Label>自定义通知内容</Label>
            <Textarea
              value={String(notifyForm.custom_message ?? "")}
              onChange={(e) =>
                setNotifyForm({ ...notifyForm, custom_message: e.target.value })
              }
              placeholder="输入后将可用于批量通知..."
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => void save("expo_notifications", notifyForm)}
            >
              保存通知设置
            </Button>
            <Button
              className="bg-brand-purple text-white"
              onClick={() => void sendExpoNotify()}
            >
              <Send className="mr-1 size-4" />
              发送测试通知
            </Button>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        id="matching"
        title="买卖撮合配置"
        description="AI 撮合阈值与自动通知"
      >
        <div className="grid max-w-xl gap-4">
          <div className="flex items-center justify-between">
            <Label>启用 AI 撮合</Label>
            <Switch
              checked={Boolean(matchForm.enabled)}
              onCheckedChange={(v) => setMatchForm({ ...matchForm, enabled: v })}
            />
          </div>
          <div>
            <Label>最低匹配分（0-100）</Label>
            <Input
              type="number"
              min={0}
              max={100}
              value={Number(matchForm.min_score ?? 70)}
              onChange={(e) =>
                setMatchForm({ ...matchForm, min_score: Number(e.target.value) })
              }
            />
          </div>
          <Button
            className="w-fit bg-brand-blue text-white"
            onClick={() => void save("expo_matching", matchForm)}
          >
            保存撮合配置
          </Button>
        </div>
      </SectionCard>

      {featureFlags?.aiReferral && (
        <SectionCard
          id="matching-preview"
          title="AI 引荐配置"
          description="查看 AI 引荐扫描结果与手动触发"
        >
          <div className="flex flex-wrap gap-3">
            <Link
              href={`/events/${expoId}/ai-referral`}
              className="inline-flex h-9 items-center rounded-lg border border-border-light px-4 text-sm hover:bg-content"
            >
              <Bot className="mr-1 size-4" />
              打开 AI 引荐配置
            </Link>
            <Link
              href={`/events/${expoId}/reports#matching`}
              className="inline-flex h-9 items-center rounded-lg border border-border-light px-4 text-sm hover:bg-content"
            >
              查看配对报告
            </Link>
          </div>
        </SectionCard>
      )}

      {featureFlags?.highValueBuyerPush && (
        <SectionCard
          id="buyer-push"
          title="高价值买家推送"
          description="买家留资或多次扫码时，向展商推送 A/B 级意向提醒"
        >
          <Link
            href={`/events/${expoId}/high-value-buyer-push`}
            className="inline-flex h-9 items-center rounded-lg bg-brand-amber/15 px-4 text-sm font-medium text-brand-amber hover:bg-brand-amber/25"
          >
            <Bell className="mr-1 size-4" />
            查看推送规则
          </Link>
        </SectionCard>
      )}

      {featureFlags?.aiBoothRoute && (
        <SectionCard
          id="booth-route"
          title="AI 展位路线"
          description="为参会者生成个性化逛展路线"
        >
          <Link
            href={`/events/${expoId}/booth-route`}
            className="inline-flex h-9 items-center rounded-lg border border-border-light px-4 text-sm hover:bg-content"
          >
            <Bot className="mr-1 size-4" />
            预览展位路线
          </Link>
        </SectionCard>
      )}

      {featureFlags?.stampRally && (
        <SectionCard
          id="stamp-rally"
          title="集章打卡（AI-04）"
          description="配置展位集章路线，参会者扫码集章后可兑换奖励"
        >
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href={`/events/${expoId}/stamp-rally`}
              className="inline-flex h-9 items-center rounded-lg bg-brand-gold/15 px-4 text-sm font-medium text-brand-gold hover:bg-brand-gold/25"
            >
              <Trophy className="mr-1 size-4" />
              集章路线配置
            </Link>
            <span className="text-xs text-text-muted">
              在「功能模块」中关闭后将隐藏此入口
            </span>
          </div>
        </SectionCard>
      )}

      {featureFlags?.boothRanking && (
        <SectionCard
          id="booth-ranking"
          title="展位人气榜（AI-03）"
          description="实时展位访问与线索热度排行，可投放至互动大屏"
        >
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href={`/events/${expoId}/booth-ranking`}
              className="inline-flex h-9 items-center rounded-lg bg-brand-purple/10 px-4 text-sm font-medium text-brand-purple hover:bg-brand-purple/20"
            >
              <BarChart3 className="mr-1 size-4" />
              查看人气排行
            </Link>
            <Link
              href={`/events/${expoId}/interactions/bigscreen?tab=booth_ranking`}
              target="_blank"
              className="inline-flex h-9 items-center rounded-lg border border-border-light px-4 text-sm hover:bg-content"
            >
              大屏投放
            </Link>
          </div>
        </SectionCard>
      )}

      <SectionCard
        id="lead-form"
        title="采集表单配置"
        description="为展位线索采集配置动态字段与条件规则"
      >
        <Link
          href={`/events/${expoId}/exhibitors/form-config`}
          className="inline-flex h-9 items-center rounded-lg border border-border-light px-4 text-sm hover:bg-content"
        >
          <ClipboardList className="mr-1 size-4" />
          打开表单配置器
        </Link>
      </SectionCard>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { href: `/events/${expoId}/exhibitors/booths`, icon: ClipboardList, label: "展位管理" },
          { href: `/events/${expoId}/exhibitors/form-config`, icon: ClipboardList, label: "采集表单" },
          ...(featureFlags?.speedNetworking
            ? [{ href: `/events/${expoId}/speed-networking`, icon: Handshake, label: "Speed Networking" }]
            : []),
          ...(featureFlags?.aiReferral
            ? [{ href: `/events/${expoId}/ai-referral`, icon: Bot, label: "AI 引荐" }]
            : []),
          ...(featureFlags?.stampRally
            ? [{ href: `/events/${expoId}/stamp-rally`, icon: Trophy, label: "集章打卡" }]
            : []),
          ...(featureFlags?.boothRanking
            ? [{ href: `/events/${expoId}/booth-ranking`, icon: BarChart3, label: "展位人气榜" }]
            : []),
          ...(featureFlags?.aiBoothRoute
            ? [{ href: `/events/${expoId}/booth-route`, icon: Bot, label: "AI 展位路线" }]
            : []),
          ...(featureFlags?.highValueBuyerPush
            ? [{ href: `/events/${expoId}/high-value-buyer-push`, icon: Bell, label: "买家推送" }]
            : []),
          { href: `/events/${expoId}/interactions/bigscreen`, icon: Bot, label: "互动大屏" },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="admin-qtile flex items-center gap-2 bg-white p-4"
          >
            <item.icon className="size-5 text-brand-blue" />
            <span className="text-sm font-medium">{item.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
