import { afterEach, describe, expect, it } from "vitest";
import {
  getAuthApiBasePath,
  getPublicBasePath,
  getPublicBasePathWithFallback,
  withPublicPath,
} from "./public-path";

describe("getPublicBasePath", () => {
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_BASE_PATH;
    delete process.env.NEXT_BASE_PATH;
    delete process.env.NEXT_PUBLIC_APP_URL;
  });

  it("本地开发无子路径", () => {
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
    expect(getPublicBasePath()).toBe("");
  });

  it("从 NEXT_PUBLIC_APP_URL 推导 /uc", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://9li.co/uc";
    expect(getPublicBasePath()).toBe("/uc");
  });

  it("显式 NEXT_PUBLIC_BASE_PATH 优先", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://9li.co/uc";
    process.env.NEXT_PUBLIC_BASE_PATH = "/custom";
    expect(getPublicBasePath()).toBe("/custom");
  });

  it("NEXT_BASE_PATH 供服务端 middleware 使用", () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    process.env.NEXT_BASE_PATH = "/uc";
    expect(getPublicBasePath()).toBe("/uc");
  });

  it("CloudBase 域名兜底", () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.NEXT_BASE_PATH;
    expect(
      getPublicBasePathWithFallback(
        "connectiq-web-279067-5-1251792805.sh.run.tcloudbase.com",
      ),
    ).toBe("/uc");
  });
});

describe("withPublicPath", () => {
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_BASE_PATH;
    delete process.env.NEXT_BASE_PATH;
    delete process.env.NEXT_PUBLIC_APP_URL;
  });

  it("无 base 时保持原路径", () => {
    expect(withPublicPath("/login")).toBe("/login");
  });

  it("有 base 时补前缀", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://9li.co/uc";
    expect(withPublicPath("/login")).toBe("/uc/login");
  });

  it("已含前缀时不重复", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://9li.co/uc";
    expect(withPublicPath("/uc/login")).toBe("/uc/login");
  });
});

describe("getAuthApiBasePath", () => {
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_APP_URL;
  });

  it("生产环境含 /uc", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://9li.co/uc";
    expect(getAuthApiBasePath()).toBe("/uc/api/auth");
  });
});
