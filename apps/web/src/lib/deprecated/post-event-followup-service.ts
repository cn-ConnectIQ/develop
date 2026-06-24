/**
 * @deprecated ADMIN-DONT-01：会后 AI 跟进已停用。
 * 会后触达由微信小程序负责，ConnectIQ 不再跑 24h/72h/7d/30d 留存序列。
 * cron `/api/cron/post-event-followup` 仅返回 `{ enabled: false }`。
 *
 * 保留此文件供历史参考，请勿在新代码中引用。
 */

export const POST_EVENT_FOLLOWUP_DEPRECATED = true;

export const POST_EVENT_FOLLOWUP_DEPRECATION_MESSAGE =
  "会后 AI 跟进已移交微信，ConnectIQ 不再执行留存推送。";
