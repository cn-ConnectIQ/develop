import { z } from "zod";
import {
  AnimationType,
  TriggerAction,
  isProbabilityValid,
  percentToUnit,
} from "@/lib/lottery/probability-lottery-config";

const prizeSchema = z.object({
  name: z.string().min(1).max(100),
  image_url: z.string().optional().nullable(),
  quantity: z.number().int().positive().max(10000),
  /** 0–1 小数概率 */
  probability: z.number().min(0).max(1),
  prize_type: z.enum(["PHYSICAL", "DIGITAL", "EXPERIENCE"]).default("PHYSICAL"),
});

export const createBoothProbabilityLotterySchema = z
  .object({
    title: z.string().min(1).max(200),
    description: z.string().max(2000).optional().nullable(),
    trigger_action: z.enum([
      TriggerAction.FILL_FORM,
      TriggerAction.SURVEY,
      TriggerAction.SCAN_ONLY,
    ]),
    require_poll_id: z.string().cuid().optional().nullable(),
    animation_type: z.enum([
      AnimationType.WHEEL,
      AnimationType.GRID,
      AnimationType.SLOT,
      AnimationType.SPOTLIGHT,
      AnimationType.PACHINKO,
      AnimationType.GIFT_RAIN,
    ]),
    prizes: z.array(prizeSchema).min(1),
    publish: z.boolean().default(false),
  })
  .superRefine((data, ctx) => {
    const sum = data.prizes.reduce((s, p) => s + p.probability, 0);
    if (sum <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "至少为一个奖品分配概率",
        path: ["prizes"],
      });
    }
    if (sum > 1 + 1e-6) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `奖品概率总和不能超过 100%（当前 ${Math.round(sum * 1000) / 10}%）`,
        path: ["prizes"],
      });
    }
    if (data.trigger_action === TriggerAction.SURVEY && !data.require_poll_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "问卷触发需选择关联问卷",
        path: ["require_poll_id"],
      });
    }
  });

export type CreateBoothProbabilityLotteryInput = z.infer<
  typeof createBoothProbabilityLotterySchema
>;

/** 从前端百分比草稿构建 API 输入 */
export function buildProbabilityLotteryPayload(input: {
  title: string;
  description?: string;
  trigger_action: CreateBoothProbabilityLotteryInput["trigger_action"];
  require_poll_id?: string | null;
  animation_type: CreateBoothProbabilityLotteryInput["animation_type"];
  prizes: Array<{
    name: string;
    quantity: number;
    probability_percent: number;
    image_url?: string | null;
    prize_type?: "PHYSICAL" | "DIGITAL" | "EXPERIENCE";
  }>;
  publish: boolean;
}) {
  const prizes = input.prizes.map((p) => ({
    name: p.name,
    quantity: p.quantity,
    probability: percentToUnit(p.probability_percent),
    image_url: p.image_url ?? null,
    prize_type: p.prize_type ?? ("PHYSICAL" as const),
  }));

  if (!isProbabilityValid(input.prizes)) {
    throw new Error("概率配置无效");
  }

  return {
    title: input.title.trim(),
    description: input.description?.trim() || null,
    trigger_action: input.trigger_action,
    require_poll_id:
      input.trigger_action === TriggerAction.SURVEY
        ? input.require_poll_id ?? null
        : null,
    animation_type: input.animation_type,
    prizes,
    publish: input.publish,
  };
}

export { isProbabilityValid, percentToUnit };
