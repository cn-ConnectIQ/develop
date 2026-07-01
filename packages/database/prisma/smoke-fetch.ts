import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const PROXY_URL =
  process.env.SMOKE_HTTP_PROXY ??
  process.env.HTTP_PROXY ??
  process.env.HTTPS_PROXY;

export type SmokeRequestInit = RequestInit & { token?: string };

/** 冒烟脚本 HTTP 客户端（curl + 可选 SMOKE_HTTP_PROXY，如 http://127.0.0.1:7897） */
export async function smokeFetch(
  url: string,
  init?: SmokeRequestInit,
): Promise<{ status: number; text: () => Promise<string> }> {
  const method = (init?.method ?? "GET").toUpperCase();
  const args = ["-sS", "-m", "90", "--ssl-no-revoke", "-w", "__HTTP_CODE__%{http_code}"];
  if (PROXY_URL) args.push("-x", PROXY_URL);
  args.push("-X", method, "-H", "Content-Type: application/json");

  if (init?.token) args.push("-H", `Authorization: Bearer ${init.token}`);

  const body =
    typeof init?.body === "string"
      ? init.body
      : init?.body
        ? String(init.body)
        : undefined;
  if (body) args.push("--data-raw", body);

  args.push(url);

  const run = () =>
    execFileAsync("curl.exe", args, { maxBuffer: 10 * 1024 * 1024 });

  let stdout: string;
  try {
    ({ stdout } = await run());
  } catch (error) {
    const err = error as { code?: number; stdout?: string; stderr?: string };
    if (PROXY_URL && err.code === 35) {
      const directArgs = args.filter((a, i) => !(a === "-x" || args[i - 1] === "-x"));
      ({ stdout } = await execFileAsync("curl.exe", directArgs, {
        maxBuffer: 10 * 1024 * 1024,
      }));
    } else if (err.stdout) {
      stdout = err.stdout;
    } else {
      throw error;
    }
  }

  const marker = "__HTTP_CODE__";
  const markerIndex = stdout.lastIndexOf(marker);
  const rawBody = markerIndex >= 0 ? stdout.slice(0, markerIndex) : stdout;
  const status =
    markerIndex >= 0 ? Number(stdout.slice(markerIndex + marker.length).trim()) : 0;

  return {
    status,
    text: async () => rawBody,
  };
}
