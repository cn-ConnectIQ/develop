/** 客户端/服务端均可使用的脱敏工具（不依赖 Prisma） */

export function maskPhone(phone: string | null | undefined) {
  if (!phone || phone.length < 7) return phone ?? "—";
  return `${phone.slice(0, 3)}****${phone.slice(-4)}`;
}

/** 平台审核列表：前 6 后 2 */
export function maskApplicationCreditCode(code: string | null | undefined) {
  if (!code) return null;
  if (code.length <= 8) return code;
  return `${code.slice(0, 6)}****${code.slice(-2)}`;
}

/** 组织主页：前 3 后 3 */
export function maskOrgCreditCode(code: string | null) {
  if (!code) return "—";
  if (code.length <= 6) return code;
  return `${code.slice(0, 3)}***${code.slice(-3)}`;
}
