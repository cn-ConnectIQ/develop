/** 认领页可用的轻量类型（勿引入 database / prisma，以免进 Client Bundle） */
export type InviteResolveResult =
  | { kind: "invalid" | "expired" }
  | {
      kind: "ok";
      token: string;
      event: {
        id: string;
        name: string;
        short_name: string | null;
        location: string | null;
        start_date: string | null;
        end_date: string | null;
        status: string;
      };
      invitee: {
        user_id: string | null;
        name: string;
        honorific: string;
        company: string | null;
      };
      is_activated: boolean;
      is_returning: boolean;
      identity_match: boolean | null;
      session_user_id: string | null;
      needs_intent: boolean;
      mp_url_link: string | null;
      /** 服务端下发，避免依赖 NEXT_PUBLIC_WX_MINI_APPID 构建注入 */
      mini_app_id: string | null;
      entry_token: string | null;
      mp_launch_error: string | null;
      wxacode_url: string | null;
      mini_path: string;
      app_join_fallback: string;
    };
