import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getMailgunConfig,
  plainTextToHtml,
  sendMailViaMailgun,
} from "./mailgun";

describe("getMailgunConfig", () => {
  afterEach(() => {
    delete process.env.MAILGUN_API_KEY;
    delete process.env.MAILGUN_DOMAIN;
    delete process.env.MAILGUN_FROM;
    delete process.env.MAILGUN_REGION;
  });

  it("未配置时返回 null", () => {
    expect(getMailgunConfig()).toBeNull();
  });

  it("解析带引号的环境变量并规范化发件人", () => {
    process.env.MAILGUN_API_KEY = "key-test";
    process.env.MAILGUN_DOMAIN = "email.9li.co";
    process.env.MAILGUN_FROM = '"玖莅<noreply@email.9li.co>"';
    process.env.MAILGUN_REGION = "us";

    expect(getMailgunConfig()).toEqual({
      apiKey: "key-test",
      domain: "email.9li.co",
      from: "玖莅 <noreply@email.9li.co>",
      region: "us",
    });
  });
});

describe("plainTextToHtml", () => {
  it("将换行转为段落并转义 HTML", () => {
    expect(plainTextToHtml("Hello\n<script>")).toBe(
      "<p>Hello</p><p>&lt;script&gt;</p>",
    );
  });
});

describe("sendMailViaMailgun", () => {
  afterEach(() => {
    delete process.env.MAILGUN_API_KEY;
    delete process.env.MAILGUN_DOMAIN;
    vi.restoreAllMocks();
  });

  it("未配置 Mailgun 时进入开发模式", async () => {
    const logSpy = vi.spyOn(console, "info").mockImplementation(() => {});

    const result = await sendMailViaMailgun({
      to: "test@example.com",
      subject: "Hello",
      text: "Body",
    });

    expect(result).toEqual({ sent: true, dev: true });
    expect(logSpy).toHaveBeenCalled();
  });

  it("配置后调用 Mailgun API 并返回 messageId", async () => {
    process.env.MAILGUN_API_KEY = "key-test";
    process.env.MAILGUN_DOMAIN = "email.9li.co";
    process.env.MAILGUN_FROM = "玖莅 <noreply@email.9li.co>";

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "<202603081200.1@email.9li.co>" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendMailViaMailgun({
      to: "guest@example.com",
      subject: "邀请",
      text: "欢迎参加",
    });

    expect(result).toEqual({
      sent: true,
      dev: false,
      messageId: "<202603081200.1@email.9li.co>",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.mailgun.net/v3/email.9li.co/messages",
      expect.objectContaining({ method: "POST" }),
    );
  });
});
