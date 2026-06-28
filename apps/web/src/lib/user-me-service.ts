import { UserAccountStatus, prisma } from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import { ApiError } from "@/lib/api-auth";

export type ApiMeUser = {
  id: string;
  name: string;
  phone?: string;
  status: UserAccountStatus;
  avatar_url?: string;
  company?: string;
  title?: string;
  industry?: string;
  value_proposition?: string;
  points_balance: number;
};

export type UpdateMeUserInput = {
  name?: string;
  company?: string;
  title?: string;
  industry?: string;
  value_proposition?: string;
  avatar_url?: string;
};

export type ApiProfileIntentTag = {
  id: string;
  label: string;
  type: "SUPPLY" | "DEMAND";
};

const ONBOARD_INTENT_MAP: Record<
  string,
  { label: string; type: "SUPPLY" | "DEMAND" }
> = {
  PARTNER: { label: "寻找合作伙伴", type: "DEMAND" },
  PROCUREMENT: { label: "采购/评估产品", type: "DEMAND" },
  INVESTMENT: { label: "寻找投融资", type: "DEMAND" },
  NETWORK: { label: "扩大人脉", type: "DEMAND" },
  SALES: { label: "销售/推广产品", type: "SUPPLY" },
};

function inferIntentFromString(raw: string, index: number): ApiProfileIntentTag {
  const mapped = ONBOARD_INTENT_MAP[raw];
  if (mapped) {
    return { id: raw, label: mapped.label, type: mapped.type };
  }

  const supplyKeywords = /ERP|CRM|SaaS|系统|软件|提供|营销自动化/i;
  const demandKeywords = /渠道|代理|采购|寻找|合作|投资|伙伴/i;

  if (supplyKeywords.test(raw)) {
    const label = raw.includes("提供") ? raw : `能提供 ${raw}${raw.length <= 4 ? " 系统" : ""}`;
    return { id: `supply-${index}-${raw}`, label, type: "SUPPLY" };
  }
  if (demandKeywords.test(raw)) {
    const label = raw.includes("寻找") ? raw : `寻找${raw}`;
    return { id: `demand-${index}-${raw}`, label, type: "DEMAND" };
  }

  return index % 2 === 0
    ? { id: `supply-${index}-${raw}`, label: `能提供 ${raw}`, type: "SUPPLY" }
    : { id: `demand-${index}-${raw}`, label: `寻找${raw}`, type: "DEMAND" };
}

export function parseIntentTags(value: unknown): ApiProfileIntentTag[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item, index) => {
    if (typeof item === "string") {
      return [inferIntentFromString(item, index)];
    }
    if (item && typeof item === "object") {
      const row = item as Record<string, unknown>;
      const label = typeof row.label === "string" ? row.label : "";
      const type = row.type === "SUPPLY" || row.type === "DEMAND" ? row.type : null;
      const id =
        typeof row.id === "string" ? row.id : `intent-${index}-${label || "tag"}`;
      if (label && type) {
        return [{ id, label, type }];
      }
      if (label) {
        return [inferIntentFromString(label, index)];
      }
    }
    return [];
  });
}

export async function fetchMeUser(userId: string): Promise<ApiMeUser> {
  const [user, avatarUrl] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    }),
    loadLatestAvatarUrl(userId),
  ]);

  if (!user) {
    throw new ApiError("用户不存在", ErrorCode.NOT_FOUND, 404);
  }

  return mapMeUser(user, avatarUrl);
}

export async function fetchMeIntents(userId: string): Promise<ApiProfileIntentTag[]> {
  const profile = await prisma.userProfile.findUnique({
    where: { userId },
    select: { intentTags: true },
  });

  return parseIntentTags(profile?.intentTags);
}

export async function saveMeIntents(
  userId: string,
  intents: unknown,
  options?: { markActive?: boolean },
): Promise<ApiProfileIntentTag[]> {
  const normalized = parseIntentTags(intents);

  await prisma.userProfile.upsert({
    where: { userId },
    create: {
      userId,
      intentTags: normalized,
      accountStatus: options?.markActive
        ? UserAccountStatus.ACTIVE
        : UserAccountStatus.ACTIVE,
    },
    update: {
      intentTags: normalized,
      ...(options?.markActive ? { accountStatus: UserAccountStatus.ACTIVE } : {}),
    },
  });

  return normalized;
}

async function loadLatestAvatarUrl(userId: string): Promise<string | undefined> {
  const map = await loadLatestAvatarUrlMap([userId]);
  return map.get(userId);
}

/** 批量取用户最新头像 URL（每人一条，按 createdAt 降序） */
export async function loadLatestAvatarUrlMap(
  userIds: string[],
): Promise<Map<string, string>> {
  const uniqueIds = [...new Set(userIds.filter(Boolean))];
  if (uniqueIds.length === 0) return new Map();

  const assets = await prisma.fileAsset.findMany({
    where: {
      uploaderId: { in: uniqueIds },
      mimeType: { startsWith: "image/" },
    },
    orderBy: { createdAt: "desc" },
    select: { uploaderId: true, url: true },
  });

  const map = new Map<string, string>();
  for (const asset of assets) {
    if (!map.has(asset.uploaderId)) {
      map.set(asset.uploaderId, asset.url);
    }
  }
  return map;
}

type UserWithProfile = {
  id: string;
  name: string;
  phone: string | null;
  profile: {
    accountStatus: UserAccountStatus;
    company: string | null;
    industry: string | null;
    valueProposition: string | null;
    pointsBalance: number;
  } | null;
};

function mapMeUser(user: UserWithProfile, avatarUrl?: string): ApiMeUser {
  return {
    id: user.id,
    name: user.name,
    phone: user.phone ?? undefined,
    status: user.profile?.accountStatus ?? UserAccountStatus.ACTIVE,
    avatar_url: avatarUrl,
    company: user.profile?.company ?? undefined,
    title: user.profile?.valueProposition ?? undefined,
    industry: user.profile?.industry ?? undefined,
    value_proposition: user.profile?.valueProposition ?? undefined,
    points_balance: user.profile?.pointsBalance ?? 0,
  };
}

export async function updateMeUser(
  userId: string,
  input: UpdateMeUserInput,
): Promise<ApiMeUser> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { profile: true },
  });

  if (!user) {
    throw new ApiError("用户不存在", ErrorCode.NOT_FOUND, 404);
  }

  if (input.name?.trim()) {
    await prisma.user.update({
      where: { id: userId },
      data: { name: input.name.trim() },
    });
  }

  const profileUpdate: {
    company?: string | null;
    industry?: string | null;
    valueProposition?: string | null;
    accountStatus?: UserAccountStatus;
  } = {};

  if (input.company !== undefined) profileUpdate.company = input.company.trim() || null;
  if (input.industry !== undefined) profileUpdate.industry = input.industry.trim() || null;
  const title = input.title ?? input.value_proposition;
  if (title !== undefined) profileUpdate.valueProposition = title.trim() || null;

  const hasProfileFields =
    Boolean(input.company?.trim()) ||
    Boolean(title?.trim()) ||
    Boolean(input.industry?.trim());

  if (hasProfileFields) {
    profileUpdate.accountStatus = UserAccountStatus.ACTIVE;
  }

  if (Object.keys(profileUpdate).length > 0) {
    await prisma.userProfile.upsert({
      where: { userId },
      create: {
        userId,
        ...profileUpdate,
        accountStatus: profileUpdate.accountStatus ?? UserAccountStatus.ACTIVE,
      },
      update: profileUpdate,
    });
  }

  if (input.avatar_url?.trim()) {
    const url = input.avatar_url.trim();
    await prisma.fileAsset.create({
      data: {
        uploaderId: userId,
        url,
        filename: url.split("/").pop() ?? "avatar",
        mimeType: "image/jpeg",
        size: 0,
      },
    });
  }

  return fetchMeUser(userId);
}
