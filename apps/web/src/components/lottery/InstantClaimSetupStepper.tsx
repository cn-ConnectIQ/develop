"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Download } from "lucide-react";
import { toast } from "sonner";
import {
  AdminContent,
  AdminHeader,
  AdminPage,
} from "@/components/admin/admin-header";
import {
  CreationSection,
  creationStyles,
} from "@/components/admin/content-creation-layout";
import { InteractionEditLayout } from "@/components/interactions/InteractionEditLayout";
import { Button, buttonVariants } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { LeadFormBuilder } from "@/components/lead-form/LeadFormBuilder";
import { BoothLotteryPreview } from "@/components/lottery/BoothLotteryPreview";
import { LotteryCreationFooter } from "@/components/lottery/LotteryCreationFooter";
import { PrizeListEditor } from "@/components/lottery/PrizeListEditor";
import {
  createFieldFromPreset,
  LEAD_FORM_FIELD_PRESETS,
} from "@/lib/lead-form/templates";
import type { LeadFormField } from "@/lib/lead-form/types";
import type { BoothLotteryPrizeDraft } from "@/lib/lottery/booth-lottery-schemas";
import { cn } from "@/lib/utils";

const DEFAULT_PRIZE: BoothLotteryPrizeDraft[] = [
  { name: "展位礼品", quantity: 100, prize_type: "PHYSICAL" },
];

const DEFAULT_LEAD_FIELDS: LeadFormField[] = [
  createFieldFromPreset(LEAD_FORM_FIELD_PRESETS[0]!, 0),
  createFieldFromPreset(LEAD_FORM_FIELD_PRESETS[1]!, 1),
];

type PublishResult = {
  lottery: { id: string; title: string; status: string };
  interaction: {
    session_id: string;
    session_code: string;
    qr_url: string;
    scan_url: string;
  } | null;
  template_code: string;
};

export type InstantClaimSetupStepperProps = {
  eventId: string;
  boothId: string;
  boothCode: string;
  boothName: string;
  companyName: string;
};

export function InstantClaimSetupStepper({
  eventId,
  boothId,
  boothCode,
  boothName,
  companyName,
}: InstantClaimSetupStepperProps) {
  const router = useRouter();
  const listHref = `/events/${eventId}/lottery/participant`;
  const [title, setTitle] = useState(`${boothCode} 直接领取`);
  const [description, setDescription] = useState("填写信息即可领取礼品");
  const [prizes, setPrizes] = useState<BoothLotteryPrizeDraft[]>(DEFAULT_PRIZE);
  const [leadFields, setLeadFields] = useState<LeadFormField[]>(DEFAULT_LEAD_FIELDS);
  const [savingDraft, setSavingDraft] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState<PublishResult | null>(null);

  function validateAll() {
    if (!title.trim()) {
      toast.error("请填写活动名称");
      return false;
    }
    if (prizes.some((prize) => !prize.name.trim())) {
      toast.error("请填写奖品名称");
      return false;
    }
    if (prizes.some((prize) => prize.quantity <= 0)) {
      toast.error("库存数量须大于 0");
      return false;
    }
    return true;
  }

  async function submit(publish: boolean) {
    if (!validateAll()) return;

    if (publish) setPublishing(true);
    else setSavingDraft(true);

    try {
      const res = await fetch(
        `/api/events/${eventId}/booths/${boothId}/lottery/instant-claim`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: title.trim(),
            description: description.trim() || undefined,
            prizes,
            require_lead_capture: true,
            lead_form_config: { fields: leadFields },
            publish,
          }),
        },
      );

      const json = (await res.json()) as {
        data?: PublishResult;
        error?: string;
      };

      if (!res.ok) throw new Error(json.error ?? "保存失败");

      if (publish) {
        setPublishResult(json.data ?? null);
        toast.success("直接领取已发布，扫码即可参与");
      } else {
        toast.success("草稿已保存");
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

  const previewPanel = publishResult?.interaction ? (
    <div className="flex flex-col items-center gap-4 py-2 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={publishResult.interaction.qr_url}
        alt="互动二维码"
        className="size-48 rounded-lg border border-border bg-surface p-2 shadow-sm"
      />
      <p className="text-sm font-medium text-text-primary">
        互动码：{publishResult.interaction.session_code}
      </p>
      <p className="max-w-xs break-all text-xs text-text-secondary">
        {publishResult.interaction.scan_url}
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <a
          href={publishResult.interaction.qr_url}
          download={`instant-claim-${boothCode}.png`}
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          <Download className="mr-1.5 size-4" />
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
          查看数据
        </Button>
      </div>
    </div>
  ) : (
    <BoothLotteryPreview
      companyName={companyName}
      title={title}
      description={description}
      prizes={prizes}
      requireLeadCapture
      leadFields={leadFields}
      submitLabel="提交并领取"
    />
  );

  return (
    <AdminPage>
      <AdminHeader
        title="创建直接领取"
        description={`${companyName} · ${boothCode} · QUICK-03B 填表必得`}
        breadcrumb={["互动管理", "参与人抽奖", "直接领取"]}
        actions={
          <Link
            href={listHref}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <ArrowLeft className="mr-1.5 size-4" />
            返回列表
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
                placeholder="直接领取活动名称"
                className={creationStyles.titleInput}
              />
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="向参会者说明领取方式"
                className={cn(creationStyles.descriptionInput, "mt-2")}
                rows={2}
              />

              <CreationSection
                hint="礼品与库存"
                description="单一奖品，填写信息必得（库存发完即止）"
              >
                <PrizeListEditor prizes={prizes} onChange={setPrizes} />
              </CreationSection>

              <CreationSection hint="留资表单" description="参会者需填写后才能领取">
                <LeadFormBuilder fields={leadFields} onChange={setLeadFields} />
              </CreationSection>
            </>
          }
          preview={previewPanel}
          footer={
            <LotteryCreationFooter
              saving={publishing}
              savingDraft={savingDraft}
              onSaveDraft={() => void submit(false)}
              onPublish={() => void submit(true)}
              publishLabel="发布并生成二维码"
            />
          }
        />
      </AdminContent>
    </AdminPage>
  );
}
