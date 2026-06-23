"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { Bot, Bell, ClipboardList, Send, Users } from "lucide-react";
import { toast } from "sonner";
import { SectionCard } from "@/components/admin/admin-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

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

      <SectionCard
        id="matching-preview"
        title="撮合预览"
        description="查看 AI 引荐扫描结果"
      >
        <div className="flex flex-wrap gap-3">
          <Link
            href={`/events/${expoId}`}
            className="inline-flex h-9 items-center rounded-lg border border-border-light px-4 text-sm hover:bg-content"
          >
            <Bot className="mr-1 size-4" />
            打开活动工作台 AI 扫描
          </Link>
          <Link
            href={`/events/${expoId}/reports#matching`}
            className="inline-flex h-9 items-center rounded-lg border border-border-light px-4 text-sm hover:bg-content"
          >
            查看配对报告
          </Link>
        </div>
      </SectionCard>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { href: `/expos/${expoId}/booths`, icon: ClipboardList, label: "展位管理" },
          { href: `/expos/${expoId}/leads`, icon: Users, label: "线索管理" },
          { href: `/events/${expoId}/stamp-rally`, icon: Bell, label: "集章打卡" },
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
