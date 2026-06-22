import { AiMatchScenario, BoothStatus, prisma } from "@connectiq/database";
import { parseIntentTags } from "@/lib/user-me-service";

const MAX_RECOMMENDED = 6;
const STAY_MINUTES_PER_BOOTH = 8;
const WALK_MINUTES_BETWEEN = 3;
const KEYWORD_MATCH_SCORE = 10;
const AI_MATCH_BOOST = 15;

type BoothRow = {
  id: string;
  name: string;
  code: string;
  positionX: number | null;
  positionY: number | null;
  hallLabel: string | null;
  positionData: unknown;
  companyOrg: {
    name: string;
    bio: string | null;
    industry: string | null;
  };
  hall: { name: string } | null;
};

type ScoredBooth = BoothRow & { score: number };

export type BoothRouteStop = {
  order: number;
  booth_id: string;
  booth_number: string;
  company_name: string;
  hall: string | null;
  position_x: number;
  position_y: number;
  match_reason: string;
  estimated_stay_minutes: number;
};

export type BoothRouteResult = {
  route: BoothRouteStop[];
  total_booths: number;
  estimated_total_minutes: number;
  generated_at: string;
};

function resolvePosition(booth: BoothRow): { x: number; y: number } {
  if (booth.positionX != null && booth.positionY != null) {
    return { x: booth.positionX, y: booth.positionY };
  }
  if (booth.positionData && typeof booth.positionData === "object") {
    const data = booth.positionData as { x?: unknown; y?: unknown };
    if (typeof data.x === "number" && typeof data.y === "number") {
      return { x: data.x, y: data.y };
    }
  }
  return { x: 50, y: 50 };
}

function resolveHall(booth: BoothRow): string | null {
  return booth.hallLabel ?? booth.hall?.name ?? null;
}

function boothSearchText(booth: BoothRow): string {
  return [
    booth.companyOrg.name,
    booth.companyOrg.bio ?? "",
    booth.companyOrg.industry ?? "",
    booth.name,
  ]
    .join(" ")
    .toLowerCase();
}

function scoreBooth(
  booth: BoothRow,
  demandTags: string[],
  aiMatchedCompanies: Set<string>,
): number {
  let score = 0;
  const text = boothSearchText(booth);

  for (const tag of demandTags) {
    const normalized = tag.trim().toLowerCase();
    if (normalized && text.includes(normalized)) {
      score += KEYWORD_MATCH_SCORE;
    }
  }

  if (aiMatchedCompanies.has(booth.companyOrg.name.trim().toLowerCase())) {
    score += AI_MATCH_BOOST;
  }

  return score;
}

function sortByProximity(booths: ScoredBooth[]): ScoredBooth[] {
  if (booths.length <= 1) return booths;

  const sorted: ScoredBooth[] = [booths[0]!];
  const remaining = booths.slice(1);

  while (remaining.length > 0) {
    const last = sorted[sorted.length - 1]!;
    const lastPos = resolvePosition(last);

    let nearestIdx = 0;
    let minDist = Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const candidate = remaining[i]!;
      const pos = resolvePosition(candidate);
      const dx = pos.x - lastPos.x;
      const dy = pos.y - lastPos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < minDist) {
        minDist = dist;
        nearestIdx = i;
      }
    }

    sorted.push(remaining.splice(nearestIdx, 1)[0]!);
  }

  return sorted;
}

function generateMatchReason(booth: BoothRow, demandTags: string[]): string {
  const text = `${booth.companyOrg.name} ${booth.companyOrg.bio ?? ""}`.toLowerCase();
  const matched = demandTags.filter((tag) => {
    const normalized = tag.trim().toLowerCase();
    return normalized && text.includes(normalized);
  });

  if (matched.length === 0) return "综合推荐";
  return `与你「${matched.slice(0, 2).join("、")}」的需求匹配`;
}

async function loadAiMatchedCompanies(
  eventId: string,
  userName: string,
  userCompany: string | null,
): Promise<Set<string>> {
  const matches = await prisma.aiMatchResult.findMany({
    where: {
      eventId,
      scenario: {
        in: [AiMatchScenario.BUYER_TO_EXHIBITOR, AiMatchScenario.EXHIBITOR_TO_BUYER],
      },
      OR: [
        { userAName: userName },
        ...(userCompany ? [{ userACompany: userCompany }] : []),
        { userBName: userName },
        ...(userCompany ? [{ userBCompany: userCompany }] : []),
      ],
    },
    select: {
      userACompany: true,
      userBCompany: true,
      scenario: true,
    },
  });

  const companies = new Set<string>();
  for (const match of matches) {
    if (match.scenario === AiMatchScenario.BUYER_TO_EXHIBITOR) {
      if (match.userBCompany) companies.add(match.userBCompany.trim().toLowerCase());
    } else if (match.userACompany) {
      companies.add(match.userACompany.trim().toLowerCase());
    }
  }
  return companies;
}

export async function generateBoothRoute(
  userId: string,
  eventId: string,
): Promise<BoothRouteResult> {
  const [profile, user, booths] = await Promise.all([
    prisma.userProfile.findUnique({
      where: { userId },
      select: { intentTags: true },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, profile: { select: { company: true } } },
    }),
    prisma.exhibitorBooth.findMany({
      where: {
        eventId,
        status: { in: [BoothStatus.BOOKED, BoothStatus.OCCUPIED] },
      },
      include: {
        companyOrg: {
          select: { name: true, bio: true, industry: true },
        },
        hall: { select: { name: true } },
      },
    }),
  ]);

  const aiMatchedCompanies = await loadAiMatchedCompanies(
    eventId,
    user?.name ?? "",
    user?.profile?.company ?? null,
  );

  const demandTags = parseIntentTags(profile?.intentTags)
    .filter((intent) => intent.type === "DEMAND")
    .map((intent) => intent.label);

  const scored: ScoredBooth[] = booths.map((booth) => ({
    ...booth,
    score: scoreBooth(booth, demandTags, aiMatchedCompanies),
  }));

  const recommended = scored
    .filter((b) => b.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_RECOMMENDED);

  const route = sortByProximity(recommended);
  const estimatedMinutes =
    route.length * STAY_MINUTES_PER_BOOTH +
    Math.max(0, route.length - 1) * WALK_MINUTES_BETWEEN;

  return {
    route: route.map((booth, index) => {
      const pos = resolvePosition(booth);
      return {
        order: index + 1,
        booth_id: booth.id,
        booth_number: booth.code,
        company_name: booth.companyOrg.name,
        hall: resolveHall(booth),
        position_x: pos.x,
        position_y: pos.y,
        match_reason: generateMatchReason(booth, demandTags),
        estimated_stay_minutes: STAY_MINUTES_PER_BOOTH,
      };
    }),
    total_booths: route.length,
    estimated_total_minutes: estimatedMinutes,
    generated_at: new Date().toISOString(),
  };
}
