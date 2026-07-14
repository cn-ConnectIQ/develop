import { NextRequest, NextResponse } from "next/server";
import {
  parseSceneParam,
  resolveAndClickShortLink,
} from "@/lib/notification/short-link-service";

export const dynamic = "force-dynamic";

async function handleShortLink(sceneRaw: string, token: string) {
  const scene = parseSceneParam(sceneRaw);
  if (!scene || !token) {
    return NextResponse.json({ error: "无效短链" }, { status: 404 });
  }

  const result = await resolveAndClickShortLink(token);
  if (!result) {
    return NextResponse.json({ error: "短链不存在" }, { status: 404 });
  }
  if (result.expired) {
    return NextResponse.json({ error: "短链已过期" }, { status: 410 });
  }
  if (result.row.scene !== scene) {
    return NextResponse.json({ error: "场景不匹配" }, { status: 404 });
  }

  return NextResponse.redirect(result.row.targetUrl, 302);
}

export function createShortLinkGet(scene: string) {
  return async (
    _request: NextRequest,
    context: { params: Promise<{ token: string }> },
  ) => {
    const { token } = await context.params;
    return handleShortLink(scene, token);
  };
}
