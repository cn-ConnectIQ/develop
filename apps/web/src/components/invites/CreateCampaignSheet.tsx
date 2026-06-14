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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  INVITE_VARIABLES,
  MessagePreview,
} from "@/components/invites/MessagePreview";
import {
  useCreateInviteCampaign,
  useSendInviteCampaign,
} from "@/hooks/useInviteCampaigns";
import { formatEventDate } from "@/lib/invite/message";
import { cn } from "@/lib/utils";

type TargetMode = "all" | "not_invited" | "custom";

type CreateCampaignSheetProps = {
  eventId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
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
  cloneFrom?: {
    name: string;
    channel: InviteChannel;
    customMessage: string;
    subject?: string | null;
    templateId?: string | null;
    targetFilter?: unknown;
  };
  onSuccess?: () => void;
};

const DEFAULT_MESSAGE =
  "{name}，您好！诚邀您参加 {event_name}（{event_date}）。点击链接下载 ConnectIQ，开启现场社交：{link}";

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

export function CreateCampaignSheet({
  eventId,
  open,
  onOpenChange,
  eventName,
  eventDate,
  organizerName,
  stats,
  ticketTypes,
  initialParticipantIds,
  cloneFrom,
  onSuccess,
}: CreateCampaignSheetProps) {
  const [name, setName] = useState("");
  const [channel, setChannel] = useState<InviteChannel>(InviteChannel.SMS);
  const [templateId, setTemplateId] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState(DEFAULT_MESSAGE);
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

  const createMutation = useCreateInviteCampaign(eventId);
  const sendMutation = useSendInviteCampaign(eventId);

  useEffect(() => {
    if (open && initialParticipantIds?.length) {
      setTargetMode("custom");
    }
  }, [open, initialParticipantIds]);

  useEffect(() => {
    if (!open || !cloneFrom) return;
    setName(`${cloneFrom.name} · 第二轮`);
    setChannel(cloneFrom.channel);
    setMessage(cloneFrom.customMessage || DEFAULT_MESSAGE);
    setSubject(cloneFrom.subject ?? "");
    setTemplateId(cloneFrom.templateId ?? "");
    setPreviewChannel(cloneFrom.channel);
    setTargetMode("not_invited");
    setSendMode("now");
  }, [open, cloneFrom]);

  const estimatedCount = useMemo(() => {
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
  };

  function buildTargetFilter() {
    if (initialParticipantIds?.length) {
      return {
        participant_ids: initialParticipantIds,
        exclude_activated: excludeActivated,
      };
    }
    if (targetMode === "all") {
      return { exclude_activated: excludeActivated };
    }
    if (targetMode === "not_invited") {
      return {
        invite_status: [ParticipantInviteStatus.NOT_INVITED],
        exclude_activated: excludeActivated,
      };
    }
    return {
      ...(selectedTicketTypes.length
        ? { ticket_types: selectedTicketTypes }
        : {}),
      ...(selectedRoles.length ? { roles: selectedRoles } : {}),
      exclude_activated: excludeActivated,
    };
  }

  async function handleSaveDraft() {
    try {
      await createMutation.mutateAsync({
        name: name || "未命名邀请活动",
        channel,
        template_id: templateId || undefined,
        subject: subject || undefined,
        custom_message: message,
        target_filter: buildTargetFilter(),
        scheduled_at:
          sendMode === "scheduled" && scheduledAt
            ? new Date(scheduledAt).toISOString()
            : null,
      });
      toast.success("草稿已保存");
      onOpenChange(false);
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
        subject: subject || undefined,
        custom_message: message,
        target_filter: buildTargetFilter(),
        scheduled_at:
          sendMode === "scheduled" && scheduledAt
            ? new Date(scheduledAt).toISOString()
            : null,
      });
      if (sendMode === "now") {
        await sendMutation.mutateAsync(campaign.id);
        toast.success(`已向 ${estimatedCount} 位参会者发送邀请`);
      } else {
        toast.success("定时发送已安排");
      }
      onOpenChange(false);
      onSuccess?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "发送失败");
    }
  }

  function insertVariable(key: string) {
    setMessage((prev) => `${prev}${key}`);
  }

  const isSubmitting = createMutation.isPending || sendMutation.isPending;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="flex w-full flex-col overflow-y-auto sm:max-w-[560px]">
          <SheetHeader>
            <SheetTitle>邀请参会者加入 ConnectIQ</SheetTitle>
            <SheetDescription className="text-sm text-text-muted">
              发送个性化邀请，引导参会者下载 ConnectIQ 进行现场社交
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 flex-1 space-y-8 pb-24">
            <section className="space-y-4">
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
                            <Input
                              className="mt-2 h-8 text-xs"
                              placeholder="邮件主题"
                              value={subject}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => setSubject(e.target.value)}
                            />
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

            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold">消息内容</h4>
                <Popover>
                  <PopoverTrigger className="text-xs text-brand-blue hover:underline">
                    插入变量
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-56">
                    <div className="flex flex-wrap gap-1.5">
                      {INVITE_VARIABLES.map((v) => (
                        <button
                          key={v.key}
                          type="button"
                          className="rounded-md bg-content px-2 py-1 text-xs hover:bg-brand-blue-light"
                          onClick={() => insertVariable(v.key)}
                        >
                          {v.key}
                          <span className="ml-1 text-text-muted">({v.label})</span>
                        </button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              <Textarea
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={DEFAULT_MESSAGE}
              />

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

            <section className="space-y-4">
              <h4 className="text-sm font-semibold">发送目标</h4>
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
                      disabled={!!initialParticipantIds?.length && opt.id !== "custom"}
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

              {targetMode === "custom" && !initialParticipantIds?.length && (
                <div className="space-y-3 rounded-lg border border-border-light p-3">
                  <div>
                    <p className="mb-2 text-xs font-medium text-text-muted">
                      票种
                    </p>
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

            <section className="space-y-4">
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

          <div className="sticky bottom-0 -mx-6 flex gap-2 border-t border-border-light bg-white px-6 py-4">
            <Button
              variant="outline"
              disabled={isSubmitting}
              onClick={() => void handleSaveDraft()}
            >
              保存草稿
            </Button>
            <Button
              variant="outline"
              onClick={() => setPreviewChannel(channel)}
            >
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
        </SheetContent>
      </Sheet>

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
