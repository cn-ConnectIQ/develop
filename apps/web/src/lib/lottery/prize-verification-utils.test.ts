import { describe, expect, it } from "vitest";
import { extractVerificationCode } from "./prize-verification-utils";

describe("extractVerificationCode", () => {
  it("从核销 URL 路径中提取并大写核销码", () => {
    expect(
      extractVerificationCode("https://app.connectiq.cn/verify/abc-123xyz"),
    ).toBe("ABC-123XYZ");
  });

  it("支持手动输入的纯核销码并去除首尾空格", () => {
    expect(extractVerificationCode("  win-001  ")).toBe("WIN-001");
  });
});
