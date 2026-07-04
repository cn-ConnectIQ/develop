import type { NavGroup, NavItem, NavSubItem } from "@/config/navigation";
import type { EventFeatureFlagKey, EventFeatureFlags } from "@/lib/event-feature-flags";

type NavFlagRule = {
  flag: EventFeatureFlagKey;
  pathIncludes?: string;
  hashIncludes?: string;
  labelIncludes?: string;
};

/** 整组导航在 flag 关闭时隐藏 */
const NAV_GROUP_FLAG_RULES: Array<{
  groupLabel: string;
  flag: EventFeatureFlagKey;
}> = [{ groupLabel: "Speed Networking", flag: "speedNetworking" }];

/** 单条导航在 flag 关闭时隐藏（按 href / hash / label 匹配） */
const NAV_FLAG_RULES: NavFlagRule[] = [
  { pathIncludes: "/stamp-rally", flag: "stampRally" },
  { pathIncludes: "/booth-ranking", flag: "boothRanking" },
  { pathIncludes: "/booth-route", flag: "aiBoothRoute" },
  { pathIncludes: "/speed-networking", flag: "speedNetworking" },
  { pathIncludes: "/ai-referral", flag: "aiReferral" },
  { pathIncludes: "/high-value-buyer-push", flag: "highValueBuyerPush" },
  { pathIncludes: "/lottery", flag: "lottery" },
  { pathIncludes: "/invite-campaigns", flag: "inviteSystem" },
  { pathIncludes: "/invite", flag: "inviteSystem" },
  { hashIncludes: "matching-preview", flag: "aiReferral" },
  { hashIncludes: "buyer-push", flag: "highValueBuyerPush" },
  { labelIncludes: "AI 展位路线", flag: "aiBoothRoute" },
  { labelIncludes: "AI 引荐", flag: "aiReferral" },
  { labelIncludes: "高价值买家", flag: "highValueBuyerPush" },
];

function hrefMatchesRule(
  href: string,
  label: string,
  rule: NavFlagRule,
): boolean {
  if (rule.pathIncludes && href.includes(rule.pathIncludes)) return true;
  if (rule.hashIncludes && href.includes(rule.hashIncludes)) return true;
  if (rule.labelIncludes && label.includes(rule.labelIncludes)) return true;
  return false;
}

function navEntryAllowed(
  href: string,
  label: string,
  flags: EventFeatureFlags,
): boolean {
  const rule = NAV_FLAG_RULES.find((r) => hrefMatchesRule(href, label, r));
  if (!rule) return true;
  return flags[rule.flag];
}

function itemMatchesRule(item: NavItem, rule: NavFlagRule): boolean {
  return hrefMatchesRule(item.href, item.label, rule);
}

function navItemAllowed(item: NavItem, flags: EventFeatureFlags): boolean {
  const rule = NAV_FLAG_RULES.find((r) => itemMatchesRule(item, r));
  if (!rule) return true;
  return flags[rule.flag];
}

function navSubItemAllowed(sub: NavSubItem, flags: EventFeatureFlags): boolean {
  return navEntryAllowed(sub.href, sub.label, flags);
}

function filterNavItemByFlags(
  item: NavItem,
  flags: EventFeatureFlags,
): NavItem | null {
  if (item.children?.length) {
    const children = item.children.filter((child) =>
      navSubItemAllowed(child, flags),
    );
    if (children.length === 0) return null;
    if (!navItemAllowed(item, flags)) return null;
    return { ...item, children };
  }
  return navItemAllowed(item, flags) ? item : null;
}

export function filterNavByFeatureFlags(
  groups: NavGroup[],
  flags?: EventFeatureFlags | null,
): NavGroup[] {
  if (!flags) return groups;
  return groups
    .filter((group) => {
      const groupRule = NAV_GROUP_FLAG_RULES.find(
        (r) => r.groupLabel === group.label,
      );
      if (groupRule && !flags[groupRule.flag]) return false;
      return true;
    })
    .map((group) => ({
      ...group,
      items: group.items
        .map((item) => filterNavItemByFlags(item, flags))
        .filter((item): item is NavItem => item != null),
    }))
    .filter((group) => group.items.length > 0);
}
