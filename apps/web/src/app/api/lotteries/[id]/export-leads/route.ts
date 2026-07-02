import { ErrorCode } from "@connectiq/types";
import { NextResponse } from "next/server";
import { createErrorResponse, withErrorHandler } from "@/lib/api-auth";
import {
  buildLotteryLeadsExport,
  syncLotteryLeadsToMarketup,
} from "@/lib/lottery/lottery-dashboard-service";

export const GET = withErrorHandler(async (request, context) => {
  const lotteryId = context?.params?.id;
  if (!lotteryId) {
    return createErrorResponse("缺少抽奖 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  const { searchParams } = new URL(request.url);
  if (searchParams.get("sync") === "marketup") {
    const result = await syncLotteryLeadsToMarketup(lotteryId);
    return NextResponse.json({ data: result });
  }

  const { csv, filename } = await buildLotteryLeadsExport(lotteryId);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
});
