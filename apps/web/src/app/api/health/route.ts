import { prisma } from "@connectiq/database";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const userCount = await prisma.user.count();
    return NextResponse.json({
      status: "ok",
      database: "connected",
      userCount,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { status: "error", database: "disconnected", error: "Database connection failed" },
      { status: 500 },
    );
  }
}
