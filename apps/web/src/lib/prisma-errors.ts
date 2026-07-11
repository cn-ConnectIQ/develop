/** Prisma 表/列不存在 — 通常是部署后未执行 db:push */
export function isPrismaSchemaDriftError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const code = (error as { code?: string }).code;
  return code === "P2021" || code === "P2022";
}
