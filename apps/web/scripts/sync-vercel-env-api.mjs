import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envLocalPath = path.join(root, ".env.local");
const authPath = path.join(
  process.env.APPDATA ?? "",
  "xdg.data",
  "com.vercel.cli",
  "auth.json",
);

const project = process.env.VERCEL_PROJECT ?? "connectiq-web";
const teamSlug = process.env.VERCEL_TEAM ?? "miloqians-projects";
const targets = ["production", "preview", "development"];

const SENSITIVE_KEYS = new Set([
  "DATABASE_URL",
  "DATABASE_URL_POOLER",
  "DATABASE_URL_DIRECT",
  "NEXTAUTH_SECRET",
  "SUPABASE_SERVICE_ROLE_KEY",
]);

const PLAIN_KEYS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "NEXTAUTH_URL",
  "NEXT_PUBLIC_APP_URL",
];

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing ${filePath}. Copy from .env.example and fill in values.`);
  }
  const env = {};
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

function buildVars(localEnv) {
  const required = [
    "DATABASE_URL",
    "DATABASE_URL_POOLER",
    "DATABASE_URL_DIRECT",
    "NEXTAUTH_SECRET",
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
  ];
  for (const key of required) {
    const value = localEnv[key];
    if (!value || value.startsWith("[")) {
      throw new Error(`Missing or placeholder value for ${key} in .env.local`);
    }
  }

  const appUrl =
    process.env.VERCEL_APP_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "https://marketingprofs.ai";

  const vars = [];
  for (const key of [...SENSITIVE_KEYS]) {
    vars.push({ key, value: localEnv[key], type: "sensitive" });
  }
  for (const key of PLAIN_KEYS) {
    let value = localEnv[key];
    if (key === "NEXTAUTH_URL" || key === "NEXT_PUBLIC_APP_URL") {
      value = appUrl;
    }
    vars.push({ key, value, type: "plain" });
  }
  return vars;
}

async function api(token, method, urlPath, body) {
  const url = `https://api.vercel.com${urlPath}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  if (!res.ok) {
    throw new Error(`${method} ${urlPath} → ${res.status}: ${text}`);
  }
  return data;
}

async function getTeamId(token) {
  const teams = await api(token, "GET", "/v2/teams");
  const team = teams.teams?.find(
    (t) => t.slug === teamSlug || t.name === teamSlug,
  );
  if (!team) throw new Error(`Team not found: ${teamSlug}`);
  return team.id;
}

async function upsertEnv(token, teamId, item) {
  const qs = new URLSearchParams({ upsert: "true", teamId });
  const urlPath = `/v10/projects/${project}/env?${qs}`;
  return api(token, "POST", urlPath, item);
}

function envType(baseType, target) {
  if (target === "development" && baseType === "sensitive") {
    return "encrypted";
  }
  return baseType;
}

async function main() {
  const token = JSON.parse(fs.readFileSync(authPath, "utf8")).token;
  const vars = buildVars(parseEnvFile(envLocalPath));
  const teamId = await getTeamId(token);
  console.log(`Team: ${teamSlug} (${teamId})\n`);

  for (const target of targets) {
    console.log(`=== ${target} ===`);
    for (const { key, value, type } of vars) {
      const result = await upsertEnv(token, teamId, {
        key,
        value,
        type: envType(type, target),
        target: [target],
      });
      const id = result.created?.id ?? result.id ?? "ok";
      console.log(`  ✓ ${key} (${id})`);
    }
    console.log("");
  }

  const listed = await api(
    token,
    "GET",
    `/v10/projects/${project}/env?teamId=${teamId}`,
  );
  console.log("Current env vars:");
  for (const env of listed.envs ?? []) {
    console.log(`  - ${env.key} → ${env.target?.join(", ")}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
