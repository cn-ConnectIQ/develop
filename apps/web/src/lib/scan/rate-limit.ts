import { prisma } from "@connectiq/database";

const MAX_EXECUTES_PER_SECOND = 2;
const WINDOW_MS = 1000;

/**
 * 操作端频率限制：同一操作人员每秒最多 2 次 execute（防扫码枪连击）。
 * 基于 CodeScanLog 计数，多实例部署下仍有效。
 */
export async function isScanExecuteRateLimited(
  operatorId: string,
): Promise<boolean> {
  const since = new Date(Date.now() - WINDOW_MS);
  const count = await prisma.codeScanLog.count({
    where: {
      operatorId,
      scannedAt: { gte: since },
    },
  });
  return count >= MAX_EXECUTES_PER_SECOND;
}

export const SCAN_RATE_LIMIT_MESSAGE = "操作过快，请稍后重试";
