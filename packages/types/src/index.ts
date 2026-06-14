export const UserRole = {
  PLATFORM_ADMIN: "PLATFORM_ADMIN",
  ORGANIZER: "ORGANIZER",
  EXPO_ORGANIZER: "EXPO_ORGANIZER",
  EXHIBITOR: "EXHIBITOR",
} as const;

export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const ErrorCode = {
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export type ApiSuccessResponse<T> = {
  data: T;
  meta?: {
    total?: number;
    page?: number;
    cursor?: string | null;
  };
};

export type ApiErrorResponse = {
  error: string;
  code: ErrorCode;
};

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  entityId: string | null;
};
