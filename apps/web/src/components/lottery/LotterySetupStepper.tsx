"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LotteryDrawType } from "@/lib/lottery/lottery-enums";
import { ArrowLeft, ArrowRight, Check, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  AdminContent,
  AdminHeader,
  AdminPage,
  SectionCard,
} from "@/components/admin/admin-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { LeadFormBuilder } from "@/components/lead-form/LeadFormBuilder";
import { LeadFormRenderer } from "@/components/lead-form/LeadFormRenderer";
import { DrawTypeSelector } from "@/components/lottery/DrawTypeSelector";
import { PrizeListEditor } from "@/components/lottery/PrizeListEditor";
import {
  createFieldFromPreset,
  LEAD_FORM_FIELD_PRESETS,
} from "@/lib/lead-form/templates";
import type { LeadFormField } from "@/lib/lead-form/types";
import type { BoothLotteryPrizeDraft } from "@/lib/lottery/booth-lottery-schemas";
import { cn } from "@/lib/utils";

const STEPS = ["奖品设置", "参与规则", "生成互动码"] as const;

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
  const [step, setStep] = useState(0);
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
  const [publishing, setPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState<PublishResult | null>(null);

  function validateStep(index: number): boolean {
    if (index === 0) {
      if (!title.trim()) {
        toast.error("请填写抽奖名称");
        return false;
      }
      if (prizes.some((p) => !p.name.trim())) {
        toast.error("请填写所有奖品名称");
        return false;
      }
    }
    if (index === 1) {
      if (drawType === LotteryDrawType.SCHEDULED && !drawAt) {
        toast.error("请设置定时开奖时间");
        return false;
      }
      if (requireLeadCapture && leadFields.length === 0) {
        toast.error("请至少配置一个留资字段");
        return false;
      }
    }
    return true;
  }

  function goNext() {
    if (!validateStep(step)) return;
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  async function handlePublish() {
    if (!validateStep(0) || !validateStep(1)) return;

    setPublishing(true);
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
          publish: true,
        }),
      });

      const json = (await res.json()) as {
        data?: PublishResult;
        error?: string;
      };

      if (!res.ok) {
        throw new Error(json.error ?? "发布失败");
      }

      setPublishResult(json.data ?? null);
      toast.success("抽奖已发布");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "发布失败");
    } finally {
      setPublishing(false);
    }
  }

  const topPrize = prizes[0];

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

      <AdminContent>
        <div className="mb-8 flex items-center gap-2">
          {STEPS.map((label, index) => (
            <div key={label} className="flex flex-1 items-center gap-2">
              <div
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                  index < step
                    ? "bg-brand-green text-white"
                    : index === step
                      ? "bg-brand-blue text-white"
                      : "bg-gray-100 text-text-muted",
                )}
              >
                {index < step ? <Check className="size-4" /> : index + 1}
              </div>
              <span
                className={cn(
                  "hidden text-sm sm:inline",
                  index === step ? "font-semibold" : "text-text-muted",
                )}
              >
                {label}
              </span>
              {index < STEPS.length - 1 && (
                <div className="mx-1 hidden h-px flex-1 bg-border-light sm:block" />
              )}
            </div>
          ))}
        </div>

        {step === 0 && (
          <SectionCard title="奖品设置" description="配置奖项名称、数量与类型">
            <div className="mb-6 grid gap-4 md:grid-cols-2">
              <div>
                <Label className="text-xs">抽奖名称</Label>
                <Input
                  className="mt-1"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs">说明（可选）</Label>
                <Textarea
                  className="mt-1 min-h-[42px] resize-none"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="向参会者展示的抽奖说明"
                />
              </div>
            </div>
            <PrizeListEditor prizes={prizes} onChange={setPrizes} />
          </SectionCard>
        )}

        {step === 1 && (
          <div className="space-y-6">
            <SectionCard title="开奖方式" description="选择适合现场场景的开奖模式">
              <DrawTypeSelector
                value={drawType}
                onChange={setDrawType}
                drawAt={drawAt}
                onDrawAtChange={setDrawAt}
              />
            </SectionCard>

            <SectionCard title="留资设置" description="控制参会者参与前是否需要填写信息">
              <div className="mb-4 flex items-center justify-between rounded-lg border border-border-light px-4 py-3">
                <div>
                  <p className="text-sm font-medium">需要留资才能参与</p>
                  <p className="text-xs text-text-muted">
                    开启后参会者需先填写表单，数据写入展位线索
                  </p>
                </div>
                <Switch
                  checked={requireLeadCapture}
                  onCheckedChange={setRequireLeadCapture}
                />
              </div>

              {requireLeadCapture && (
                <LeadFormBuilder
                  fields={leadFields}
                  onChange={setLeadFields}
                  previewTitle={title}
                />
              )}
            </SectionCard>

            <SectionCard title="参与次数" description="限制每位参会者可参与的次数">
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setUnlimitedEntries(false)}
                  className={cn(
                    "flex-1 rounded-lg border-2 px-4 py-3 text-sm font-medium transition-colors",
                    !unlimitedEntries
                      ? "border-brand-blue bg-brand-blue-light/20 text-brand-blue"
                      : "border-border-light",
                  )}
                >
                  每人 1 次
                </button>
                <button
                  type="button"
                  onClick={() => setUnlimitedEntries(true)}
                  className={cn(
                    "flex-1 rounded-lg border-2 px-4 py-3 text-sm font-medium transition-colors",
                    unlimitedEntries
                      ? "border-brand-blue bg-brand-blue-light/20 text-brand-blue"
                      : "border-border-light",
                  )}
                >
                  不限次数
                </button>
              </div>
            </SectionCard>
          </div>
        )}

        {step === 2 && (
          <div className="grid gap-6 xl:grid-cols-2">
            <SectionCard
              title="参会者预览"
              description="发布后参会者扫码看到的抽奖页面"
            >
              <div className="mx-auto w-[375px] overflow-hidden rounded-3xl border-8 border-gray-800 bg-white shadow-xl">
                <div className="bg-gray-800 px-4 py-2 text-center">
                  <div className="mx-auto h-1 w-16 rounded-full bg-gray-600" />
                </div>
                <div className="max-h-[640px] overflow-y-auto p-5">
                  <div className="mb-4 text-center">
                    <p className="text-xs text-text-muted">{companyName}</p>
                    <p className="text-base font-semibold">{title}</p>
                    {topPrize && (
                      <p className="mt-1 text-sm text-brand-red">
                        {topPrize.name} × {topPrize.quantity}
                      </p>
                    )}
                  </div>

                  {requireLeadCapture ? (
                    <LeadFormRenderer
                      fields={leadFields}
                      title="填写信息参与抽奖"
                      submitLabel={
                        drawType === LotteryDrawType.INSTANT
                          ? "提交并立即抽奖"
                          : "提交并参与"
                      }
                      user={{
                        name: "张三",
                        phone: "138****8888",
                        company: "示例科技",
                        title: "采购经理",
                      }}
                      onSubmit={() => undefined}
                    />
                  ) : (
                    <Button className="w-full bg-brand-blue hover:bg-brand-blue/90">
                      {drawType === LotteryDrawType.INSTANT
                        ? "立即抽奖"
                        : "参与抽奖"}
                    </Button>
                  )}
                </div>
              </div>
            </SectionCard>

            <SectionCard
              title="展位互动码"
              description="发布后将生成专属二维码，可打印张贴于展位"
            >
              {publishResult?.interaction ? (
                <div className="flex flex-col items-center gap-4 py-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={publishResult.interaction.qr_url}
                    alt="互动二维码"
                    className="size-56 rounded-xl border border-border-light bg-white p-2"
                  />
                  <p className="text-sm font-medium">
                    互动码：{publishResult.interaction.session_code}
                  </p>
                  <p className="max-w-sm break-all text-center text-xs text-text-muted">
                    {publishResult.interaction.scan_url}
                  </p>
                  <div className="flex gap-2">
                    <a
                      href={publishResult.interaction.qr_url}
                      download={`lottery-${boothCode}.png`}
                      className="inline-flex h-9 items-center rounded-lg border border-border-light px-4 text-sm hover:bg-gray-50"
                    >
                      <Download className="mr-2 size-4" />
                      下载二维码
                    </a>
                    <Button
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
                <div className="flex flex-col items-center gap-4 py-8">
                  <p className="text-sm text-text-muted">
                    确认配置无误后，点击下方按钮发布抽奖并生成互动码
                  </p>
                  <Button
                    size="lg"
                    className="bg-brand-red hover:bg-brand-red/90"
                    disabled={publishing}
                    onClick={() => void handlePublish()}
                  >
                    {publishing ? (
                      <>
                        <Loader2 className="mr-2 size-4 animate-spin" />
                        发布中…
                      </>
                    ) : (
                      "发布抽奖"
                    )}
                  </Button>
                </div>
              )}
            </SectionCard>
          </div>
        )}

        <div className="mt-8 flex items-center justify-between border-t border-border-light pt-6">
          <Button
            variant="outline"
            disabled={step === 0 || publishing}
            onClick={() => setStep((s) => Math.max(s - 1, 0))}
          >
            <ArrowLeft className="mr-2 size-4" />
            上一步
          </Button>

          {step < STEPS.length - 1 ? (
            <Button onClick={goNext}>
              下一步
              <ArrowRight className="ml-2 size-4" />
            </Button>
          ) : !publishResult ? (
            <Button
              className="bg-brand-red hover:bg-brand-red/90"
              disabled={publishing}
              onClick={() => void handlePublish()}
            >
              {publishing ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  发布中…
                </>
              ) : (
                "发布抽奖"
              )}
            </Button>
          ) : null}
        </div>
      </AdminContent>
    </AdminPage>
  );
}
