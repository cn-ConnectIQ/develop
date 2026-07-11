import { NextRequest, NextResponse } from "next/server";
import { getWxMpCallbackToken } from "@/lib/wechat/config";
import {
  buildWechatTextReply,
  parseWechatXml,
  verifyMpCallbackSignature,
} from "@/lib/wechat/mp-oauth";
import {
  handleMpSubscribe,
  handleMpUnsubscribe,
} from "@/lib/wechat/mp-service";

export const runtime = "nodejs";

function verifyRequest(request: NextRequest): boolean {
  const token = getWxMpCallbackToken();
  if (!token) return false;

  const signature = request.nextUrl.searchParams.get("signature") ?? "";
  const timestamp = request.nextUrl.searchParams.get("timestamp") ?? "";
  const nonce = request.nextUrl.searchParams.get("nonce") ?? "";

  return verifyMpCallbackSignature({ token, timestamp, nonce, signature });
}

/** 服务号消息服务器 URL 校验 + 事件推送（明文模式） */
export async function GET(request: NextRequest) {
  if (!verifyRequest(request)) {
    return new NextResponse("invalid signature", { status: 403 });
  }

  const echostr = request.nextUrl.searchParams.get("echostr") ?? "";
  return new NextResponse(echostr, {
    status: 200,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

export async function POST(request: NextRequest) {
  if (!verifyRequest(request)) {
    return new NextResponse("invalid signature", { status: 403 });
  }

  const raw = await request.text();
  const msg = parseWechatXml(raw);
  const msgType = msg.MsgType;
  const event = msg.Event;
  const fromUser = msg.FromUserName;
  const toUser = msg.ToUserName;

  if (msgType === "event" && fromUser) {
    if (event === "subscribe") {
      await handleMpSubscribe(fromUser, msg.EventKey);
      if (toUser) {
        const reply = buildWechatTextReply({
          toUser: fromUser,
          fromUser: toUser,
          content: "欢迎关注 玖莅，进入小程序即可参与活动现场互动。",
        });
        return new NextResponse(reply, {
          status: 200,
          headers: { "Content-Type": "application/xml; charset=utf-8" },
        });
      }
    }

    if (event === "unsubscribe") {
      await handleMpUnsubscribe(fromUser);
    }
  }

  return new NextResponse("success", {
    status: 200,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
