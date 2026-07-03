import { prisma, ScanActionType, ScanResult } from "@connectiq/database";
import { parseEventCodeFromScan } from "@/lib/event-code";
import { handleCheckinScan } from "@/lib/scan/handlers/checkin";
import { handlePrizeVerifyScan } from "@/lib/scan/handlers/prize-verify";
import { handleStampScan } from "@/lib/scan/handlers/stamp";
import { buildScanParticipantView } from "@/lib/scan/participant-info";
import { assertScanActionPermission } from "@/lib/scan/permissions";
import {
  isScanExecuteRateLimited,
  SCAN_RATE_LIMIT_MESSAGE,
} from "@/lib/scan/rate-limit";
import { hintFromRawCode, writeScanLog } from "@/lib/scan/scan-log";
import type {
  ScanExecuteInput,
  ScanExecuteResult,
  ScanHandlerContext,
  ScanHandlerOutcome,
} from "@/lib/scan/types";

async function dispatchAction(
  ctx: ScanHandlerContext,
  action: ScanActionType,
): Promise<ScanHandlerOutcome> {
  switch (action) {
    case ScanActionType.CHECKIN:
      return handleCheckinScan(ctx);
    case ScanActionType.STAMP:
      return handleStampScan(ctx);
    case ScanActionType.LOTTERY_VERIFY:
    case ScanActionType.GIFT_VERIFY:
      return handlePrizeVerifyScan(ctx, action);
    default:
      return {
        result: ScanResult.INVALID,
        message: "不支持的扫码动作",
      };
  }
}

type LogContext = {
  eventId: string;
  operatorId: string;
  action: ScanActionType;
  actionRef?: string;
  rawCode: string;
  codeId?: string | null;
};

async function recordAndReturn(
  log: LogContext,
  result: ScanExecuteResult,
): Promise<ScanExecuteResult> {
  await writeScanLog({
    eventId: log.eventId,
    codeId: log.codeId ?? null,
    actionType: log.action,
    actionRef: log.actionRef?.trim() ?? null,
    result: result.result,
    operatorId: log.operatorId,
    codeHint: hintFromRawCode(log.rawCode),
  });
  return result;
}

/** 统一扫码执行：频率限制 → 解析码 → 校验活动 → 权限矩阵 → handler → 审计日志 */
export async function executeScan(
  input: ScanExecuteInput,
): Promise<ScanExecuteResult> {
  const logBase: LogContext = {
    eventId: input.eventId,
    operatorId: input.operatorId,
    action: input.action,
    actionRef: input.actionRef,
    rawCode: input.rawCode,
  };

  if (await isScanExecuteRateLimited(input.operatorId)) {
    return recordAndReturn(logBase, {
      result: ScanResult.INVALID,
      message: SCAN_RATE_LIMIT_MESSAGE,
      participant: null,
    });
  }

  const codeValue = parseEventCodeFromScan(input.rawCode);
  if (!codeValue) {
    return recordAndReturn(logBase, {
      result: ScanResult.INVALID,
      message: "无效的码",
      participant: null,
    });
  }

  const eventCode = await prisma.userEventCode.findUnique({
    where: { code: codeValue },
    select: { id: true, eventId: true, userId: true },
  });

  if (!eventCode) {
    return recordAndReturn(logBase, {
      result: ScanResult.INVALID,
      message: "无效的码",
      participant: null,
    });
  }

  logBase.codeId = eventCode.id;

  if (eventCode.eventId !== input.eventId) {
    const participant = await buildScanParticipantView(
      eventCode.eventId,
      eventCode.userId,
    );
    return recordAndReturn(logBase, {
      result: ScanResult.INVALID,
      message: "非本活动的码",
      participant,
    });
  }

  const permissionDenied = await assertScanActionPermission({
    eventId: input.eventId,
    operatorId: input.operatorId,
    action: input.action,
    actionRef: input.actionRef,
  });

  if (permissionDenied) {
    const participant = await buildScanParticipantView(
      input.eventId,
      eventCode.userId,
    );
    return recordAndReturn(logBase, {
      result: permissionDenied.result,
      message: permissionDenied.message,
      participant,
      actionDetail: permissionDenied.actionDetail,
    });
  }

  const participant = await buildScanParticipantView(
    input.eventId,
    eventCode.userId,
  );

  const ctx: ScanHandlerContext = {
    eventId: input.eventId,
    codeId: eventCode.id,
    attendeeUserId: eventCode.userId,
    operatorId: input.operatorId,
    actionRef: input.actionRef,
    participant,
  };

  const outcome = await dispatchAction(ctx, input.action);

  return recordAndReturn(logBase, {
    result: outcome.result,
    message: outcome.message,
    participant,
    actionDetail: outcome.actionDetail,
  });
}
