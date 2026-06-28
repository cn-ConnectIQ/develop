import { prisma } from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import { ApiError } from "@/lib/api-auth";
import { parseIntentTags } from "@/lib/user-me-service";

export type ApiMobilePublicProfile = {
  id: string;
  name: string;
  avatar_url?: string;
  company?: string;
  title?: string;
  value_proposition?: string;
  seeks?: string[];
  offers?: string[];
  ai_brief?: string;
};

/** 参会者公开名片（无需登录） */
export async function getMobilePublicProfile(
  userId: string,
): Promise<ApiMobilePublicProfile> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      profile: {
        select: {
          company: true,
          industry: true,
          valueProposition: true,
          intentTags: true,
        },
      },
    },
  });

  if (!user) {
    throw new ApiError("用户不存在", ErrorCode.NOT_FOUND, 404);
  }

  const tags = parseIntentTags(user.profile?.intentTags);
  const seeks = tags
    .filter((t) => t.type === "DEMAND")
    .map((t) => t.label);
  const offers = tags
    .filter((t) => t.type === "SUPPLY")
    .map((t) => t.label);

  return {
    id: user.id,
    name: user.name,
    company: user.profile?.company ?? undefined,
    title: user.profile?.valueProposition ?? undefined,
    value_proposition: user.profile?.valueProposition ?? undefined,
    seeks: seeks.length > 0 ? seeks : undefined,
    offers: offers.length > 0 ? offers : undefined,
  };
}
