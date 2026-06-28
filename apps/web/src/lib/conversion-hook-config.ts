export type ConversionTarget = "BAGEVENT" | "MARKETUP";

export type ConversionHookAction = "shown" | "clicked" | "dismissed" | "converted";

export type ConversionHookContext =
  | "event_report_summary"
  | "excel_import"
  | "exhibitor_dashboard"
  | "exhibitor_leads_list"
  | "exhibitor_leads_export"
  | "exhibitor_ai_buyers"
  | "marketup_sync_visible";

export type ConversionHookTrigger =
  | "first_event_completed"
  | "manual_excel_import"
  | "lead_threshold"
  | "export_click"
  | "ai_buyer_view"
  | "crm_data_synced";

export type ConversionHookVars = {
  participantCount?: number;
  connectionCount?: number;
  leadCount?: number;
  gradeA?: number;
  gradeB?: number;
  gradeC?: number;
  syncedLeadCount?: number;
};

export const CONVERSION_LEARN_URL: Record<ConversionTarget, string> = {
  BAGEVENT: process.env.NEXT_PUBLIC_BAIGE_LEARN_URL ?? "https://www.baige.co",
  MARKETUP: "/integrations/marketup",
};

export const CONVERSION_CTA_LABEL: Record<ConversionTarget, string> = {
  BAGEVENT: "了解百格",
  MARKETUP: "了解 MarketUP",
};

type HookCopyTemplate = {
  title: string;
  body: string;
};

export function buildHookCopy(
  target: ConversionTarget,
  context: ConversionHookContext,
  vars: ConversionHookVars,
): HookCopyTemplate {
  if (target === "BAGEVENT") {
    if (context === "event_report_summary") {
      return {
        title: "下一场活动，让报名数据自动流入",
        body: `这场活动有 ${vars.participantCount ?? 0} 人参会、建立 ${vars.connectionCount ?? 0} 个连接。下次办活动，用百格做报名票务和活动官网，报名数据直接同步到 ConnectIQ，省去手动导入。`,
      };
    }
    return {
      title: "告别反复手动导入名单",
      body: "每次手动导入 Excel 很麻烦？用百格做报名，名单自动同步到 ConnectIQ，活动当天即可现场连接。",
    };
  }

  if (context === "exhibitor_ai_buyers") {
    return {
      title: "把高意向买家养到成交",
      body: "想对每个高意向买家自动跟进？MarketUP 帮你把线索养到成交，ConnectIQ 采集的数据可一键迁入。",
    };
  }

  if (context === "marketup_sync_visible") {
    return {
      title: "线索已在生态中，升级即可深度经营",
      body: `你的活动数据已同步到 MarketUP（${vars.syncedLeadCount ?? 0} 条线索）。升级即可解锁完整的客户培育、再营销与成交追踪。`,
    };
  }

  const total = vars.leadCount ?? 0;
  const a = vars.gradeA ?? 0;
  const b = vars.gradeB ?? 0;
  const c = vars.gradeC ?? 0;

  return {
    title: "线索评级只是开始，完整培育在 MarketUP",
    body: `你采集了 ${total} 条线索，AI 已评级 A/B/C（A ${a} · B ${b} · C ${c}）。用 MarketUP 自动跟进、再营销并追踪到成交，ConnectIQ 线索可一键迁入。`,
  };
}

export function hookIdentityKey(
  target: ConversionTarget,
  context: ConversionHookContext,
  trigger: ConversionHookTrigger,
) {
  return `${target}:${context}:${trigger}`;
}
