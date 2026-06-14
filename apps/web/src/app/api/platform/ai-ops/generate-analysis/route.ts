import { prisma } from "@connectiq/database";
import {
  createSuccessResponse,
  requirePlatformAdmin,
  withErrorHandler,
} from "@/lib/api-auth";
import { fetchFeedbackStats } from "@/lib/ai-ops-data";
import { generateFeedbackAnalysis } from "@/lib/claude";

export const POST = withErrorHandler(async () => {
  await requirePlatformAdmin();

  const stats = await fetchFeedbackStats();
  const text = await generateFeedbackAnalysis({
    total: stats.overview.total,
    positiveRate: stats.overview.positiveRate,
    negativeReasons: stats.negativeReasons,
    typeDistribution: stats.typeDistribution,
  });

  const record = await prisma.aiFeedbackAnalysis.create({
    data: {
      text,
      basedOn: stats.overview.total,
    },
  });

  return createSuccessResponse({
    text: record.text,
    generatedAt: record.generatedAt.toISOString().slice(0, 10),
    basedOn: record.basedOn,
  });
});
