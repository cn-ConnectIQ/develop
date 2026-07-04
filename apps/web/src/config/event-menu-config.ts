/** 活动形态（侧栏菜单可见性维度） */
export type EventActivityKind = "CONFERENCE" | "EXPO" | "EXHIBITION";

/**
 * 侧栏菜单按活动类型的显示规则（FIX-02 映射表）
 * 未出现在此表中的 menuKey 默认对所有活动类型可见
 */
export const EVENT_MENU_VISIBILITY: Record<string, EventActivityKind[]> = {
  premeet: ["CONFERENCE", "EXPO", "EXHIBITION"],
  "intent-results": ["CONFERENCE", "EXPO", "EXHIBITION"],
  invite: ["CONFERENCE", "EXPO", "EXHIBITION"],
  "meeting-config": ["CONFERENCE", "EXPO"],
  "meeting-schedule": ["CONFERENCE", "EXPO"],
  "expo-config": ["EXPO"],
  "exhibitor-review": ["EXPO"],
  "exhibitor-list": ["EXPO"],
  "all-leads": ["EXPO", "EXHIBITION"],
  "booth-map": ["EXPO"],
  "intent-tags": ["CONFERENCE", "EXPO", "EXHIBITION"],
  "lead-form": ["CONFERENCE", "EXPO", "EXHIBITION"],
  "marketup-sync": ["CONFERENCE", "EXPO", "EXHIBITION"],
  interaction: ["CONFERENCE", "EXPO", "EXHIBITION"],
  lottery: ["CONFERENCE", "EXPO", "EXHIBITION"],
  "lottery-big-screen": ["CONFERENCE", "EXPO", "EXHIBITION"],
  "lottery-participant": ["CONFERENCE", "EXPO", "EXHIBITION"],
  "stamp-rally": ["CONFERENCE", "EXPO", "EXHIBITION"],
};

/** @deprecated 使用 EVENT_MENU_VISIBILITY；保留别名供文档/测试引用 */
export const MENU_CONFIG = Object.entries(EVENT_MENU_VISIBILITY).map(
  ([key, show]) => ({
    key,
    show,
  }),
);

export function resolveEventActivityKind(
  activityType?: string | null,
  eventType?: string | null,
): EventActivityKind {
  if (
    activityType === "CONFERENCE" ||
    activityType === "EXPO" ||
    activityType === "EXHIBITION"
  ) {
    return activityType;
  }
  if (eventType === "EXPO") return "EXPO";
  return "CONFERENCE";
}

export function isEventMenuVisible(
  menuKey: string,
  activityKind: EventActivityKind,
): boolean {
  const allowed = EVENT_MENU_VISIBILITY[menuKey];
  if (!allowed) return true;
  return allowed.includes(activityKind);
}

export function applyActivityMenuLabel<
  T extends { menuKey?: string; label: string; children?: NavSubItemLike[] },
>(item: T, activityKind: EventActivityKind): T {
  if (item.menuKey === "all-leads" && activityKind === "EXHIBITION") {
    return { ...item, label: "本展位线索" };
  }
  return item;
}

type NavSubItemLike = {
  menuKey?: string;
  label: string;
};

export function filterItemsByActivityType<
  T extends { menuKey?: string; label: string; children?: NavSubItemLike[] },
>(items: T[], activityKind: EventActivityKind): T[] {
  return items
    .map((item) => {
      if (item.children?.length) {
        const visibleChildren = item.children.filter(
          (child) =>
            !child.menuKey || isEventMenuVisible(child.menuKey, activityKind),
        );
        if (visibleChildren.length === 0) return null;
        if (item.menuKey && !isEventMenuVisible(item.menuKey, activityKind)) {
          return null;
        }
        return applyActivityMenuLabel(
          { ...item, children: visibleChildren },
          activityKind,
        );
      }

      if (item.menuKey && !isEventMenuVisible(item.menuKey, activityKind)) {
        return null;
      }
      return applyActivityMenuLabel(item, activityKind);
    })
    .filter((item): item is T => item != null);
}
