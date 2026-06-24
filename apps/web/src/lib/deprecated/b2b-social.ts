/**
 * @deprecated MVP 不做独立 B2B 社区 / LinkedIn 式社交后台。
 * 客户关系沉淀走「现场线索 → MarketUP CRM」，不在 ConnectIQ 维护粉丝/关注体系。
 *
 * 保留但不再维护的脚手架：
 * - POST/DELETE /api/org/[slug]/follow
 * - org-public-service followOrganization / unfollowOrganization
 * - 公开主页「+ 关注」与关注者计数 UI（已移除）
 * - event-dashboard-mobile-service communityPosts 占位字段
 */

export const B2B_SOCIAL_DEPRECATED = true;

export const B2B_SOCIAL_DEPRECATION_MESSAGE =
  "组织关注/粉丝功能已下线。请通过活动现场线索与 MarketUP CRM 维护客户关系。";
