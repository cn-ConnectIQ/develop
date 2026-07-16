"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  FIXED_PARTICIPANT_INVITE_SUBJECT,
  FIXED_PARTICIPANT_INVITE_TEMPLATE,
} from "@/lib/invite/message";

type InviteAutoConfigPanelProps = {
  eventId: string;
};

type AutoConfig = {
  enabled: boolean;
  autoOnBoothStaff: boolean;
  channel: "SMS" | "EMAIL" | "AUTO";
};

export function InviteAutoConfigPanel({ eventId }: InviteAutoConfigPanelProps) {
  const [config, setConfig] = useState<AutoConfig>({
    enabled: false,
    autoOnBoothStaff: false,
    channel: "AUTO",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/events/${eventId}/invite-auto-config`);
      const json = await res.json();
      if (res.status === 403) {
        setConfig({ enabled: false, autoOnBoothStaff: false, channel: "AUTO" });
        return;
      }
      if (!res.ok) throw new Error(json.message ?? "加载配置失败");
      setConfig({
        enabled: Boolean(json.data?.enabled),
        autoOnBoothStaff: Boolean(json.data?.autoOnBoothStaff),
        channel: json.data?.channel ?? "AUTO",
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "加载配置失败");
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function patch(next: Partial<AutoConfig>) {
    setSaving(true);
    const prev = config;
    const optimistic = { ...prev, ...next };
    setConfig(optimistic);
    try {
      const res = await fetch(`/api/events/${eventId}/invite-auto-config`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "保存失败");
      setConfig({
        enabled: Boolean(json.data?.enabled),
        autoOnBoothStaff: Boolean(json.data?.autoOnBoothStaff),
        channel: json.data?.channel ?? "AUTO",
      });
      toast.success("已保存自动邀请配置");
    } catch (e) {
      setConfig(prev);
      toast.error(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  const anyAuto = config.enabled || config.autoOnBoothStaff;

  return (
    <div className="space-y-4 rounded-xl border border-border-light bg-white p-5">
      <div>
        <h2 className="text-sm font-semibold text-[var(--admin-ink)]">
          自动邀请
        </h2>
        <p className="mt-1 text-xs text-text-muted">
          开启「邀请体系」后，新参会者 / 新展商工作人员可按固定模板自动邀请（文案不可修改）。展商工作人员本身已是本场参会者。
        </p>
      </div>

      <div className="flex items-center justify-between gap-4">
        <div>
          <Label htmlFor="auto-invite-enabled">新参会者自动发送邀请</Label>
          <p className="mt-0.5 text-xs text-text-muted">
            名单新建 / 导入新增且尚未邀请时生效
          </p>
        </div>
        <Switch
          id="auto-invite-enabled"
          checked={config.enabled}
          disabled={loading || saving}
          onCheckedChange={(enabled) => void patch({ enabled })}
        />
      </div>

      <div className="flex items-center justify-between gap-4">
        <div>
          <Label htmlFor="auto-invite-booth-staff">
            新展商工作人员自动发送邀请
          </Label>
          <p className="mt-0.5 text-xs text-text-muted">
            展位添加同事时自动发出入场激活邀请
          </p>
        </div>
        <Switch
          id="auto-invite-booth-staff"
          checked={config.autoOnBoothStaff}
          disabled={loading || saving}
          onCheckedChange={(autoOnBoothStaff) =>
            void patch({ autoOnBoothStaff })
          }
        />
      </div>

      <div className="space-y-1.5">
        <Label>发送渠道</Label>
        <Select
          value={config.channel}
          disabled={loading || saving || !anyAuto}
          onValueChange={(v) =>
            void patch({ channel: v as AutoConfig["channel"] })
          }
        >
          <SelectTrigger className="w-full sm:w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="AUTO">自动（优先短信，否则邮件）</SelectItem>
            <SelectItem value="SMS">仅短信</SelectItem>
            <SelectItem value="EMAIL">仅邮件</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border border-border-light bg-content/60 p-3">
        <p className="text-xs font-medium text-text-muted">固定邀请文案</p>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-[var(--admin-ink)]">
          {FIXED_PARTICIPANT_INVITE_TEMPLATE}
        </p>
        <p className="mt-3 text-xs text-text-muted">
          邮件主题：{FIXED_PARTICIPANT_INVITE_SUBJECT}
        </p>
      </div>
    </div>
  );
}
