import { prisma } from "@connectiq/database";
import { NextResponse } from "next/server";

export async function GET() {
  const checks: Record<string, string> = {};

  try {
    const userCount = await prisma.user.count();
    checks.users = "ok";

    try {
      await prisma.event.findFirst({
        select: {
          id: true,
          activityType: true,
          featureFlags: true,
        },
      });
      checks.events_schema = "ok";
    } catch (schemaError) {
      checks.events_schema = "failed";
      console.error("[health] events schema probe failed:", schemaError);
    }

    return NextResponse.json({
      status: checks.events_schema === "failed" ? "degraded" : "ok",
      database: "connected",
      userCount,
      checks,
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
        authUrl: process.env.NEXTAUTH_URL ?? null,
      },
      { status: 500 },
    );
  }
}
