import { beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorCode } from "@connectiq/types";

const { findUnique, findMany, update } = vi.hoisted(() => ({
  findUnique: vi.fn(),
  findMany: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@connectiq/database", () => ({
  prisma: {
    lotteryWinner: {
      findUnique,
      findMany,
      update,
    },
  },
}));

vi.mock("@/lib/api-auth", () => ({
  ApiError: class ApiError extends Error {
    code: string;
    status: number;
    constructor(message: string, code: string, status: number) {
      super(message);
      this.name = "ApiError";
      this.code = code;
      this.status = status;
    }
  },
}));

const {
  lookupVerificationCode,
  redeemVerificationCode,
} = await import("./prize-verification-service");

const baseWinner = {
  id: "winner-1",
  userId: "user-1",
  prizeName: "一等奖",
  prizeRank: 1,
  wonAt: new Date("2026-06-13T10:00:00Z"),
  verificationCode: "CODE-001",
  verified: false,
  verifiedAt: null,
  verifiedBy: null,
  user: {
    id: "user-1",
    name: "张三",
    profile: { company: "示例公司" },
  },
  verifier: null,
  lottery: {
    id: "lottery-1",
    title: "闭幕大抽奖",
    eventId: "event-1",
    booth: null,
  },
};

describe("prize verification service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findMany.mockResolvedValue([{ verified: false }]);
  });

  it("lookupVerificationCode 对已核销码返回 already_redeemed", async () => {
    findUnique.mockResolvedValue({
      ...baseWinner,
      verified: true,
      verifiedAt: new Date("2026-06-13T11:30:00Z"),
      verifier: { id: "staff-1", name: "工作人员" },
    });

    const result = await lookupVerificationCode("CODE-001", "event-1");

    expect(result.status).toBe("already_redeemed");
    if (result.status === "already_redeemed") {
      expect(result.winner.name).toBe("张三");
      expect(result.winner.verifier_name).toBe("工作人员");
    }
  });

  it("redeemVerificationCode 对已核销码抛出 409 防重复领取", async () => {
    findUnique.mockResolvedValue({
      ...baseWinner,
      verified: true,
      verifiedAt: new Date("2026-06-13T11:30:00Z"),
    });

    await expect(
      redeemVerificationCode("CODE-001", "event-1", "staff-2"),
    ).rejects.toMatchObject({
      status: 409,
      code: ErrorCode.VALIDATION_ERROR,
    });

    expect(update).not.toHaveBeenCalled();
  });
});
