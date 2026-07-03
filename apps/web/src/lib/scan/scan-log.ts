import {
  prisma,
  ScanActionType,
  ScanResult,
  type Prisma,
} from "@connectiq/database";
import { eventCodeHint } from "@/lib/event-code";

type DbClient = Prisma.TransactionClient | typeof prisma;

export type ScanLogInput = {
  operatorId: string;
  actionType: ScanActionType;
  result: ScanResult;
  eventId?: string | null;
  codeId?: string | null;
  actionRef?: string | null;
  codeHint?: string | null;
};

/** 写入扫码审计日志（含 INVALID / NO_PERMISSION 等失败场景） */
export async function writeScanLog(
  input: ScanLogInput,
  db: DbClient = prisma,
): Promise<void> {
  await db.codeScanLog.create({
    data: {
      eventId: input.eventId ?? undefined,
      codeId: input.codeId ?? undefined,
      actionType: input.actionType,
      actionRef: input.actionRef ?? undefined,
      result: input.result,
      operatorId: input.operatorId,
      codeHint: input.codeHint ?? undefined,
    },
  });
}

export function hintFromRawCode(rawCode: string): string {
  return eventCodeHint(rawCode);
}
