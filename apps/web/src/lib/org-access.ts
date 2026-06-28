/** 账号管理员组织是否可进入管理端（试用或正式） */
export function isOrgAdminUsable(
  status: string | null | undefined,
): boolean {
  return status === "APPROVED" || status === "TRIAL";
}

export function isTrialOrg(status: string | null | undefined): boolean {
  return status === "TRIAL";
}
