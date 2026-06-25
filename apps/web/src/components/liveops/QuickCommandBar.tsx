"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Megaphone, Monitor, Radio, Vote } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type QuickCommandBarProps = {
  eventId: string;
};

export function QuickCommandBar({ eventId }: QuickCommandBarProps) {
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [urgentOpen, setUrgentOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function sendBroadcast(urgent: boolean) {
    if (!title.trim() || !body.trim()) {
      toast.error("请填写标题和内容");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/events/${eventId}/broadcast`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, body, urgent }),
      });
      if (!res.ok) throw new Error("发送失败");
      const json = await res.json();
      toast.success(`已推送 ${json.data?.sent ?? 0} 人`);
      setBroadcastOpen(false);
      setUrgentOpen(false);
      setTitle("");
      setBody("");
    } catch {
      toast.error("推送失败");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <footer className="sticky bottom-0 z-20 border-t border-white/10 bg-[#0f1117]/95 px-6 py-4 backdrop-blur-md">
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button
            className="bg-brand-blue text-white hover:bg-brand-blue/90"
            onClick={() => setBroadcastOpen(true)}
          >
            <Megaphone className="mr-1.5 size-4" />
            全场推送
          </Button>
          <Link
            href={`/events/${eventId}/interactions`}
            className="inline-flex h-9 items-center rounded-md border border-white/20 px-4 text-sm text-white hover:bg-white/10"
          >
            <Vote className="mr-1.5 size-4" />
            发起投票
          </Link>
          <Link
            href={`/events/${eventId}/interactions/bigscreen`}
            target="_blank"
            className="inline-flex h-9 items-center rounded-md border border-white/20 px-4 text-sm text-white hover:bg-white/10"
          >
            <Monitor className="mr-1.5 size-4" />
            上大屏
          </Link>
          <Button
            variant="outline"
            className="border-red-500/40 text-red-400 hover:bg-red-500/10"
            onClick={() => {
              setTitle("现场通知");
              setUrgentOpen(true);
            }}
          >
            <Radio className="mr-1.5 size-4" />
            现场广播
          </Button>
        </div>
      </footer>

      <Dialog open={broadcastOpen} onOpenChange={setBroadcastOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>全场推送</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label htmlFor="bc-title">标题</Label>
              <Input
                id="bc-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="通知标题"
              />
            </div>
            <div>
              <Label htmlFor="bc-body">内容</Label>
              <Textarea
                id="bc-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="推送内容"
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              disabled={submitting}
              onClick={() => void sendBroadcast(false)}
            >
              发送
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={urgentOpen} onOpenChange={setUrgentOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-600">🚨 现场广播（紧急）</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label htmlFor="urg-title">标题</Label>
              <Input
                id="urg-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="urg-body">内容</Label>
              <Textarea
                id="urg-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="destructive"
              disabled={submitting}
              onClick={() => void sendBroadcast(true)}
            >
              紧急广播
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
