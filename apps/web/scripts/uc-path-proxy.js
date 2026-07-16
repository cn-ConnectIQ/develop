/**
 * CloudBase 自定义域名会剥掉 /uc；Next basePath=/uc 只认带前缀路径。
 * 入口代理补回 /uc。默认域名已带 /uc 则透传。
 *
 * Next 内监听 NEXT_INTERNAL_PORT（默认 3001），对外仍是 PORT（默认 3000）。
 */
const http = require("node:http");
const { spawn } = require("node:child_process");
const path = require("node:path");

const PORT = Number(process.env.PORT || 3000);
const TARGET = Number(process.env.NEXT_INTERNAL_PORT || 3001);
const BASE = (process.env.NEXT_BASE_PATH || "/uc").replace(/\/$/, "") || "/uc";

function withBasePath(url) {
  if (!url || url === "/") return `${BASE}/`;
  if (url === BASE || url.startsWith(`${BASE}/`) || url.startsWith(`${BASE}?`)) {
    return url;
  }
  return `${BASE}${url.startsWith("/") ? url : `/${url}`}`;
}

function startNext() {
  const serverJs = path.join(__dirname, "..", "..", "server.js");
  // standalone 布局: apps/web/server.js 在 runner 中位于 apps/web/server.js
  // 本脚本复制到 apps/web/scripts/uc-path-proxy.js → ../.. = apps/
  // runner COPY standalone 后结构是 apps/web/server.js + apps/web/scripts/...
  const candidates = [
    path.join(__dirname, "..", "server.js"),
    path.join(__dirname, "..", "..", "apps", "web", "server.js"),
    path.join(process.cwd(), "apps/web/server.js"),
    path.join(process.cwd(), "server.js"),
  ];
  const nextEntry = candidates.find((p) => {
    try {
      require("node:fs").accessSync(p);
      return true;
    } catch {
      return false;
    }
  });
  if (!nextEntry) {
    console.error("[uc-proxy] cannot find Next server.js", candidates);
    process.exit(1);
  }

  const child = spawn(process.execPath, [nextEntry], {
    env: { ...process.env, PORT: String(TARGET), HOSTNAME: "127.0.0.1" },
    stdio: "inherit",
  });
  child.on("exit", (code) => {
    console.error(`[uc-proxy] Next exited ${code}`);
    process.exit(code ?? 1);
  });
  return child;
}

function waitForNext(retries = 60) {
  return new Promise((resolve, reject) => {
    let left = retries;
    const tick = () => {
      const req = http.get(
        { host: "127.0.0.1", port: TARGET, path: `${BASE}/api/live`, timeout: 1000 },
        (res) => {
          res.resume();
          resolve();
        },
      );
      req.on("error", () => {
        left -= 1;
        if (left <= 0) reject(new Error("Next start timeout"));
        else setTimeout(tick, 500);
      });
    };
    tick();
  });
}

function pipe(req, res) {
  const original = req.url || "/";
  const rewritten = withBasePath(original);
  const headers = { ...req.headers, host: `127.0.0.1:${TARGET}` };
  const upstream = http.request(
    {
      host: "127.0.0.1",
      port: TARGET,
      path: rewritten,
      method: req.method,
      headers,
    },
    (upRes) => {
      res.writeHead(upRes.statusCode || 502, upRes.headers);
      upRes.pipe(res);
    },
  );
  upstream.on("error", (err) => {
    console.error("[uc-proxy]", err.message);
    if (!res.headersSent) {
      res.writeHead(502, { "Content-Type": "text/plain" });
      res.end("Bad Gateway");
    }
  });
  req.pipe(upstream);
}

async function main() {
  startNext();
  await waitForNext();
  http.createServer(pipe).listen(PORT, "0.0.0.0", () => {
    console.info(`[uc-proxy] public :${PORT} -> Next :${TARGET} base=${BASE}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
