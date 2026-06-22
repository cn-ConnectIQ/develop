import { ErrorCode } from "@connectiq/types";
import { z } from "zod";
import {
  createErrorResponse,
  createSuccessResponse,
  requireAccountAdmin,
  withErrorHandler,
} from "@/lib/api-auth";
import {
  ORG_COMPANY_SIZE_OPTIONS,
  ORG_INDUSTRY_OPTIONS,
} from "@/lib/org-profile-constants";
import { getOrgProfile, updateOrgProfile } from "@/lib/org-profile-service";

const patchSchema = z.object({
  slug: z.string().optional(),
  bio: z.string().nullable().optional(),
  website: z.string().nullable().optional(),
  contact_email: z.string().nullable().optional(),
  logo_url: z.string().nullable().optional(),
  cover_url: z.string().nullable().optional(),
  industry: z
    .string()
    .nullable()
    .optional()
    .refine(
      (v) => !v || (ORG_INDUSTRY_OPTIONS as readonly string[]).includes(v),
      "请选择有效行业",
    ),
  company_size: z
    .string()
    .nullable()
    .optional()
    .refine(
      (v) =>
        !v ||
        ORG_COMPANY_SIZE_OPTIONS.some((o) => o.value === v),
      "请选择有效规模",
    ),
  headquarters: z.string().nullable().optional(),
  founded_year: z.number().int().nullable().optional(),
});

export const GET = withErrorHandler(async (request) => {
  const auth = await requireAccountAdmin(request);
  if ("error" in auth) {
    return auth.error;
  }

  const profile = await getOrgProfile(auth.orgId);
  if (!profile) {
    return createErrorResponse("组织不存在", ErrorCode.NOT_FOUND, 404);
  }

  return createSuccessResponse(profile);
});

export const PATCH = withErrorHandler(async (request) => {
  const auth = await requireAccountAdmin(request);
  if ("error" in auth) {
    return auth.error;
  }

  const body = await request.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return createErrorResponse(
      parsed.error.issues[0]?.message ?? "参数错误",
      ErrorCode.VALIDATION_ERROR,
      400,
    );
  }

  try {
    const updated = await updateOrgProfile(auth.orgId, {
      slug: parsed.data.slug,
      bio: parsed.data.bio,
      website: parsed.data.website,
      contactEmail: parsed.data.contact_email,
      logoUrl: parsed.data.logo_url,
      coverUrl: parsed.data.cover_url,
      industry: parsed.data.industry,
      companySize: parsed.data.company_size,
      headquarters: parsed.data.headquarters,
      foundedYear: parsed.data.founded_year,
    });

    if (!updated) {
      return createErrorResponse("组织不存在", ErrorCode.NOT_FOUND, 404);
    }

    return createSuccessResponse(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : "保存失败";
    return createErrorResponse(message, ErrorCode.VALIDATION_ERROR, 400);
  }
});
