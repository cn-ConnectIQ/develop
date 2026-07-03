import { z } from "zod";
import {
  CUSTOM_STAMP_POINT_TYPES,
  isBoothStampPoint,
  normalizeStampPoint,
  type StampPointConfig,
} from "@/lib/stamp/stamp-rally-config";

export const stampPointTypeSchema = z.enum([
  "BOOTH",
  "SPONSOR_AREA",
  "SESSION",
  "PHOTO_WALL",
  "CUSTOM",
]);

export const stampPointSchema = z
  .object({
    point_type: stampPointTypeSchema.default("BOOTH"),
    booth_id: z.string().min(1).optional().nullable(),
    custom_name: z.string().max(100).optional().nullable(),
    location: z.string().max(200).optional().nullable(),
    name: z.string().max(100).optional(),
    icon: z.string().max(500).optional().nullable(),
    weight: z.number().int().min(1).max(3),
    required: z.boolean(),
    stamp_id: z.string().min(1).optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.point_type === "BOOTH") {
      if (!data.booth_id?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "展位打卡点需选择展位",
          path: ["booth_id"],
        });
      }
      return;
    }

    if (!CUSTOM_STAMP_POINT_TYPES.includes(data.point_type)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "无效的打卡点类型",
        path: ["point_type"],
      });
    }

    const customName = data.custom_name?.trim() || data.name?.trim();
    if (!customName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "自定义打卡点名称必填",
        path: ["custom_name"],
      });
    }
  })
  .transform((data): StampPointConfig => normalizeStampPoint(data));

export function parseStampPointsInput(
  boothStamps: StampPointConfig[] | undefined,
  boothIds?: string[],
): StampPointConfig[] {
  const points = boothStamps?.map((item) => normalizeStampPoint(item)) ?? [];
  if (points.length === 0) {
    throw new Error("请至少添加一个打卡点");
  }

  for (const point of points) {
    if (isBoothStampPoint(point) && point.booth_id) {
      if (boothIds?.length && !boothIds.includes(point.booth_id)) {
        throw new Error("打卡点与展位列表不一致");
      }
    }
  }

  return points;
}

export function deriveBoothIdsFromInput(
  stampPoints: StampPointConfig[],
  boothIds?: string[],
): string[] {
  if (boothIds?.length) return boothIds;
  return stampPoints
    .filter((p) => isBoothStampPoint(p) && p.booth_id)
    .map((p) => p.booth_id!);
}
