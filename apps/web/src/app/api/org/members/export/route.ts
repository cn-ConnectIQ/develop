import { z } from "zod";
import {
  requireAccountAdmin,
  withErrorHandler,
} from "@/lib/api-auth";
import { exportOrgMembersExcel } from "@/lib/org-member-service";

const bodySchema = z.object({
  user_ids: z.array(z.string()).optional(),
});

export const POST = withErrorHandler(async (request) => {
  const auth = await requireAccountAdmin(request);
  if ("error" in auth) {
    return auth.error;
  }

  let userIds: string[] | undefined;
  try {
    const json = await request.json();
    const parsed = bodySchema.safeParse(json);
    if (parsed.success) {
      userIds = parsed.data.user_ids;
    }
  } catch {
    // empty body = export all
  }

  const buffer = await exportOrgMembersExcel(auth.orgId, userIds);
  const filename = encodeURIComponent("用户池导出.xlsx");

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${filename}`,
    },
  });
});
