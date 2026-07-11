import { NextResponse } from "next/server";

/** 云托管存活探针：不访问数据库，仅确认 Node 进程与 Next 已就绪 */
export async function GET() {
  return NextResponse.json({ status: "ok", service: "connectiq-web" });
}
