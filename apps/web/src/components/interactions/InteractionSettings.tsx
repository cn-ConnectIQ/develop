"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { SessionOption } from "@/lib/interactions";
import { cn } from "@/lib/utils";

type InteractionSettingsProps = {
  sessions?: SessionOption[];
  showResults?: boolean;
  isLottery?: boolean;
  qrUrl?: string | null;
  onShowResultsChange?: (value: boolean) => void;
};

export function InteractionSettings({
  sessions = [],
  showResults = true,
  isLottery = false,
  qrUrl,
  onShowResultsChange,
}: InteractionSettingsProps) {
  const [open, setOpen] = useState(false);
  const [triggerMode, setTriggerMode] = useState("manual");
  const [timeLimit, setTimeLimit] = useState(false);
  const [scanEnabled, setScanEnabled] = useState(false);
  const [allowMultiple, setAllowMultiple] = useState(false);

  return (
    <div className="mt-6">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-sm text-text-muted"
      >
        设置
        <ChevronDown
          className={cn("size-4 transition-transform", open && "rotate-180")}
        />
      </button>

      {open && (
        <div className="mt-2 space-y-4 rounded-xl border border-border-light bg-white p-4">
          <fieldset className="space-y-3">
            <legend className="text-sm font-medium">触发时机</legend>
            <label className="flex cursor-pointer items-start gap-2">
              <input
                type="radio"
                name="trigger"
                checked={triggerMode === "manual"}
                onChange={() => setTriggerMode("manual")}
                className="mt-1"
              />
              <div>
                <p className="text-sm">手动发布</p>
                <p className="text-xs text-text-muted">由主持人在控制台点击激活</p>
              </div>
            </label>
            <label className="flex cursor-pointer items-start gap-2">
              <input
                type="radio"
                name="trigger"
                checked={triggerMode === "session"}
                onChange={() => setTriggerMode("session")}
                className="mt-1"
              />
              <div className="flex-1">
                <p className="text-sm">绑定议题结束后</p>
                {triggerMode === "session" && (
                  <Select>
                    <SelectTrigger className="mt-2 h-9">
                      <SelectValue placeholder="选择议题" />
                    </SelectTrigger>
                    <SelectContent>
                      {sessions.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </label>
            <label className="flex cursor-pointer items-start gap-2">
              <input
                type="radio"
                name="trigger"
                checked={triggerMode === "scheduled"}
                onChange={() => setTriggerMode("scheduled")}
                className="mt-1"
              />
              <div className="flex-1">
                <p className="text-sm">定时发布</p>
                {triggerMode === "scheduled" && (
                  <Input type="datetime-local" className="mt-2 h-9" />
                )}
              </div>
            </label>
            <label className="flex cursor-pointer items-start gap-2">
              <input
                type="radio"
                name="trigger"
                checked={triggerMode === "scan"}
                onChange={() => setTriggerMode("scan")}
                className="mt-1"
              />
              <div>
                <p className="text-sm">扫码触发</p>
                <p className="text-xs text-text-muted">
                  参会者扫码后自动触发此互动
                </p>
              </div>
            </label>
          </fieldset>

          <div className="flex items-center gap-3">
            <Switch checked={timeLimit} onCheckedChange={setTimeLimit} />
            <span className="text-sm">限时投票</span>
            {timeLimit && (
              <>
                <Input type="number" defaultValue={5} className="h-9 w-16" />
                <span className="text-sm text-text-muted">分钟</span>
              </>
            )}
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm">实时显示结果给参会者</span>
            <Switch
              checked={showResults}
              onCheckedChange={onShowResultsChange}
            />
          </div>

          {isLottery && (
            <div className="flex items-center justify-between">
              <span className="text-sm">允许多次参与</span>
              <Switch checked={allowMultiple} onCheckedChange={setAllowMultiple} />
            </div>
          )}

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm">扫码参与</span>
              <Switch checked={scanEnabled} onCheckedChange={setScanEnabled} />
            </div>
            {scanEnabled && qrUrl && (
              <div className="flex justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qrUrl}
                  alt="扫码参与二维码"
                  className="size-[200px] rounded-lg border border-border-light object-contain"
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
