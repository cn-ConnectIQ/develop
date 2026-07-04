"use client";

import { useEffect, useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import type { LucideIcon } from "lucide-react";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableShell,
  TableToolbar,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export type { ColumnDef };

/** 行数据需包含 id；isVip / isShadow / highlight 用于特殊行样式 */
export type DataTableRow = {
  id: string;
  isVip?: boolean;
  isShadow?: boolean;
  highlight?: "amber" | "blue";
};

export interface DataTableProps<T extends DataTableRow> {
  columns: ColumnDef<T>[];
  data: T[];
  isLoading?: boolean;
  pagination?: {
    total: number;
    pageSize: number;
    cursor?: string;
    onNext: () => void;
    onPrev: () => void;
    hasNext: boolean;
    hasPrev: boolean;
  };
  searchable?: boolean;
  searchPlaceholder?: string;
  onSearch?: (query: string) => void;
  selectable?: boolean;
  bulkActions?: {
    label: string;
    variant?: "default" | "destructive";
    onClick: (selectedIds: string[]) => void;
  }[];
  emptyState?: {
    icon?: LucideIcon;
    title: string;
    description?: string;
    action?: { label: string; onClick: () => void };
  };
  rowHeight?: 48 | 52 | 56 | 64 | 72;
}

const ROW_HEIGHT_CLASS: Record<48 | 52 | 56 | 64 | 72, string> = {
  48: "h-12",
  52: "h-[52px]",
  56: "h-14",
  64: "h-16",
  72: "h-[72px]",
};

const SKELETON_ROWS = 5;

function getRowClassName<T extends DataTableRow>(
  row: T,
  rowHeightClass: string,
): string {
  return cn(
    rowHeightClass,
    row.isVip && "border-l-[3px] border-l-brand-gold",
    row.isShadow && !row.isVip && "opacity-90",
    row.highlight === "amber" && "border-l-[3px] border-l-brand-amber",
    row.highlight === "blue" && "border-l-[3px] border-l-brand-blue",
  );
}

export function DataTable<T extends DataTableRow>({
  columns,
  data,
  isLoading = false,
  pagination,
  searchable = false,
  searchPlaceholder = "搜索...",
  onSearch,
  selectable = false,
  bulkActions = [],
  emptyState,
  rowHeight = 52,
}: DataTableProps<T>) {
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState("");

  const rowHeightClass = ROW_HEIGHT_CLASS[rowHeight];

  useEffect(() => {
    if (!onSearch) return;
    const timer = setTimeout(() => onSearch(searchQuery), 500);
    return () => clearTimeout(timer);
  }, [searchQuery, onSearch]);

  const tableColumns = useMemo<ColumnDef<T>[]>(() => {
    if (!selectable) return columns;

    const selectColumn: ColumnDef<T> = {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          onCheckedChange={(value) =>
            table.toggleAllPageRowsSelected(value === true)
          }
          aria-label="全选"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(value === true)}
          aria-label="选择行"
        />
      ),
      size: 40,
      enableSorting: false,
      enableHiding: false,
    };

    return [selectColumn, ...columns];
  }, [columns, selectable]);

  const table = useReactTable({
    data,
    columns: tableColumns,
    state: { rowSelection },
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.id,
    enableRowSelection: selectable,
  });

  const selectedIds = table
    .getFilteredSelectedRowModel()
    .rows.map((row) => row.original.id);
  const selectedCount = selectedIds.length;
  const columnCount = tableColumns.length;
  const isEmpty = !isLoading && data.length === 0;

  return (
    <div className="space-y-4">
      {(searchable || (selectable && selectedCount > 0)) && (
        <TableToolbar className={cn(!searchable && "py-3")}>
          {searchable && (
            <div className="relative min-w-[200px] max-w-xs flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-text-tertiary" />
              <Input
                placeholder={searchPlaceholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 pl-9"
              />
            </div>
          )}
          {selectable && selectedCount > 0 && (
            <>
              <span className="text-sm font-medium text-text-primary">
                已选 {selectedCount} 项
              </span>
              {bulkActions.map((action) => (
                <Button
                  key={action.label}
                  size="sm"
                  variant={
                    action.variant === "destructive" ? "destructive" : "outline"
                  }
                  className={
                    action.variant === "destructive"
                      ? "bg-brand-red text-white hover:bg-brand-red/90"
                      : undefined
                  }
                  onClick={() => action.onClick(selectedIds)}
                >
                  {action.label}
                </Button>
              ))}
              <div className="flex-1" />
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setRowSelection({})}
              >
                取消
              </Button>
            </>
          )}
        </TableToolbar>
      )}

      {isLoading ? (
        <TableShell>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-surface-secondary">
                {Array.from({ length: columnCount }).map((_, i) => (
                  <TableHead key={i}>
                    <Skeleton className="h-3 w-16" />
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: SKELETON_ROWS }).map((_, rowIdx) => (
                <TableRow
                  key={rowIdx}
                  className={cn(rowHeightClass, "hover:bg-surface")}
                >
                  {Array.from({ length: columnCount }).map((_, colIdx) => (
                    <TableCell key={colIdx}>
                      <Skeleton className="h-4 w-full max-w-[120px]" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableShell>
      ) : isEmpty ? (
        <div className="flex flex-col items-center justify-center rounded-md border border-border bg-surface px-6 py-16 text-center shadow-sm">
          {emptyState?.icon && (
            <emptyState.icon className="mb-3 size-10 text-text-tertiary opacity-40" />
          )}
          <p className="text-sm font-medium text-text-primary">
            {emptyState?.title ?? "暂无数据"}
          </p>
          {emptyState?.description && (
            <p className="mt-1 max-w-sm text-xs text-text-secondary">
              {emptyState.description}
            </p>
          )}
          {emptyState?.action && (
            <Button
              className="mt-4"
              size="sm"
              onClick={emptyState.action.onClick}
            >
              {emptyState.action.label}
            </Button>
          )}
        </div>
      ) : (
        <TableShell>
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="hover:bg-surface-secondary">
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() ? "selected" : undefined}
                  className={getRowClassName(row.original, rowHeightClass)}
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
              ))}
            </TableBody>
          </Table>
        </TableShell>
      )}

      {pagination && !isLoading && (
        <div className="flex items-center justify-between text-sm text-text-muted">
          <span>共 {pagination.total.toLocaleString()} 条</span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1 px-2.5"
              disabled={!pagination.hasPrev}
              onClick={pagination.onPrev}
            >
              <ChevronLeft className="size-4" />
              上一页
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1 px-2.5"
              disabled={!pagination.hasNext}
              onClick={pagination.onNext}
            >
              下一页
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
