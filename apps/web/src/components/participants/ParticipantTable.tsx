"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type RowSelectionState,
} from "@tanstack/react-table";
import {
  CreditCard,
  Mail,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Phone,
  ScanLine,
  Send,
  Ticket,
  Trash2,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { toastInviteSendError } from "@/lib/invite/invite-credit-toast";
import { EXPERIENCE_BULK_INVITE_MESSAGE } from "@/lib/experience/experience-invite-messages";
import { buildInviteShortUrl } from "@/lib/invite/invite-url";
import {
  FIXED_PARTICIPANT_INVITE_SUBJECT,
  FIXED_PARTICIPANT_INVITE_TEMPLATE,
  resolveInviteMessage,
} from "@/lib/invite/message";
import { MessagePreview } from "@/components/invites/MessagePreview";
import { EditParticipantSheet } from "@/components/participants/EditParticipantSheet";
import { useExperienceAccount } from "@/hooks/useExperienceAccount";
import { useCurrentEvent } from "@/contexts/event-context";
import { withPublicPath } from "@/lib/public-path";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableShell,
} from "@/components/ui/table";
import { StatusChip } from "@/components/ui/status-chip";
import type { ParticipantListItem } from "@/lib/participants";
import { ParticipantTagChips } from "@/components/participants/ParticipantTagChips";
import { TagEditor } from "@/components/participants/TagEditor";
import { getTagStyle } from "@/lib/participant-tags";
import { cn } from "@/lib/utils";

export type ParticipantRow = ParticipantListItem;

type ParticipantTableProps = {
  eventId: string;
  data: ParticipantRow[];
  isLoading?: boolean;
  statusFilter?: string;
  ticketTypes?: Array<{ id: string; name: string }>;
  onCheckIn: (id: string) => void;
  onRemove: (id: string) => void;
  onRefresh: () => void;
  onBulkInvite?: (participantIds: string[]) => void;
};

function InviteStatusBadge({
  status,
}: {
  status: ParticipantRow["inviteStatus"];
}) {
  if (status === "NOT_INVITED") {
    return <span className="text-text-tertiary">—</span>;
  }
  if (status === "INVITED") {
    return <StatusChip variant="info">已邀请</StatusChip>;
  }
  if (status === "CLICKED") {
    return <StatusChip variant="success">已点击</StatusChip>;
  }
  return <StatusChip variant="success">已激活</StatusChip>;
}

export function ParticipantTable({
  eventId,
  data,
  isLoading,
  statusFilter,
  ticketTypes = [],
  onCheckIn,
  onRemove,
  onRefresh,
  onBulkInvite,
}: ParticipantTableProps) {
  const { data: experienceProfile } = useExperienceAccount();
  const experienceBulkBlocked = Boolean(experienceProfile?.isActiveExperience);
  const { currentEvent, eventDisplayName } = useCurrentEvent();
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [ticketOpen, setTicketOpen] = useState(false);
  const [tagsOpen, setTagsOpen] = useState(false);
  const [tagPopoverId, setTagPopoverId] = useState<string | null>(null);
  const [savingTags, setSavingTags] = useState(false);
  const [targetIds, setTargetIds] = useState<string[]>([]);
  const [editTags, setEditTags] = useState<string[]>([]);
  const [notifyTitle, setNotifyTitle] = useState("活动通知");
  const [notifyBody, setNotifyBody] = useState("");
  const [selectedTicketId, setSelectedTicketId] = useState<string>("");
  const [inviteTarget, setInviteTarget] = useState<ParticipantRow | null>(null);
  const [inviteChannel, setInviteChannel] = useState<"SMS" | "EMAIL">("SMS");
  const [inviting, setInviting] = useState(false);
  const [invitePreviewLink, setInvitePreviewLink] = useState(
    () => buildInviteShortUrl("{短码}"),
  );
  const [editTarget, setEditTarget] = useState<ParticipantRow | null>(null);

  function openInviteDialog(p: ParticipantRow) {
    const preferSms = Boolean(p.phone?.trim());
    const preferEmail = Boolean(p.email?.trim());
    if (!preferSms && !preferEmail) {
      toast.error("该参会者没有手机号和邮箱，请先补全联系方式");
      return;
    }
    setInviteChannel(preferSms ? "SMS" : "EMAIL");
    setInvitePreviewLink(buildInviteShortUrl("{短码}"));
    setInviteTarget(p);
  }

  useEffect(() => {
    if (!inviteTarget) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(
          withPublicPath(
            `/api/events/${eventId}/participants/${inviteTarget.id}/invite`,
          ),
        );
        if (!res.ok) return;
        const json = await res.json();
        const link = json.data?.preview_link as string | undefined;
        if (!cancelled && link) setInvitePreviewLink(link);
      } catch {
        // 预览失败时保留真实域名格式，不遮罩
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [eventId, inviteTarget]);

  const invitePreviewContext = useMemo(() => {
    const eventName =
      currentEvent?.name?.trim() ||
      (eventDisplayName !== "选择活动" && eventDisplayName !== "加载活动..."
        ? eventDisplayName
        : "本活动");
    return {
      name: inviteTarget?.name?.trim() || "参会者",
      eventName,
      eventDate: "活动日期",
      link: invitePreviewLink,
      organizer: "主办方",
      location: "活动现场",
    };
  }, [
    currentEvent?.name,
    eventDisplayName,
    invitePreviewLink,
    inviteTarget?.name,
  ]);

  async function confirmQuickInvite() {
    if (!inviteTarget) return;
    const channel = inviteChannel;
    if (channel === "SMS" && !inviteTarget.phone?.trim()) {
      toast.error("该参会者没有手机号，请改用邮件");
      return;
    }
    if (channel === "EMAIL" && !inviteTarget.email?.trim()) {
      toast.error("该参会者没有邮箱，请改用短信");
      return;
    }

    setInviting(true);
    try {
      const resend = inviteTarget.inviteStatus !== "NOT_INVITED";
      const res = await fetch(
        withPublicPath(
          `/api/events/${eventId}/participants/${inviteTarget.id}/invite`,
        ),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ channel, resend }),
        },
      );
      const json = await res.json();
      if (!res.ok) {
        const msg = json.error ?? json.message ?? "邀请失败";
        const err = new Error(msg) as Error & { redirectTo?: string };
        if (typeof json.redirect_to === "string") {
          err.redirectTo = json.redirect_to;
        } else if (res.status === 402 || String(msg).includes("余额不足")) {
          err.redirectTo = "/organizer/billing";
        }
        throw err;
      }
      toast.success(
        channel === "SMS"
          ? `已向 ${inviteTarget.name} 发送短信邀请`
          : `已向 ${inviteTarget.name} 发送邮件邀请`,
      );
      setInviteTarget(null);
      onRefresh();
    } catch (e) {
      toastInviteSendError(e, "邀请失败");
    } finally {
      setInviting(false);
    }
  }

  async function saveParticipantTags(participantId: string, tags: string[]) {
    setSavingTags(true);
    try {
      const res = await fetch(
        `/api/events/${eventId}/participants/${participantId}/tags`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tags }),
        },
      );
      if (!res.ok) {
        toast.error("保存标签失败");
        return false;
      }
      toast.success("标签已更新");
      setTagPopoverId(null);
      onRefresh();
      return true;
    } finally {
      setSavingTags(false);
    }
  }

  async function batchAppendTags(participantIds: string[], tags: string[]) {
    if (tags.length === 0) {
      toast.error("请至少选择一个标签");
      return;
    }
    setSavingTags(true);
    try {
      const res = await fetch(
        `/api/events/${eventId}/participants/batch-tags`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ participantIds, tags }),
        },
      );
      if (!res.ok) {
        toast.error("批量打标签失败");
        return;
      }
      const json = await res.json();
      toast.success(`已为 ${json.data.updated} 人追加标签`);
      setTagsOpen(false);
      setEditTags([]);
      setRowSelection({});
      onRefresh();
    } finally {
      setSavingTags(false);
    }
  }

  async function runBatch(
    action: "check_in" | "update_ticket" | "update_tags" | "delete",
    participantIds: string[],
    ticketTypeId?: string | null,
    tags?: string[],
    addTags?: string[],
  ) {
    const res = await fetch(`/api/events/${eventId}/participants/batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        participantIds,
        ticketTypeId,
        tags,
        addTags,
      }),
    });
    if (!res.ok) {
      toast.error("操作失败");
      return;
    }
    toast.success("操作成功");
    setRowSelection({});
    onRefresh();
  }

  async function sendNotify(participantIds: string[]) {
    if (!notifyBody.trim()) {
      toast.error("请填写通知内容");
      return;
    }
    const res = await fetch(`/api/events/${eventId}/participants/notify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        participantIds,
        title: notifyTitle,
        body: notifyBody,
      }),
    });
    if (!res.ok) {
      toast.error("发送失败");
      return;
    }
    const json = await res.json();
    toast.success(`已发送 ${json.data.sent} 条，跳过 ${json.data.skipped} 条`);
    setNotifyOpen(false);
    setNotifyBody("");
  }

  async function exportSelected(participantIds?: string[]) {
    const res = await fetch(`/api/events/${eventId}/participants/export`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        participantIds?.length ? { participantIds } : {},
      ),
    });
    if (!res.ok) {
      toast.error("导出失败");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `participants-${eventId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("导出成功");
  }

  const columns = useMemo<ColumnDef<ParticipantRow>[]>(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <Checkbox
            checked={table.getIsAllPageRowsSelected()}
            onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(v) => row.toggleSelected(!!v)}
          />
        ),
        size: 40,
      },
      {
        id: "person",
        header: "参会者",
        cell: ({ row }) => {
          const p = row.original;
          const avatarStyle = p.tags.length
            ? getTagStyle(p.tags[0]!)
            : p.isVip
              ? getTagStyle("VIP")
              : undefined;
          return (
            <div className="flex items-center gap-3">
              <Avatar className="size-8 rounded-sm after:rounded-sm">
                <AvatarFallback
                  className={cn(
                    "rounded-sm text-xs",
                    avatarStyle?.avatarClass ??
                      "bg-brand-blue-light text-brand-blue",
                  )}
                >
                  {p.name.slice(0, 1)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="font-medium text-[var(--admin-ink)]">{p.name}</p>
                <p className="truncate text-xs text-text-muted">
                  {[p.company, p.jobTitle].filter(Boolean).join(" · ") || "—"}
                </p>
              </div>
            </div>
          );
        },
      },
      {
        id: "tags",
        header: "身份标签",
        cell: ({ row }) => (
          <ParticipantTagChips tags={row.original.tags} max={4} />
        ),
      },
      {
        accessorKey: "ticketType",
        header: "票种",
        cell: ({ row }) => row.original.ticketType ?? "—",
      },
      {
        accessorKey: "createdAt",
        header: "报名时间",
        cell: ({ row }) =>
          format(new Date(row.original.createdAt), "yyyy/M/d HH:mm"),
      },
      {
        id: "checkin",
        header: "签到状态",
        cell: ({ row }) => {
          const checkedIn = row.original.checkedInAt;
          return checkedIn ? (
            <StatusChip variant="success" dot>
              已签到 {format(new Date(checkedIn), "HH:mm")}
            </StatusChip>
          ) : (
            <StatusChip variant="neutral" dot>
              未签到
            </StatusChip>
          );
        },
      },
      {
        id: "inviteStatus",
        header: "邀请状态",
        cell: ({ row }) => (
          <InviteStatusBadge status={row.original.inviteStatus} />
        ),
      },
      {
        accessorKey: "connectionCount",
        header: "连接数",
        cell: ({ row }) => (
          <span className="tabular-nums">{row.original.connectionCount}</span>
        ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => {
          const p = row.original;
          const popoverOpen = tagPopoverId === p.id;
          return (
            <div className="flex items-center justify-end gap-1">
              <button
                type="button"
                className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-xs text-text-secondary hover:bg-content"
                onClick={() => setEditTarget(p)}
              >
                <UserRound className="size-3.5" />
                编辑
              </button>
              <button
                type="button"
                className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-xs text-brand-purple hover:bg-brand-purple/10"
                onClick={() => openInviteDialog(p)}
              >
                <Send className="size-3.5" />
                {p.inviteStatus === "NOT_INVITED" ? "邀请" : "再邀请"}
              </button>
              <Popover
                open={popoverOpen}
                onOpenChange={(open) => {
                  if (open) {
                    setTagPopoverId(p.id);
                    setEditTags(p.tags);
                  } else if (tagPopoverId === p.id) {
                    setTagPopoverId(null);
                  }
                }}
              >
                <PopoverTrigger
                  className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-xs text-brand-blue hover:bg-brand-blue-light"
                >
                  <Pencil className="size-3.5" />
                  标签
                </PopoverTrigger>
                <PopoverContent align="end" className="w-80">
                  <p className="mb-3 text-sm font-medium">编辑身份标签</p>
                  <TagEditor
                    value={editTags}
                    onChange={setEditTags}
                    mode="replace"
                    disabled={savingTags}
                  />
                  <div className="mt-4 flex justify-end gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setTagPopoverId(null)}
                    >
                      取消
                    </Button>
                    <Button
                      size="sm"
                      disabled={savingTags}
                      onClick={() =>
                        void saveParticipantTags(p.id, editTags)
                      }
                    >
                      确认
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
              <DropdownMenu>
              <DropdownMenuTrigger className="inline-flex size-8 items-center justify-center rounded-lg text-text-muted hover:bg-content">
                <MoreHorizontal className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setEditTarget(p)}>
                  <UserRound className="size-4" />
                  编辑信息
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    toast.message(`${p.name}`, {
                      description: [p.company, p.phone, p.email]
                        .filter(Boolean)
                        .join(" · ") || "暂无更多信息",
                    });
                  }}
                >
                  <CreditCard className="size-4" />
                  查看名片
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => openInviteDialog(p)}>
                    <Send className="size-4" />
                    {p.inviteStatus === "NOT_INVITED"
                      ? "邀请加入"
                      : "重新发送邀请"}
                  </DropdownMenuItem>
                {!p.checkedInAt && (
                  <DropdownMenuItem onClick={() => onCheckIn(p.id)}>
                    <ScanLine className="size-4" />
                    手动签到
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  onClick={() => {
                    setTagPopoverId(p.id);
                    setEditTags(p.tags);
                  }}
                >
                  <Pencil className="size-4" />
                  编辑标签
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    setTargetIds([p.id]);
                    setNotifyOpen(true);
                  }}
                >
                  <MessageSquare className="size-4" />
                  发消息
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    setTargetIds([p.id]);
                    setSelectedTicketId(p.ticketTypeId ?? "");
                    setTicketOpen(true);
                  }}
                >
                  <Ticket className="size-4" />
                  调整票种
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => setRemoveId(p.id)}
                >
                  <Trash2 className="size-4" />
                  移除
                </DropdownMenuItem>
              </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      },
    ],
    [onCheckIn, tagPopoverId, editTags, savingTags, eventId],
  );

  const table = useReactTable({
    data,
    columns,
    state: { rowSelection },
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.id,
  });

  const selectedCount = table.getFilteredSelectedRowModel().rows.length;

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-[52px] w-full rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <>
      {selectedCount > 0 && (
        <div className="sticky top-0 z-20 mb-3 flex h-12 items-center gap-3 rounded-lg bg-gray-900 px-4 text-sm text-white shadow-md">
          <span className="font-medium">已选 {selectedCount} 人</span>
          {statusFilter === "not_invited" && onBulkInvite && (
            <Button
              size="sm"
              variant="outline"
              className="border-brand-purple text-brand-purple hover:bg-brand-purple/10"
              disabled={experienceBulkBlocked && selectedCount > 1}
              title={
                experienceBulkBlocked && selectedCount > 1
                  ? EXPERIENCE_BULK_INVITE_MESSAGE
                  : undefined
              }
              onClick={() => {
                const ids = table
                  .getFilteredSelectedRowModel()
                  .rows.map((r) => r.original.id);
                if (experienceBulkBlocked) {
                  if (ids.length > 1) {
                    toast.error(EXPERIENCE_BULK_INVITE_MESSAGE);
                    return;
                  }
                  const row = table
                    .getFilteredSelectedRowModel()
                    .rows[0]?.original;
                  if (row) {
                    openInviteDialog(row);
                    return;
                  }
                }
                onBulkInvite(ids);
              }}
            >
              {experienceBulkBlocked && selectedCount === 1
                ? "邀请所选参会者"
                : "批量邀请所选参会者"}
            </Button>
          )}
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              const ids = table
                .getFilteredSelectedRowModel()
                .rows.map((r) => r.original.id);
              setTargetIds(ids);
              setNotifyOpen(true);
            }}
          >
            批量发通知
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              const ids = table
                .getFilteredSelectedRowModel()
                .rows.map((r) => r.original.id);
              void exportSelected(ids);
            }}
          >
            批量导出
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              const ids = table
                .getFilteredSelectedRowModel()
                .rows.map((r) => r.original.id);
              setTargetIds(ids);
              setEditTags([]);
              setTagsOpen(true);
            }}
          >
            批量打标签
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              const ids = table
                .getFilteredSelectedRowModel()
                .rows.map((r) => r.original.id);
              setTargetIds(ids);
              setTicketOpen(true);
            }}
          >
            批量修改票种
          </Button>
          <div className="flex-1" />
          <Button
            size="sm"
            variant="ghost"
            className="text-white hover:bg-white/10 hover:text-white"
            onClick={() => setRowSelection({})}
          >
            取消
          </Button>
        </div>
      )}

      <TableShell>
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id} className="hover:bg-surface-secondary">
                {hg.headers.map((header) => (
                  <TableHead key={header.id}>
                    {flexRender(
                      header.column.columnDef.header,
                      header.getContext(),
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow className="hover:bg-surface">
                <TableCell
                  colSpan={columns.length}
                  className="h-32 text-center"
                >
                  <div className="flex flex-col items-center gap-2 text-text-secondary">
                    <UserRound className="size-8 opacity-40" />
                    <p className="text-sm">暂无参会者</p>
                    <p className="text-xs text-text-tertiary">导入 Excel 或手动添加参会者</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => {
                const p = row.original;
                return (
                  <TableRow
                    key={row.id}
                    className={cn(
                      "h-12",
                      p.isVip && "border-l-[3px] border-l-brand-gold",
                      p.isSpeaker &&
                        !p.isVip &&
                        "border-l-[3px] border-l-brand-blue",
                    )}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableShell>

      <Dialog
        open={!!inviteTarget}
        onOpenChange={(open) => {
          if (!open) setInviteTarget(null);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              邀请 {inviteTarget?.name ?? ""} 加入玖莅
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-text-muted">
              使用固定邀请模板发送。短信/邮件额度按主办方账号统一扣减。
            </p>
            {inviteTarget?.inviteStatus === "ACTIVATED" && (
              <p className="text-xs text-brand-amber">
                该参会者已激活，确认后仍会再发送一条邀请。
              </p>
            )}
            {inviteTarget?.inviteStatus !== "NOT_INVITED" &&
              inviteTarget?.inviteStatus !== "ACTIVATED" && (
              <p className="text-xs text-brand-amber">
                该参会者已邀请过，确认将重新发送一条邀请。
              </p>
            )}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={!inviteTarget?.phone?.trim()}
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-3 py-3 text-left text-sm transition-colors",
                  inviteChannel === "SMS"
                    ? "border-brand-blue bg-brand-blue-light text-brand-blue"
                    : "border-border-light text-text-muted hover:bg-gray-50",
                  !inviteTarget?.phone?.trim() && "cursor-not-allowed opacity-40",
                )}
                onClick={() => setInviteChannel("SMS")}
              >
                <Phone className="size-4 shrink-0" />
                <span>
                  短信
                  <span className="mt-0.5 block text-xs opacity-80">
                    {inviteTarget?.phone?.trim() || "无手机号"}
                  </span>
                </span>
              </button>
              <button
                type="button"
                disabled={!inviteTarget?.email?.trim()}
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-3 py-3 text-left text-sm transition-colors",
                  inviteChannel === "EMAIL"
                    ? "border-brand-green bg-brand-green-light text-brand-green"
                    : "border-border-light text-text-muted hover:bg-gray-50",
                  !inviteTarget?.email?.trim() && "cursor-not-allowed opacity-40",
                )}
                onClick={() => setInviteChannel("EMAIL")}
              >
                <Mail className="size-4 shrink-0" />
                <span>
                  邮件
                  <span className="mt-0.5 block text-xs opacity-80">
                    {inviteTarget?.email?.trim() || "无邮箱"}
                  </span>
                </span>
              </button>
            </div>
            <div>
              <p className="mb-2 text-xs font-medium text-text-muted">
                {inviteChannel === "SMS" ? "短信内容预览" : "邮件内容预览"}
                <span className="ml-1 font-normal">（固定模板，不可修改）</span>
                {invitePreviewLink.includes("{短码}") ? null : (
                  <span className="ml-1 font-normal text-emerald-700">
                    · 已显示真实短链
                  </span>
                )}
              </p>
              <MessagePreview
                channel={inviteChannel}
                template={FIXED_PARTICIPANT_INVITE_TEMPLATE}
                subject={resolveInviteMessage(
                  FIXED_PARTICIPANT_INVITE_SUBJECT,
                  invitePreviewContext,
                )}
                context={invitePreviewContext}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={inviting}
              onClick={() => setInviteTarget(null)}
            >
              取消
            </Button>
            <Button
              disabled={
                inviting ||
                (inviteChannel === "SMS"
                  ? !inviteTarget?.phone?.trim()
                  : !inviteTarget?.email?.trim())
              }
              onClick={() => void confirmQuickInvite()}
            >
              <Send className="mr-1.5 size-4" />
              {inviting ? "发送中…" : "确认发送"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!removeId} onOpenChange={() => setRemoveId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认移除参会者？</AlertDialogTitle>
            <AlertDialogDescription>
              移除后该参会者的签到与报名记录将被删除，此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-brand-red hover:bg-brand-red/90"
              onClick={() => {
                if (removeId) {
                  onRemove(removeId);
                  setRemoveId(null);
                  onRefresh();
                }
              }}
            >
              确认移除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={notifyOpen} onOpenChange={setNotifyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>发送通知（{targetIds.length} 人）</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>标题</Label>
              <Input
                value={notifyTitle}
                onChange={(e) => setNotifyTitle(e.target.value)}
              />
            </div>
            <div>
              <Label>内容</Label>
              <Textarea
                value={notifyBody}
                onChange={(e) => setNotifyBody(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => void sendNotify(targetIds)}>发送</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={ticketOpen} onOpenChange={setTicketOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>调整票种（{targetIds.length} 人）</DialogTitle>
          </DialogHeader>
          <Select
            value={selectedTicketId}
            onValueChange={(v) => setSelectedTicketId(v ?? "")}
          >
            <SelectTrigger>
              <SelectValue placeholder="选择票种" />
            </SelectTrigger>
            <SelectContent>
              {ticketTypes.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button
              onClick={() =>
                void runBatch(
                  "update_ticket",
                  targetIds,
                  selectedTicketId || null,
                ).then(() => setTicketOpen(false))
              }
            >
              确认
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={tagsOpen} onOpenChange={setTagsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>批量打标签（{targetIds.length} 人）</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-text-muted">
            所选标签将追加到每位参会者已有标签，不会覆盖原有标签。
          </p>
          <TagEditor
            value={editTags}
            onChange={setEditTags}
            mode="append"
            disabled={savingTags}
          />
          <DialogFooter>
            <Button
              disabled={savingTags}
              onClick={() =>
                void batchAppendTags(targetIds, editTags)
              }
            >
              {savingTags ? "保存中…" : "确认追加"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <EditParticipantSheet
        eventId={eventId}
        participant={editTarget}
        open={Boolean(editTarget)}
        onOpenChange={(open) => {
          if (!open) setEditTarget(null);
        }}
        onSuccess={onRefresh}
      />
    </>
  );
}
