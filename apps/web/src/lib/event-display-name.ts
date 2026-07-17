/** 活动切换器 / 面包屑共用的活动名展示逻辑 */
export function resolveEventDisplayName(input: {
  name?: string | null;
  eventId?: string | null;
  listLoading?: boolean;
  detailLoading?: boolean;
  detailFailed?: boolean;
  emptyLabel?: string;
}): string {
  const {
    name,
    eventId,
    listLoading = false,
    detailLoading = false,
    detailFailed = false,
    emptyLabel = "选择活动",
  } = input;

  if (listLoading || detailLoading) return "加载中…";
  if (name?.trim()) return name.trim();
  if (!eventId) return emptyLabel;
  if (detailFailed) return "无法加载活动";
  return "活动加载中…";
}
