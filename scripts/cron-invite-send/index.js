/**
 * CloudBase 云函数：每 1～2 分钟触发邀请发送续跑
 * 环境变量：
 *   CRON_TARGET_BASE = https://9li.co/uc   （无尾斜杠）
 *   CRON_SECRET      = 与云托管一致
 */
const https = require("https");
const { URL } = require("url");

exports.main = async () => {
  const base = (process.env.CRON_TARGET_BASE || "https://9li.co/uc").replace(
    /\/$/,
    "",
  );
  const secret = process.env.CRON_SECRET || "";
  const target = new URL(`${base}/api/cron/invite-send`);

  const statusCode = await new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: target.hostname,
        path: target.pathname + target.search,
        method: "GET",
        headers: secret ? { Authorization: `Bearer ${secret}` } : {},
        timeout: 25000,
      },
      (res) => {
        res.on("data", () => {});
        res.on("end", () => resolve(res.statusCode || 0));
      },
    );
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("request timeout"));
    });
    req.end();
  });

  return { ok: statusCode >= 200 && statusCode < 300, statusCode, path: target.href };
};
