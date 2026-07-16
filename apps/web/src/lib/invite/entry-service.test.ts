import { describe, expect, it } from "vitest";
import {
  assertInvitePhone,
  normalizeInvitePhone,
} from "@/lib/invite/phone";
import {
  buildInviteEntryMiniPath,
  buildInviteEntryScene,
  INVITE_ENTRY_TOKEN_LENGTH,
  parseInviteEntryToken,
} from "@/lib/invite/entry-service";
import { generateInviteShortToken } from "@/lib/invite/token";

describe("normalizeInvitePhone", () => {
  it("keeps 11-digit CN mobile", () => {
    expect(normalizeInvitePhone("13800138000")).toBe("13800138000");
  });

  it("strips +86 and non-digits", () => {
    expect(normalizeInvitePhone("+86 138-0013-8000")).toBe("13800138000");
  });

  it("rejects invalid", () => {
    expect(normalizeInvitePhone("12345")).toBeNull();
    expect(() => assertInvitePhone("abc")).toThrow(/手机号/);
  });
});

describe("invite entry token / scene", () => {
  it("scene length always ≤ 32", () => {
    const token = generateInviteShortToken(INVITE_ENTRY_TOKEN_LENGTH);
    const scene = buildInviteEntryScene(token);
    expect(scene.startsWith("t_")).toBe(true);
    expect(scene.length).toBeLessThanOrEqual(32);
    expect(scene).toBe(`t_${token}`);
  });

  it("builds mini path with t query only", () => {
    expect(buildInviteEntryMiniPath("Ab3xY9kqLm2pN8wxQr")).toBe(
      "pages/activation/landing?t=Ab3xY9kqLm2pN8wxQr",
    );
  });

  it("parses token from scene", () => {
    expect(parseInviteEntryToken({ scene: "t_Ab3xY9kqLm2pN8wxQr" })).toBe(
      "Ab3xY9kqLm2pN8wxQr",
    );
    expect(parseInviteEntryToken({ token: "Ab3xY9kqLm2pN8wxQr" })).toBe(
      "Ab3xY9kqLm2pN8wxQr",
    );
  });
});
