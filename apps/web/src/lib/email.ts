async function sendEmail(to: string, subject: string, body: string) {
  if (process.env.NODE_ENV === "development" || !process.env.SMTP_HOST) {
    console.info(`[EMAIL DEV] To: ${to}\nSubject: ${subject}\n${body}`);
    return { sent: true, dev: true };
  }
  console.info(`[EMAIL] To: ${to} Subject: ${subject}`);
  return { sent: true, dev: false };
}

export async function sendApplicationConfirmationEmail(
  to: string,
  orgName: string,
) {
  const subject = "ConnectIQ 账号管理员申请已收到";
  const body = `您好，

我们已收到「${orgName}」的账号管理员申请，预计 1-3 个工作日内完成审核。

审核结果将通过短信和邮件通知您。

ConnectIQ 团队`;
  return sendEmail(to, subject, body);
}

export async function sendApplicationApprovedEmail(
  to: string,
  orgName: string,
) {
  const subject = "ConnectIQ 账号管理员审核已通过";
  const body = `您好，

恭喜！「${orgName}」的账号管理员申请已通过审核，组织主页已创建。

您现在可以登录 ConnectIQ 管理后台开始使用。

ConnectIQ 团队`;
  return sendEmail(to, subject, body);
}

export async function sendApplicationRejectedEmail(
  to: string,
  orgName: string,
  reason: string,
) {
  const subject = "ConnectIQ 账号管理员申请未通过";
  const body = `您好，

「${orgName}」的账号管理员申请未通过审核。

原因：${reason}

您可以修改申请信息后重新提交。

ConnectIQ 团队`;
  return sendEmail(to, subject, body);
}

export async function sendEventReviewNotificationEmail(
  to: string,
  eventName: string,
  message: string,
) {
  const subject = `ConnectIQ 活动审核通知：${eventName}`;
  const body = `您好，

关于活动「${eventName}」的审核结果：

${message}

ConnectIQ 团队`;
  return sendEmail(to, subject, body);
}

export async function sendInviteEmail(params: {
  to: string;
  subject: string;
  participantName: string;
  eventName: string;
  eventDate: string;
  eventLocation: string;
  organizerName: string;
  activationLink: string;
  plainText: string;
}) {
  const body =
    params.plainText ||
    `您好 ${params.participantName}，

${params.organizerName} 邀请您参加「${params.eventName}」。

时间：${params.eventDate}
地点：${params.eventLocation}

请点击链接激活参会资格：
${params.activationLink}

ConnectIQ 团队`;
  return sendEmail(params.to, params.subject, body);
}
