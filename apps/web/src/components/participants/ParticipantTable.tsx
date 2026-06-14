"use client";

import { useMemo, useState } from "react";
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
  MessageSquare,
  MoreHorizontal,
  ScanLine,
  Ticket,
  Trash2,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ParticipantListItem } from "@/lib/participants";
import { cn } from "@/lib/utils";

export type ParticipantRow = ParticipantListItem;

type ParticipantTableProps = {
  data: ParticipantRow[];
  isLoading?: boolean;
  statusFilter?: string;
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
    return (
      <span className="inline-flex rounded-full bg-brand-blue-light px-2 py-0.5 text-xs text-brand-blue">
        已邀请
      </span>
    );
  }
  if (status === "CLICKED") {
    return (
      <span className="inline-flex rounded-full bg-brand-green-light px-2 py-0.5 text-xs text-brand-green">
        已点击 ✓
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-full bg-brand-green px-2 py-0.5 text-xs text-white">
      已激活 ✅
    </span>
  );
}

export function ParticipantTable({
  data,
  isLoading,
  statusFilter,
  onCheckIn,
  onRemove,
  onRefresh,
  onBulkInvite,
}: ParticipantTableProps) {
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [removeId, setRemoveId] = useState<string | null>(null);

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
          return (
            <div className="flex items-center gap-3">
              <Avatar className="size-8">
                <AvatarFallback
                  className={cn(
                    "text-xs",
                    p.isVip
                      ? "bg-brand-amber-light text-brand-amber"
                      : "bg-brand-blue-light text-brand-blue",
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
            <span className="inline-flex items-center gap-1.5 text-brand-green">
              <span className="size-1.5 rounded-full bg-brand-green" />
              已签到 {format(new Date(checkedIn), "HH:mm")}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-text-muted">
              <span className="size-1.5 rounded-full bg-text-tertiary" />
              未签到
            </span>
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
          return (
            <DropdownMenu>
              <DropdownMenuTrigger className="inline-flex size-8 items-center justify-center rounded-lg text-text-muted hover:bg-content">
                <MoreHorizontal className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => toast.info("名片详情将在后续版本开放")}
                >
                  <CreditCard className="size-4" />
                  查看名片
                </DropdownMenuItem>
                {!p.checkedInAt && (
                  <DropdownMenuItem onClick={() => onCheckIn(p.id)}>
                    <ScanLine className="size-4" />
                    手动签到
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  onClick={() => toast.info("消息推送将在后续版本开放")}
                >
                  <MessageSquare className="size-4" />
                  发消息
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => toast.info("票种调整将在后续版本开放")}
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
          );
        },
      },
    ],
    [onCheckIn],
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
              onClick={() => {
                const ids = table
                  .getFilteredSelectedRowModel()
                  .rows.map((r) => r.original.id);
                onBulkInvite(ids);
              }}
            >
              批量邀请所选参会者
            </Button>
          )}
          <Button
            size="sm"
            variant="secondary"
            onClick={() => toast.info("批量发通知将在后续版本开放")}
          >
            批量发通知
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => toast.info("批量导出将在后续版本开放")}
          >
            批量导出
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => toast.info("批量修改票种将在后续版本开放")}
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

      <div className="overflow-x-auto rounded-xl border border-border-light bg-white">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id} className="hover:bg-transparent">
                {hg.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className="h-10 bg-content text-xs font-semibold text-text-muted"
                  >
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
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-32 text-center"
                >
                  <div className="flex flex-col items-center gap-2 text-text-muted">
                    <UserRound className="size-8 opacity-40" />
                    <p className="text-sm">暂无参会者</p>
                    <p className="text-xs">导入 Excel 或手动添加参会者</p>
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
                      "h-[52px] hover:bg-content/80",
                      p.isVip &&
                        "border-l-[3px] border-l-brand-gold bg-[#FFFDF0]",
                      p.isSpeaker &&
                        !p.isVip &&
                        "border-l-[3px] border-l-brand-blue bg-brand-blue-light/30",
                    )}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="text-sm">
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
      </div>

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
    </>
  );
}
