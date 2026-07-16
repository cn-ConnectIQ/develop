/**
 * 国内手机号归一化：取末 11 位数字，须匹配 1[3-9]xxxxxxxxx。
 * 写入 InviteEntry.phone / 与小程序比对时共用。
 */
export function normalizeInvitePhone(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  if (!digits) return null;
  const last11 = digits.length >= 11 ? digits.slice(-11) : digits;
  if (!/^1[3-9]\d{9}$/.test(last11)) return null;
  return last11;
}

export function assertInvitePhone(input: string): string {
  const phone = normalizeInvitePhone(input);
  if (!phone) {
    throw new Error("请输入有效的中国大陆手机号");
  }
  return phone;
}
