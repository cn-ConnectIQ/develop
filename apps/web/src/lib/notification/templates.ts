/** 定稿模板正文（与规格一致）；marketing 短信必须含「回T退订」 */

export type SeedTemplate = {
  code: string;
  name: string;
  channel: "SMS" | "EMAIL" | "WECHAT";
  category: "VERIFY" | "TRANSACTIONAL" | "MARKETING";
  audience: "ATTENDEE" | "EXHIBITOR" | "ORGANIZER" | "STAFF";
  subject: string | null;
  body: string;
  variables: string[];
  requiresOptOut: boolean;
};

export const NOTIFICATION_TEMPLATE_SEEDS: SeedTemplate[] = [
  {
    code: "SYS-01",
    name: "登录验证码",
    channel: "SMS",
    category: "VERIFY",
    audience: "ATTENDEE",
    subject: null,
    body: "您本次验证码为：{码}，十分钟内有效。",
    variables: ["码"],
    requiresOptOut: false,
  },
  {
    code: "SYS-02",
    name: "展台同事被邀请加入工作台",
    channel: "SMS",
    category: "TRANSACTIONAL",
    audience: "STAFF",
    subject: null,
    body: "【玖莅】您被邀请加入「{公司名}」{展位号}展位工作台。点击激活,现场扫码即可采集线索:{短链}",
    variables: ["公司名", "展位号", "短链"],
    requiresOptOut: false,
  },
  {
    code: "SYS-04",
    name: "活动开通成功",
    channel: "EMAIL",
    category: "TRANSACTIONAL",
    audience: "ORGANIZER",
    subject: "【{活动全称}】玖莅已开通,3 步即可上线",
    body: `{姓氏称谓},您好。

**{活动全称}** 的玖莅已开通完成。接下来只需三步:

1. **导入参会名单** —— 从您现有的报名系统导出即可
2. **设置活动信息** —— 议程、展位、抽奖规则
3. **把码放到现场** —— 签到处、展位、大屏

**[ 进入管理后台 → ]({短链})**

有任何问题,直接回复本邮件即可。`,
    variables: ["姓氏称谓", "活动全称", "短链"],
    requiresOptOut: false,
  },
  {
    code: "SYS-05-SMS",
    name: "互动点余额不足",
    channel: "SMS",
    category: "TRANSACTIONAL",
    audience: "ORGANIZER",
    subject: null,
    body: "【玖莅】{姓氏称谓},{活动简称}互动点余额仅剩{N}个,预计{X}小时后耗尽。立即补充:{短链}",
    variables: ["姓氏称谓", "活动简称", "N", "X", "短链"],
    requiresOptOut: false,
  },
  {
    code: "SYS-05-MAIL",
    name: "互动点余额不足(邮件)",
    channel: "EMAIL",
    category: "TRANSACTIONAL",
    audience: "ORGANIZER",
    subject: "【{活动简称}】互动点余额不足,建议尽快补充",
    body: `{姓氏称谓},您好。

{活动全称} 的互动点余额仅剩 {N} 个,预计约 {X} 小时后耗尽。

**[ 立即补充 → ]({短链})**

按钮无法打开?请复制:{完整链接}`,
    variables: ["姓氏称谓", "活动简称", "活动全称", "N", "X", "短链", "完整链接"],
    requiresOptOut: false,
  },
  {
    code: "SYS-06",
    name: "互动点已耗尽",
    channel: "SMS",
    category: "TRANSACTIONAL",
    audience: "ORGANIZER",
    subject: null,
    body: "【玖莅】{姓氏称谓},{活动简称}的互动点已耗尽,展商抽奖与线索采集已暂停。立即充值:{短链}",
    variables: ["姓氏称谓", "活动简称", "短链"],
    requiresOptOut: false,
  },
  {
    code: "ATT-01",
    name: "首次激活邀请(短信)",
    channel: "SMS",
    category: "MARKETING",
    audience: "ATTENDEE",
    subject: null,
    body: "【玖莅】{姓氏称谓},您报名的{活动简称}将于{开幕日期}开幕。开启AI配对,提前锁定值得见的人:{短链} 回T退订",
    variables: ["姓氏称谓", "活动简称", "开幕日期", "短链"],
    requiresOptOut: true,
  },
  {
    code: "ATT-02",
    name: "激活邀请(邮件)",
    channel: "EMAIL",
    category: "MARKETING",
    audience: "ATTENDEE",
    subject: "【{活动简称}】开启 AI 配对,提前锁定值得见的人",
    body: `{姓氏称谓},您好。

您已报名参加 **{活动全称}**({开幕日期} · {活动地点})。

本届活动启用了玖莅 AI 配对——填写一次参会意向,系统会从全场参会者中为您找出真正值得见的人,并告诉您**为什么值得见**、**可以怎么开口**。

现在填写,开幕前即可收到第一批推荐。

**[ 开启 AI 配对 → ]({短链})**

按钮无法打开?请复制:{完整链接}

——
本邮件由 {活动全称}组委会发送,玖莅提供技术支持。您因报名本次活动而收到此邮件。
[不再接收]({退订链接}) · [了解玖莅](https://9li.co)`,
    variables: [
      "姓氏称谓",
      "活动简称",
      "活动全称",
      "开幕日期",
      "活动地点",
      "短链",
      "完整链接",
      "退订链接",
    ],
    requiresOptOut: true,
  },
  {
    code: "ATT-03",
    name: "意向未填写提醒",
    channel: "EMAIL",
    category: "MARKETING",
    audience: "ATTENDEE",
    subject: "【{活动简称}】还差一步,您的 AI 配对就能开始",
    body: `{姓氏称谓},您好。

您已经打开了玖莅,但还没有填写参会意向——**AI 需要知道您想找什么样的人,才能帮您筛选。**

只需 30 秒,3 个问题。

**[ 30 秒完成填写 → ]({短链})**

按钮无法打开?请复制:{完整链接}

——
[不再接收]({退订链接})`,
    variables: ["姓氏称谓", "活动简称", "短链", "完整链接", "退订链接"],
    requiresOptOut: true,
  },
  {
    code: "ATT-05",
    name: "会前一天提醒(未启用)",
    channel: "SMS",
    category: "MARKETING",
    audience: "ATTENDEE",
    subject: null,
    body: "【玖莅】{姓氏称谓},明天{活动简称}开幕。已有{已启用人数}位参会者开启AI配对,点击看谁值得见:{短链} 回T退订",
    variables: ["姓氏称谓", "活动简称", "已启用人数", "短链"],
    requiresOptOut: true,
  },
  {
    code: "ATT-16",
    name: "连接报告",
    channel: "EMAIL",
    category: "TRANSACTIONAL",
    audience: "ATTENDEE",
    subject: "【{活动简称}】您的现场连接报告",
    body: `{姓氏称谓},您好。

**{活动全称}** 已经结束。这是您在现场的连接记录:

- 认识了 **{N}** 位新朋友
- 发起了 **{M}** 次洽谈
- 还有 **{K}** 人在等您的回复

**[ 查看完整连接报告 → ]({短链})**

按钮无法打开?请复制:{完整链接}

——
**你也在办活动?** 玖莅可以架在任何报名系统之上,让你的现场真正连接起来。[了解玖莅 →](https://9li.co)`,
    variables: ["姓氏称谓", "活动简称", "活动全称", "N", "M", "K", "短链", "完整链接"],
    requiresOptOut: false,
  },
  {
    code: "EXH-01-SMS",
    name: "展位开通通知(短信)",
    channel: "SMS",
    category: "TRANSACTIONAL",
    audience: "EXHIBITOR",
    subject: null,
    body: "【玖莅】{姓氏称谓},您在{活动简称}的{展位号}展位已开通玖莅。进入工作台,扫码即建线索:{短链}",
    variables: ["姓氏称谓", "活动简称", "展位号", "短链"],
    requiresOptOut: false,
  },
  {
    code: "EXH-01-MAIL",
    name: "展位开通通知(邮件)",
    channel: "EMAIL",
    category: "TRANSACTIONAL",
    audience: "EXHIBITOR",
    subject: "【{活动简称}】您的展位已开通玖莅",
    body: `{姓氏称谓},您好。

您在 **{活动全称}** 的 **{展位号}** 展位已开通玖莅工作台。

**[ 进入工作台 → ]({短链})**

按钮无法打开?请复制:{完整链接}`,
    variables: ["姓氏称谓", "活动简称", "活动全称", "展位号", "短链", "完整链接"],
    requiresOptOut: false,
  },
  {
    code: "EXH-06",
    name: "会后线索报告",
    channel: "EMAIL",
    category: "TRANSACTIONAL",
    audience: "EXHIBITOR",
    subject: "【{活动简称}】您在本次展会收到的线索报告",
    body: `{姓氏称谓},您好。

**{活动全称}** 已经结束。以下是贵司(**{展位号} 展位**)通过玖莅收到的线索汇总:

- 线索总数：**{N}** 条
- 其中高意向：**{M}** 条
- 待跟进：**{K}** 条

完整名单(含公司、职位、现场跟进记录)可在报告中查看和导出。

**[ 查看完整线索报告 → ]({短链})**

按钮无法打开?请复制:{完整链接}

——
**想让这些线索继续跟进?** 玖莅的线索可一键同步至 MarketUP。[了解 MarketUP →](https://www.marketup.cn)
**您自己也在办活动?** 玖莅可以架在任何报名系统之上。[了解玖莅 →](https://9li.co)`,
    variables: ["姓氏称谓", "活动简称", "活动全称", "展位号", "N", "M", "K", "短链", "完整链接"],
    requiresOptOut: false,
  },
  {
    code: "ORG-01",
    name: "会前启用率日报",
    channel: "EMAIL",
    category: "TRANSACTIONAL",
    audience: "ORGANIZER",
    subject: "【{活动简称}】开幕倒计时 {D} 天 · 启用率 {X}%",
    body: `当前 **{已启用人数} / {总人数}** 位参会者已开启玖莅(**{X}%**)。

其中 **{Y}** 人已完成意向填写,AI 配对可以开始为他们生成推荐。

**[ 查看看板 → ]({短链})** · **[ 向未启用的人发送提醒 → ]({提醒链接})**`,
    variables: ["活动简称", "D", "X", "已启用人数", "总人数", "Y", "短链", "提醒链接"],
    requiresOptOut: false,
  },
  {
    code: "ORG-04",
    name: "会后活动复盘报告",
    channel: "EMAIL",
    category: "TRANSACTIONAL",
    audience: "ORGANIZER",
    subject: "【{活动简称}】活动复盘报告",
    body: `{姓氏称谓},您好。

**{活动全称}** 已圆满结束。这是本次活动的玖莅数据复盘:

- 现场启用率:**{X}%**({已启用人数} / {总人数})
- 发起连接总数:**{N}** 次
- 展商线索总数:**{M}** 条,覆盖 **{K}** 家展商
- 最热展区:**{区域}**

**[ 查看完整复盘报告 → ]({短链})** · **[ 下载展商线索汇总 → ]({下载链接})**

——
**下一场活动继续用玖莅?** 老客户推荐新客户,双方都有奖励。[了解推荐计划 →](https://9li.co)`,
    variables: [
      "姓氏称谓",
      "活动简称",
      "活动全称",
      "X",
      "已启用人数",
      "总人数",
      "N",
      "M",
      "K",
      "区域",
      "短链",
      "下载链接",
    ],
    requiresOptOut: false,
  },
  {
    code: "CUSTOM-SMS",
    name: "自定义短信通知",
    channel: "SMS",
    category: "MARKETING",
    audience: "ATTENDEE",
    subject: null,
    body: "【玖莅】{内容} 回T退订",
    variables: ["内容"],
    requiresOptOut: true,
  },
  {
    code: "CUSTOM-EMAIL",
    name: "自定义邮件通知",
    channel: "EMAIL",
    category: "MARKETING",
    audience: "ATTENDEE",
    subject: "{主题}",
    body: `{姓氏称谓}，您好。

{内容}

——
{活动全称}`,
    variables: ["姓氏称谓", "主题", "内容", "活动全称"],
    requiresOptOut: false,
  },
];
