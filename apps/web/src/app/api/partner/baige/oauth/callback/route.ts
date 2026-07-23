import {
  completeBaigeOAuthCallback,
  BaigeOAuthError,
} from "@/lib/integrations/baige-oauth";
import { BaigeConnectionError } from "@/lib/integrations/baige-connection-service";
import { withPublicPath } from "@/lib/public-path";
import { withErrorHandler } from "@/lib/api-auth";

function redirectWithQuery(path: string, query: Record<string, string>) {
  const base = withPublicPath(path);
  const qs = new URLSearchParams(query).toString();
  return Response.redirect(`${base}?${qs}`, 302);
}

export const GET = withErrorHandler(async (request) => {
  const url = new URL(request.url);
  const code = url.searchParams.get("code")?.trim() ?? "";
  const state = url.searchParams.get("state")?.trim() ?? "";
  const oauthError = url.searchParams.get("error");

  if (oauthError) {
    return redirectWithQuery("/integrations/baige", {
      baige_oauth: "denied",
      reason: oauthError,
    });
  }

  if (!code || !state) {
    return redirectWithQuery("/integrations/baige", {
      baige_oauth: "error",
      reason: "missing_code",
    });
  }

  try {
    await completeBaigeOAuthCallback({ code, state });
    return redirectWithQuery("/integrations/baige", {
      baige_oauth: "success",
    });
  } catch (error) {
    const reason =
      error instanceof BaigeOAuthError || error instanceof BaigeConnectionError
        ? error.code
        : "callback_failed";
    console.error("[baige-oauth-callback]", error);
    return redirectWithQuery("/integrations/baige", {
      baige_oauth: "error",
      reason,
    });
  }
});
