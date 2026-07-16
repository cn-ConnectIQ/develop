import { prisma } from "@connectiq/database";
import { NextResponse } from "next/server";
import { getQiniuStatus } from "@/lib/storage/qiniu";

export async function GET() {
  const checks: Record<string, string> = {};
  const qiniu = getQiniuStatus();

  try {
    const userCount = await prisma.user.count();
    checks.users = "ok";

    try {
      await prisma.event.findFirst({
        select: {
          id: true,
          activityType: true,
          featureFlags: true,
          shortName: true,
        },
      });
      checks.events_schema = "ok";
    } catch (schemaError) {
      checks.events_schema = "failed";
      checks.events_schema_error =
        schemaError instanceof Error
          ? schemaError.message.slice(0, 240)
          : "unknown";
      console.error("[health] events schema probe failed:", schemaError);
    }

    try {
      await prisma.notificationJob.findFirst({
        select: { id: true },
        take: 1,
      });
      checks.notification_schema = "ok";
    } catch (schemaError) {
      checks.notification_schema = "missing";
      checks.notification_schema_hint =
        "执行 packages/database/scripts/migrate-notification-p0.sql 或 POST /api/platform/db-schema-sync";
      console.error("[health] notification schema probe failed:", schemaError);
    }

    checks.qiniu = qiniu.configured ? "ok" : "missing";

    return NextResponse.json({
      status:
        checks.events_schema === "failed" ||
        checks.notification_schema === "missing"
          ? "degraded"
          : "ok",
      database: "connected",
      userCount,
      checks,
      /** 不含密钥；用于确认生产是否注入了 QINIU_* */
      qiniu,
      authUrl: process.env.NEXTAUTH_URL ?? null,
    });
  } catch (error) {
    console.error("[health] database probe failed:", error);
    const message =
      error instanceof Error ? error.message : "Database connection failed";
    return NextResponse.json(
      {
        status: "error",
        database: "disconnected",
        error: message,
        hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
        hasNextAuthSecret: Boolean(process.env.NEXTAUTH_SECRET),
        qiniu,
        authUrl: process.env.NEXTAUTH_URL ?? null,
      },
      { status: 500 },
    );
  }
}
