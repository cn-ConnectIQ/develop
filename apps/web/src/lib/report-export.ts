import * as XLSX from "xlsx";
import type { EventReportSummary, ReportTabId } from "@/lib/report-types";
import { REPORT_TAB_LABELS } from "@/lib/report-types";

function sheetFromRows(rows: Record<string, string | number>[]) {
  return XLSX.utils.json_to_sheet(rows);
}

export function buildExcelExport(
  report: EventReportSummary,
  tabs: ReportTabId[],
): Buffer {
  const wb = XLSX.utils.book_new();

  if (tabs.includes("connections")) {
    XLSX.utils.book_append_sheet(
      wb,
      sheetFromRows([
        { 指标: "商业连接总数", 数值: report.connections.total },
        { 指标: "人均连接", 数值: report.connections.avgPerPerson },
        {
          指标: "买卖双方连接",
          数值: `${report.connections.buyerSellerPairs} 对（${report.connections.buyerSellerRate}%）`,
        },
        { 指标: "较历史对比", 数值: report.connections.vsHistory },
        ...report.connections.topNodes.map((n) => ({
          排名: n.rank,
          姓名: n.name,
          公司: n.company,
          连接数: n.connections,
          主要来源: n.source,
        })),
      ]),
      REPORT_TAB_LABELS.connections.slice(0, 31),
    );
  }

  if (tabs.includes("checkin")) {
    XLSX.utils.book_append_sheet(
      wb,
      sheetFromRows([
        { 指标: "签到人数", 数值: report.checkin.total },
        { 指标: "应到人数", 数值: report.checkin.participants },
        { 指标: "到场率", 数值: `${report.checkin.rate}%` },
        { 指标: "VIP 到场率", 数值: `${report.checkin.vipRate}%` },
        ...report.checkin.byHour.map((h) => ({
          时段: h.hour,
          签到人数: h.count,
        })),
        ...report.checkin.absent.map((p) => ({
          未到场: p.name,
          公司: p.company ?? "",
          邮箱: p.email ?? "",
        })),
      ]),
      REPORT_TAB_LABELS.checkin.slice(0, 31),
    );
  }

  if (tabs.includes("interactions")) {
    XLSX.utils.book_append_sheet(
      wb,
      sheetFromRows([
        { 指标: "满意度均分", 数值: report.interactions.satisfaction },
        { 指标: "总参与人次", 数值: report.interactions.totalResponses },
        ...report.interactions.polls.map((p) => ({
          互动: p.title,
          参与率: `${p.rate}%`,
          参与人数: p.responses,
        })),
        ...report.interactions.topQuestions.map((q) => ({
          排名: q.rank,
          问题: q.question,
          票数: q.votes,
        })),
      ]),
      REPORT_TAB_LABELS.interactions.slice(0, 31),
    );
  }

  if (tabs.includes("booths")) {
    XLSX.utils.book_append_sheet(
      wb,
      sheetFromRows([
        ...report.booths.exhibitors.map((e) => ({
          展位: e.code,
          展商: e.name,
          线索数: e.leads,
        })),
        {
          指标: "MarketUP 同步率",
          数值: `${report.booths.marketupSyncRate}%`,
        },
        ...report.booths.syncSummary.map((s) => ({
          展位: s.boothCode,
          展商: s.boothName,
          线索总数: s.total,
          已同步: s.synced,
          同步率: `${s.rate}%`,
        })),
      ]),
      REPORT_TAB_LABELS.booths.slice(0, 31),
    );
  }

  if (tabs.includes("matching")) {
    XLSX.utils.book_append_sheet(
      wb,
      sheetFromRows([
        { 指标: "参与率", 数值: `${report.matching.participationRate}%` },
        { 指标: "配对完成率", 数值: `${report.matching.completionRate}%` },
        { 指标: "建立连接数", 数值: report.matching.connectionsMade },
        ...report.matching.pairs.map((p) => ({
          配对: `${p.userA} ↔ ${p.userB}`,
          配对分: p.score,
          评分A: p.ratingA,
          评分B: p.ratingB,
          建立连接: p.connected ? "是" : "否",
        })),
      ]),
      REPORT_TAB_LABELS.matching.slice(0, 31),
    );
  }

  if (tabs.includes("meetings")) {
    XLSX.utils.book_append_sheet(
      wb,
      sheetFromRows([
        { 指标: "AI 推荐时间段采纳率", 数值: `${report.meetings.aiSlotAdoption}%` },
        ...report.meetings.funnel.map((f) => ({
          阶段: f.stage,
          人数: f.count,
        })),
        ...report.meetings.ratingDistribution.map((r) => ({
          评分: r.score,
          用户A: r.left,
          用户B: r.right,
        })),
      ]),
      REPORT_TAB_LABELS.meetings.slice(0, 31),
    );
  }

  if (wb.SheetNames.length === 0) {
    XLSX.utils.book_append_sheet(
      wb,
      sheetFromRows([{ 活动: report.event.name, 摘要: report.aiSummary }]),
      "摘要",
    );
  }

  return Buffer.from(
    XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as ArrayBuffer,
  );
}

export function buildPdfHtml(
  report: EventReportSummary,
  tabs: ReportTabId[],
): string {
  const sections = tabs
    .map((tab) => {
      switch (tab) {
        case "connections":
          return `<section><h2>连接报告</h2>
            <p>商业连接总数：${report.connections.total}</p>
            <p>人均连接：${report.connections.avgPerPerson}</p>
            <p>买卖双方连接：${report.connections.buyerSellerPairs} 对（${report.connections.buyerSellerRate}%）</p>
            <table border="1" cellpadding="6"><tr><th>排名</th><th>姓名</th><th>公司</th><th>连接数</th></tr>
            ${report.connections.topNodes.map((n) => `<tr><td>${n.rank}</td><td>${n.name}</td><td>${n.company}</td><td>${n.connections}</td></tr>`).join("")}
            </table></section>`;
        case "checkin":
          return `<section><h2>签到报告</h2>
            <p>到场率：${report.checkin.rate}%（${report.checkin.total}/${report.checkin.participants}）</p>
            <p>VIP 到场率：${report.checkin.vipRate}%</p></section>`;
        case "interactions":
          return `<section><h2>互动报告</h2>
            <p>满意度：${report.interactions.satisfaction}/5</p>
            <p>总参与：${report.interactions.totalResponses} 人次</p></section>`;
        case "booths":
          return `<section><h2>展位报告</h2>
            <p>MarketUP 同步率：${report.booths.marketupSyncRate}%</p>
            <p>线索 A/B/C：${report.booths.intentDistribution.A}/${report.booths.intentDistribution.B}/${report.booths.intentDistribution.C}</p></section>`;
        case "matching":
          return `<section><h2>配对报告</h2>
            <p>参与率：${report.matching.participationRate}% · 完成率：${report.matching.completionRate}%</p></section>`;
        case "meetings":
          return `<section><h2>会面报告</h2>
            <p>AI 推荐时间段采纳率：${report.meetings.aiSlotAdoption}%</p></section>`;
        default:
          return "";
      }
    })
    .join("");

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
    <title>${report.event.name} - 数据报告</title>
    <style>body{font-family:sans-serif;padding:40px;color:#1a1a2e}
    h1{font-size:22px}h2{font-size:16px;margin-top:24px;color:#534AB7}
    .summary{background:#E8F0FE;padding:16px;border-radius:8px;margin:16px 0}
    table{border-collapse:collapse;width:100%;margin-top:12px;font-size:13px}
    th{background:#f3f4f6}</style></head><body>
    <h1>${report.event.name}</h1>
    <p>${report.event.location ?? ""} · ${report.event.startDate ? new Date(report.event.startDate).toLocaleDateString("zh-CN") : ""}</p>
    <div class="summary">${report.aiSummary}</div>
    ${sections}
    <p style="margin-top:40px;font-size:11px;color:#888">ConnectIQ · 生成于 ${new Date().toLocaleString("zh-CN")}</p>
    </body></html>`;
}

/** 简易 PDF：HTML 转可打印文档（浏览器 Print-to-PDF 兼容） */
export function buildPdfBuffer(
  report: EventReportSummary,
  tabs: ReportTabId[],
): Buffer {
  return Buffer.from(buildPdfHtml(report, tabs), "utf-8");
}
