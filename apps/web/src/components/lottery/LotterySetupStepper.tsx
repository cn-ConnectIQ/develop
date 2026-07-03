"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LotteryDrawType } from "@/lib/lottery/lottery-enums";
import { Download } from "lucide-react";
import { toast } from "sonner";
import {
  AdminContent,
  AdminHeader,
  AdminPage,
} from "@/components/admin/admin-header";
import { CreationSection, creationStyles } from "@/components/admin/content-creation-layout";
import { InteractionEditLayout } from "@/components/interactions/InteractionEditLayout";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { LeadFormBuilder } from "@/components/lead-form/LeadFormBuilder";
import { BoothLotteryPreview } from "@/components/lottery/BoothLotteryPreview";
import { DrawTypeSelector } from "@/components/lottery/DrawTypeSelector";
import { LotteryCreationFooter } from "@/components/lottery/LotteryCreationFooter";
import { PrizeListEditor } from "@/components/lottery/PrizeListEditor";
import {
  createFieldFromPreset,
  LEAD_FORM_FIELD_PRESETS,
} from "@/lib/lead-form/templates";
import type { LeadFormField } from "@/lib/lead-form/types";
import type { BoothLotteryPrizeDraft } from "@/lib/lottery/booth-lottery-schemas";
import { cn } from "@/lib/utils";

const DEFAULT_PRIZES: BoothLotteryPrizeDraft[] = [
  { name: "一等奖", quantity: 1, prize_type: "PHYSICAL" },
  { name: "二等奖", quantity: 5, prize_type: "PHYSICAL" },
  { name: "参与奖", quantity: 20, prize_type: "PHYSICAL" },
];

const DEFAULT_LEAD_FIELDS: LeadFormField[] = [
  createFieldFromPreset(LEAD_FORM_FIELD_PRESETS[0]!, 0),
  createFieldFromPreset(LEAD_FORM_FIELD_PRESETS[1]!, 1),
];

export type LotterySetupStepperProps = {
  eventId: string;
  boothId: string;
  boothCode: string;
  boothName: string;
  companyName: string;
};

type PublishResult = {
  lottery: { id: string; title: string; status: string };
  interaction: {
    session_id: string;
    session_code: string;
    qr_url: string;
    scan_url: string;
  } | null;
};

export function LotterySetupStepper({
  eventId,
  boothId,
  boothCode,
  boothName,
  companyName,
}: LotterySetupStepperProps) {
  const router = useRouter();
  const [title, setTitle] = useState(`${boothCode} 展位抽奖`);
  const [description, setDescription] = useState("");
  const [prizes, setPrizes] = useState<BoothLotteryPrizeDraft[]>(DEFAULT_PRIZES);
  const [drawType, setDrawType] = useState<LotteryDrawType>(
    LotteryDrawType.INSTANT,
  );
  const [drawAt, setDrawAt] = useState("");
  const [requireLeadCapture, setRequireLeadCapture] = useState(true);
  const [leadFields, setLeadFields] = useState<LeadFormField[]>(DEFAULT_LEAD_FIELDS);
  const [unlimitedEntries, setUnlimitedEntries] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState<PublishResult | null>(null);

  function validateAll(): boolean {
    if (!title.trim()) {
      toast.error("请填写抽奖名称");
      return false;
    }
    if (prizes.some((p) => !p.name.trim())) {
      toast.error("请填写所有奖品名称");
      return false;
    }
    if (drawType === LotteryDrawType.SCHEDULED && !drawAt) {
      toast.error("请设置定时开奖时间");
      return false;
    }
    if (requireLeadCapture && leadFields.length === 0) {
      toast.error("请至少配置一个留资字段");
      return false;
    }
    return true;
  }

  async function submit(publish: boolean) {
    if (!validateAll()) return;

    if (publish) setPublishing(true);
    else setSavingDraft(true);

    try {
      const res = await fetch(`/api/booths/${boothId}/lotteries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          prizes,
          draw_type: drawType,
          draw_at:
            drawType === LotteryDrawType.SCHEDULED && drawAt
              ? new Date(drawAt).toISOString()
              : undefined,
          require_lead_capture: requireLeadCapture,
          lead_form_config: requireLeadCapture
            ? { fields: leadFields }
            : { fields: [] },
          unlimited_entries: unlimitedEntries,
          publish,
        }),
      });

      const json = (await res.json()) as {
        data?: PublishResult;
        error?: string;
      };

      if (!res.ok) {
        throw new Error(json.error ?? "保存失败");
      }

      if (publish) {
        setPublishResult(json.data ?? null);
        toast.success("抽奖已发布");
      } else {
        toast.success("已保存草稿");
        const lotteryId = json.data?.lottery?.id;
        if (lotteryId) {
          router.push(
            `/events/${eventId}/booths/${boothId}/lottery/${lotteryId}`,
          );
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "保存失败");
    } finally {
      setPublishing(false);
      setSavingDraft(false);
    }
  }

  const submitLabel =
    drawType === LotteryDrawType.INSTANT ? "提交并立即抽奖" : "提交并参与";

  const previewPanel = publishResult?.interaction ? (
    <div className="flex flex-col items-center gap-4 py-2 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={publishResult.interaction.qr_url}
        alt="互动二维码"
        className="size-48 rounded-xl border border-border-light bg-white p-2"
      />
      <p className="text-sm font-medium">
        互动码：{publishResult.interaction.session_code}
      </p>
      <p className="max-w-xs break-all text-xs text-text-muted">
        {publishResult.interaction.scan_url}
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <a
          href={publishResult.interaction.qr_url}
          download={`lottery-${boothCode}.png`}
          className="inline-flex h-9 items-center rounded-lg border border-border-light px-4 text-sm hover:bg-white"
        >
          <Download className="mr-2 size-4" />
          下载二维码
        </a>
        <Button
          size="sm"
          onClick={() =>
            router.push(
              `/events/${eventId}/booths/${boothId}/lottery/${publishResult.lottery.id}`,
            )
          }
        >
          进入抽奖看板
        </Button>
      </div>
    </div>
  ) : (
    <BoothLotteryPreview
      companyName={companyName}
      title={title}
      description={description}
      prizes={prizes}
      requireLeadCapture={requireLeadCapture}
      leadFields={leadFields}
      submitLabel={submitLabel}
    />
  );

  return (
    <AdminPage>
      <AdminHeader
        title="创建展位抽奖"
        description={`${companyName} · ${boothCode}`}
        breadcrumb={["活动", boothName, "抽奖"]}
        actions={
          <Link
            href={`/events/${eventId}/exhibitors/booths`}
            className="inline-flex h-8 items-center rounded-lg border border-border-light px-3 text-sm hover:bg-gray-50"
          >
            返回展位列表
          </Link>
        }
      />

      <AdminContent className="p-0">
        <InteractionEditLayout
          editor={
            <>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="抽奖名称"
                className={creationStyles.titleInput}
              />
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="向参会者展示的说明（可选）"
                className={cn(creationStyles.descriptionInput, "mt-2")}
                rows={2}
              />

              <CreationSection hint="奖品" description="配置奖项名称、数量与图片">
                <PrizeListEditor prizes={prizes} onChange={setPrizes} />
              </CreationSection>

              <CreationSection hint="开奖方式" description="选择适合现场场景的开奖模式">
                <DrawTypeSelector
                  value={drawType}
                  onChange={setDrawType}
                  drawAt={drawAt}
                  onDrawAtChange={setDrawAt}
                />
              </CreationSection>

              <CreationSection hint="留资设置">
                <div className="flex items-center justify-between rounded-xl border border-border-light px-5 py-4">
                  <div>
                    <p className="text-base font-medium">需要留资才能参与</p>
                    <p className="mt-0.5 text-sm text-text-muted">
                      开启后参会者需先填写表单，数据写入展位线索
                    </p>
                  </div>
                  <Switch
                    checked={requireLeadCapture}
                    onCheckedChange={setRequireLeadCapture}
                  />
                </div>
                {requireLeadCapture ? (
                  <div className="mt-4">
                    <LeadFormBuilder
                      fields={leadFields}
                      onChange={setLeadFields}
                      previewTitle={title}
                    />
                  </div>
                ) : null}
              </CreationSection>

              <CreationSection hint="参与次数">
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setUnlimitedEntries(false)}
                    className={cn(
                      creationStyles.choiceCard,
                      "flex-1 justify-center text-base font-medium",
                      !unlimitedEntries
                        ? creationStyles.choiceCardActive
                        : creationStyles.choiceCardIdle,
                    )}
                  >
                    每人 1 次
                  </button>
                  <button
                    type="button"
                    onClick={() => setUnlimitedEntries(true)}
                    className={cn(
                      creationStyles.choiceCard,
                      "flex-1 justify-center text-base font-medium",
                      unlimitedEntries
                        ? creationStyles.choiceCardActive
                        : creationStyles.choiceCardIdle,
                    )}
                  >
                    不限次数
                  </button>
                </div>
              </CreationSection>
            </>
          }
          preview={previewPanel}
          footer={
            !publishResult ? (
              <LotteryCreationFooter
                saving={publishing}
                savingDraft={savingDraft}
                onSaveDraft={() => void submit(false)}
                onPublish={() => void submit(true)}
                publishLabel="发布"
              />
            ) : undefined
          }
        />
      </AdminContent>
    </AdminPage>
  );
}
