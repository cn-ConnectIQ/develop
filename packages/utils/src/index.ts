import type {
  ApiErrorResponse,
  ApiSuccessResponse,
  ErrorCode,
} from "@connectiq/types";

export function successResponse<T>(
  data: T,
  meta?: ApiSuccessResponse<T>["meta"],
): ApiSuccessResponse<T> {
  return meta ? { data, meta } : { data };
}

export function errorResponse(
  error: string,
  code: ErrorCode,
): ApiErrorResponse {
  return { error, code };
}

export function getRoleDashboardPath(
  role: string,
  entityId?: string | null,
  hasPlatformAdmin = false,
) {
  if (hasPlatformAdmin) return "/platform/overview";
  switch (role) {
    case "PLATFORM_ADMIN":
      return "/platform/overview";
    case "ORGANIZER":
      return entityId ? `/events/${entityId}` : "/events";
    case "EXPO_ORGANIZER":
      return entityId ? `/expos/${entityId}` : "/events";
    case "EXHIBITOR":
      return entityId ? `/exhibitor/booths/${entityId}` : "/events";
    default:
      return "/events";
  }
}
