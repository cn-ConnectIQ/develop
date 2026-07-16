"use client";

import { useEffect, useMemo, useState } from "react";
import {
  InviteChannel,
  ParticipantInviteStatus,
  ParticipantRole,
} from "@/lib/invite/enums";
import { Mail, MessageCircle, Phone } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessagePreview } from "@/components/invites/MessagePreview";
import {
  useCreateInviteCampaign,
  useSendInviteCampaign,
} from "@/hooks/useInviteCampaigns";
import { toastInviteSendError } from "@/lib/invite/invite-credit-toast";
import {
  FIXED_PARTICIPANT_INVITE_SUBJECT,
  FIXED_PARTICIPANT_INVITE_TEMPLATE,
  formatEventDate,
} from "@/lib/invite/message";
import { cn } from "@/lib/utils";

type TargetMode = "all" | "not_invited" | "custom" | "import";

type ImportContactRow = {
  name?: string;
  phone?: string;
  email?: string;
  company?: string;
};

export type CreateCampaignCloneFrom = {
  name: string;
  channel: InviteChannel;
  customMessage: string;
  subject?: string | null;
  templateId?: string | null;
  targetFilter?: unknown;
};

export type CreateCampaignFormProps = {
  eventId: string;
  eventName: string;
  eventDate: string;
  organizerName: string;
  stats: {
    total: number;
    notInvited: number;
    activated: number;
  };
  ticketTypes: Array<{ id: string; name: string }>;
  initialParticipantIds?: string[];
  cloneFrom?: CreateCampaignCloneFrom;
  onSuccess?: () => void;
};

const CHANNELS: Array<{
  id: InviteChannel;
  label: string;
  icon: typeof Phone;
  iconClass: string;
  hint: string;
}> = [
  {
    id: InviteChannel.SMS,
    label: "短信",
    icon: Phone,
    iconClass: "text-brand-blue bg-brand-blue-light",
    hint: "发送到手机号 · 覆盖最广",
  },
  {
    id: InviteChannel.EMAIL,
    label: "邮件",
    icon: Mail,
    iconClass: "text-brand-green bg-brand-green-light",
    hint: "发送 HTML 邮件 · 内容最丰富",
  },
  {
    id: InviteChannel.WECHAT,
    label: "微信模板",
    icon: MessageCircle,
    iconClass: "text-brand-green bg-brand-green-light",
    hint: "发送微信模板消息 · 打开率最高",
  },
];

export function CreateCampaignForm({
  eventId,
  eventName,
  eventDate,
  organizerName,
  stats,
  ticketTypes,
  initialParticipantIds,
  cloneFrom,
  onSuccess,
}: CreateCampaignFormProps) {
  const [name, setName] = useState("");
  const [channel, setChannel] = useState<InviteChannel>(InviteChannel.SMS);
  const [templateId, setTemplateId] = useState("");
  const message = FIXED_PARTICIPANT_INVITE_TEMPLATE;
  const subject = FIXED_PARTICIPANT_INVITE_SUBJECT;
  const [targetMode, setTargetMode] = useState<TargetMode>(
    initialParticipantIds?.length ? "custom" : "not_invited",
  );
  const [selectedTicketTypes, setSelectedTicketTypes] = useState<string[]>([]);
  const [selectedRoles, setSelectedRoles] = useState<ParticipantRole[]>([]);
  const [excludeActivated, setExcludeActivated] = useState(true);
  const [excludeNoContact, setExcludeNoContact] = useState(true);
  const [sendMode, setSendMode] = useState<"now" | "scheduled">("now");
  const [scheduledAt, setScheduledAt] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [previewChannel, setPreviewChannel] = useState<InviteChannel>(
    InviteChannel.SMS,
  );
  const [importContacts, setImportContacts] = useState<ImportContactRow[]>([]);
  const [tagFilterText, setTagFilterText] = useState("");

  const createMutation = useCreateInviteCampaign(eventId);
  const sendMutation = useSendInviteCampaign(eventId);

  async function handleImportFile(file: File | null) {
    if (!file) return;
    try {
      const XLSX = await import("xlsx");
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]!];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
        defval: "",
      });
      const mapped: ImportContactRow[] = rows
        .map((row) => {
          const get = (...keys: string[]) => {
            for (const k of keys) {
              const hit = Object.entries(row).find(
                ([key]) => key.trim().toLowerCase() === k.toLowerCase(),
              );
              if (hit && String(hit[1]).trim()) return String(hit[1]).trim();
            }
            return undefined;
          };
          return {
            name: get("name", "姓名", "名字"),
            phone: get("phone", "mobile", "手机", "手机号", "电话"),
            email: get("email", "邮箱", "邮件"),
            company: get("company", "公司", "单位"),
          };
        })
        .filter((r) => r.phone || r.email);
      setImportContacts(mapped);
      setTargetMode("import");
      toast.success(`已解析 ${mapped.length} 条联系人`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Excel 解析失败");
    }
  }

  useEffect(() => {
    if (initialParticipantIds?.length) {
      setTargetMode("custom");
    }
  }, [initialParticipantIds]);

  useEffect(() => {
    if (!cloneFrom) return;
    setName(`${cloneFrom.name} · 第二轮`);
    setChannel(cloneFrom.channel);
    setTemplateId(cloneFrom.templateId ?? "");
    setPreviewChannel(cloneFrom.channel);
    setTargetMode("not_invited");
    setSendMode("now");
  }, [cloneFrom]);

  const estimatedCount = useMemo(() => {
    if (importContacts.length) return importContacts.length;
    if (initialParticipantIds?.length) return initialParticipantIds.length;
    if (targetMode === "not_invited") return stats.notInvited;
    if (targetMode === "all") {
      return excludeActivated
        ? Math.max(stats.total - stats.activated, 0)
        : stats.total;
    }
    return Math.max(
      excludeActivated ? stats.total - stats.activated : stats.total,
      0,
    );
  }, [
    importContacts.length,
    initialParticipantIds,
    targetMode,
    stats,
    excludeActivated,
  ]);

  const previewContext = {
    name: "张三",
    eventName,
    eventDate,
    link: "https://app.connectiq.cn/join?token=preview",
    organizer: organizerName,
    location: "活动现场",
  };

  function parseTagFilter() {
    return tagFilterText
      .split(/[,，]/)
      .map((t) => t.trim())
      .filter(Boolean);
  }

  function buildTargetFilter() {
    const tags = parseTagFilter();
    if (targetMode === "import" || importContacts.length) {
      return {
        import_contacts: importContacts,
        exclude_activated: excludeActivated,
      };
    }
    if (initialParticipantIds?.length) {
      return {
        participant_ids: initialParticipantIds,
        exclude_activated: excludeActivated,
      };
    }
    if (targetMode === "all") {
      return {
        exclude_activated: excludeActivated,
        ...(tags.length ? { tags } : {}),
      };
    }
    if (targetMode === "not_invited") {
      return {
        invite_status: [ParticipantInviteStatus.NOT_INVITED],
        exclude_activated: excludeActivated,
        ...(tags.length ? { tags } : {}),
      };
    }
    return {
      ...(selectedTicketTypes.length
        ? { ticket_types: selectedTicketTypes }
        : {}),
      ...(selectedRoles.length ? { roles: selectedRoles } : {}),
      ...(tags.length ? { tags } : {}),
      exclude_activated: excludeActivated,
    };
  }

  async function handleSaveDraft() {
    try {
      await createMutation.mutateAsync({
        name: name || "未命名邀请活动",
        channel,
        template_id: templateId || undefined,
        subject,
        custom_message: message,
        target_filter: buildTargetFilter(),
        scheduled_at:
          sendMode === "scheduled" && scheduledAt
            ? new Date(scheduledAt).toISOString()
            : null,
      });
      toast.success("草稿已保存");
      onSuccess?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "保存失败");
    }
  }

  async function handleConfirmSend() {
    setConfirmOpen(false);
    try {
      const campaign = await createMutation.mutateAsync({
        name: name || "未命名邀请活动",
        channel,
        template_id: templateId || undefined,
        subject,
        custom_message: message,
        target_filter: buildTargetFilter(),
        scheduled_at:
          sendMode === "scheduled" && scheduledAt
            ? new Date(scheduledAt).toISOString()
            : null,
      });
      if (sendMode === "now") {
        const sendResult = await sendMutation.mutateAsync(campaign.id);
        if (
          sendResult &&
          typeof sendResult === "object" &&
          "building" in sendResult &&
          (sendResult as { building?: boolean }).building
        ) {
          toast.success("正在后台准备收件人，准备完成后将自动发送");
        } else {
          toast.success(`已向约 ${estimatedCount} 位参会者发起邀请`);
        }
      } else {
        toast.success("定时发送已安排");
      }
      onSuccess?.();
    } catch (e) {
      toastInviteSendError(e, "发送失败");
    }
  }

  const isSubmitting = createMutation.isPending || sendMutation.isPending;

  return (
    <>
      <div className="mx-auto max-w-3xl space-y-8 pb-28">
        <section className="space-y-4 rounded-xl border border-border-light bg-white p-6">
          <h4 className="text-sm font-semibold">活动基本设置</h4>
          <div className="space-y-2">
            <Label htmlFor="campaign-name">邀请活动名称</Label>
            <Input
              id="campaign-name"
              placeholder="首次邀请 · 活动前 7 天"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>发送渠道</Label>
            <div className="grid gap-2">
              {CHANNELS.map((ch) => {
                const Icon = ch.icon;
                const selected = channel === ch.id;
                return (
                  <button
                    key={ch.id}
                    type="button"
                    className={cn(
                      "flex items-start gap-3 rounded-xl border p-3 text-left transition-colors",
                      selected
                        ? "border-brand-purple bg-brand-purple-light/30"
                        : "border-border-light hover:border-brand-purple/40",
                    )}
                    onClick={() => {
                      setChannel(ch.id);
                      setPreviewChannel(ch.id);
                    }}
                  >
                    <span
                      className={cn(
                        "flex size-9 shrink-0 items-center justify-center rounded-lg",
                        ch.iconClass,
                      )}
                    >
                      <Icon className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{ch.label}</p>
                      <p className="text-xs text-text-muted">{ch.hint}</p>
                      {selected && ch.id === InviteChannel.SMS && (
                        <Input
                          className="mt-2 h-8 text-xs"
                          placeholder="需要审核的短信模板 ID"
                          value={templateId}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => setTemplateId(e.target.value)}
                        />
                      )}
                      {selected && ch.id === InviteChannel.EMAIL && (
                        <p className="mt-2 text-xs text-text-muted">
                          邮件主题（固定）：{FIXED_PARTICIPANT_INVITE_SUBJECT}
                        </p>
                      )}
                      {selected && ch.id === InviteChannel.WECHAT && (
                        <>
                          <p className="mt-1 text-xs text-brand-amber">
                            仅适用于有微信 OpenID 的参会者
                          </p>
                          <Input
                            className="mt-2 h-8 text-xs"
                            placeholder="微信模板 ID"
                            value={templateId}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => setTemplateId(e.target.value)}
                          />
                        </>
                      )}
                    </div>
                    <span
                      className={cn(
                        "mt-1 size-4 shrink-0 rounded-full border-2",
                        selected
                          ? "border-brand-purple bg-brand-purple"
                          : "border-border-light",
                      )}
                    />
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <section className="space-y-4 rounded-xl border border-border-light bg-white p-6">
          <div>
            <h4 className="text-sm font-semibold">消息内容</h4>
            <p className="mt-1 text-xs text-text-muted">
              短信 / 邮件使用平台固定模板，不可修改
            </p>
          </div>
          <p className="whitespace-pre-wrap rounded-lg border border-border-light bg-content/60 p-3 text-sm leading-relaxed">
            {message}
          </p>

          <Tabs
            value={previewChannel}
            onValueChange={(v) => setPreviewChannel(v as InviteChannel)}
          >
            <TabsList className="h-8">
              <TabsTrigger value={InviteChannel.SMS} className="text-xs">
                短信预览
              </TabsTrigger>
              <TabsTrigger value={InviteChannel.EMAIL} className="text-xs">
                邮件预览
              </TabsTrigger>
              <TabsTrigger value={InviteChannel.WECHAT} className="text-xs">
                微信预览
              </TabsTrigger>
            </TabsList>
            <TabsContent value={InviteChannel.SMS} className="mt-3">
              <MessagePreview
                channel="SMS"
                template={message}
                context={previewContext}
              />
            </TabsContent>
            <TabsContent value={InviteChannel.EMAIL} className="mt-3">
              <MessagePreview
                channel="EMAIL"
                template={message}
                subject={subject}
                context={previewContext}
              />
            </TabsContent>
            <TabsContent value={InviteChannel.WECHAT} className="mt-3">
              <MessagePreview
                channel="WECHAT"
                template={message}
                context={previewContext}
              />
            </TabsContent>
          </Tabs>
        </section>

        <section className="space-y-4 rounded-xl border border-border-light bg-white p-6">
          <h4 className="text-sm font-semibold">发送目标</h4>
          {targetMode !== "import" && (
            <div className="space-y-2">
              <Label htmlFor="tag-filter">按标签筛选（可选）</Label>
              <Input
                id="tag-filter"
                placeholder="VIP, 媒体（逗号分隔，命中任一）"
                value={tagFilterText}
                onChange={(e) => setTagFilterText(e.target.value)}
              />
            </div>
          )}
          <div className="space-y-2">
            {(
              [
                {
                  id: "all" as const,
                  label: `所有参会者（${stats.total} 人）`,
                },
                {
                  id: "not_invited" as const,
                  label: `仅未邀请的参会者（${stats.notInvited} 人）`,
                  badge: "推荐",
                },
                {
                  id: "custom" as const,
                  label: "自定义筛选",
                },
                {
                  id: "import" as const,
                  label: importContacts.length
                    ? `Excel 导入（${importContacts.length} 人）`
                    : "Excel 导入联系人",
                },
              ] as const
            ).map((opt) => (
              <label
                key={opt.id}
                className="flex cursor-pointer items-center gap-2 text-sm"
              >
                <input
                  type="radio"
                  name="target"
                  checked={targetMode === opt.id}
                  disabled={
                    !!initialParticipantIds?.length && opt.id !== "custom"
                  }
                  onChange={() => setTargetMode(opt.id)}
                  className="accent-brand-purple"
                />
                <span>{opt.label}</span>
                {"badge" in opt && opt.badge && (
                  <Badge className="bg-brand-purple-light text-brand-purple">
                    {opt.badge}
                  </Badge>
                )}
              </label>
            ))}
          </div>

          {targetMode === "import" && (
            <div className="space-y-3 rounded-lg border border-border-light p-3">
              <div className="space-y-2">
                <Label htmlFor="invite-import-file">上传 Excel / CSV</Label>
                <Input
                  id="invite-import-file"
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="cursor-pointer text-xs"
                  onChange={(e) =>
                    void handleImportFile(e.target.files?.[0] ?? null)
                  }
                />
                <p className="text-[11px] text-text-muted">
                  表头支持：姓名/name、手机/phone、邮箱/email、公司/company
                </p>
              </div>
              {importContacts.length > 0 && (
                <p className="text-xs text-brand-green">
                  已载入 {importContacts.length} 条，发送时会自动匹配或新建参会者
                </p>
              )}
            </div>
          )}

          {targetMode === "custom" && !initialParticipantIds?.length && (
            <div className="space-y-3 rounded-lg border border-border-light p-3">
              <div>
                <p className="mb-2 text-xs font-medium text-text-muted">票种</p>
                <div className="flex flex-wrap gap-2">
                  {ticketTypes.map((tt) => (
                    <label
                      key={tt.id}
                      className="flex items-center gap-1.5 text-xs"
                    >
                      <Checkbox
                        checked={selectedTicketTypes.includes(tt.id)}
                        onCheckedChange={(checked) => {
                          setSelectedTicketTypes((prev) =>
                            checked
                              ? [...prev, tt.id]
                              : prev.filter((id) => id !== tt.id),
                          );
                        }}
                      />
                      {tt.name}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-2 text-xs font-medium text-text-muted">
                  参会者角色
                </p>
                <div className="flex flex-wrap gap-3">
                  {[
                    { id: ParticipantRole.ATTENDEE, label: "普通参会者" },
                    { id: ParticipantRole.SPEAKER, label: "演讲者" },
                  ].map((role) => (
                    <label
                      key={role.id}
                      className="flex items-center gap-1.5 text-xs"
                    >
                      <Checkbox
                        checked={selectedRoles.includes(role.id)}
                        onCheckedChange={(checked) => {
                          setSelectedRoles((prev) =>
                            checked
                              ? [...prev, role.id]
                              : prev.filter((r) => r !== role.id),
                          );
                        }}
                      />
                      {role.label}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {initialParticipantIds?.length ? (
            <p className="text-xs text-brand-purple">
              已选择 {initialParticipantIds.length} 位参会者
            </p>
          ) : null}

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={excludeActivated}
                onCheckedChange={(v) => setExcludeActivated(!!v)}
              />
              已激活用户（不重复邀请）
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={excludeNoContact}
                onCheckedChange={(v) => setExcludeNoContact(!!v)}
              />
              无对应联系方式的参会者
            </label>
          </div>

          <p className="text-sm text-brand-blue">
            预计发送人数：将发送给{" "}
            <span className="font-semibold">{estimatedCount}</span> 位参会者
          </p>
        </section>

        <section className="space-y-4 rounded-xl border border-border-light bg-white p-6">
          <h4 className="text-sm font-semibold">发送时间</h4>
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="sendTime"
                checked={sendMode === "now"}
                onChange={() => setSendMode("now")}
                className="accent-brand-purple"
              />
              立即发送
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="sendTime"
                checked={sendMode === "scheduled"}
                onChange={() => setSendMode("scheduled")}
                className="accent-brand-purple"
              />
              定时发送
            </label>
            {sendMode === "scheduled" && (
              <Input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="mt-2"
              />
            )}
          </div>
        </section>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-border-light bg-white/95 px-6 py-4 backdrop-blur-sm lg:left-[var(--sidebar-width,240px)]">
        <div className="mx-auto flex max-w-3xl gap-2">
          <Button
            variant="outline"
            disabled={isSubmitting}
            onClick={() => void handleSaveDraft()}
          >
            保存草稿
          </Button>
          <Button variant="outline" onClick={() => setPreviewChannel(channel)}>
            预览发送效果
          </Button>
          <Button
            className="ml-auto bg-brand-purple text-white hover:bg-brand-purple/90"
            disabled={isSubmitting || !message.trim()}
            onClick={() => setConfirmOpen(true)}
          >
            确认发送 → ({estimatedCount})
          </Button>
        </div>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              确认向 {estimatedCount} 位参会者发送邀请？
            </AlertDialogTitle>
            <AlertDialogDescription>
              此操作不可撤销，请确认内容无误
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-brand-purple hover:bg-brand-purple/90"
              onClick={() => void handleConfirmSend()}
            >
              确认发送
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function useEventDateLabel(startDate: string | null | undefined) {
  if (!startDate) return "日期待定";
  return formatEventDate(new Date(startDate));
}
