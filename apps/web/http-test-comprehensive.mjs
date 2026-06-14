const BASE = "http://localhost:3000";

class CookieJar {
  constructor() {
    this.map = new Map();
  }
  ingest(res) {
    const raw = typeof res.headers.getSetCookie === "function"
      ? res.headers.getSetCookie()
      : (res.headers.get("set-cookie") ? [res.headers.get("set-cookie")] : []);
    for (const line of raw) {
      if (!line) continue;
      const part = line.split(";")[0];
      const eq = part.indexOf("=");
      if (eq === -1) continue;
      const name = part.slice(0, eq).trim();
      const value = part.slice(eq + 1).trim();
      this.map.set(name, value);
    }
  }
  header() {
    if (this.map.size === 0) return "";
    return Array.from(this.map.entries()).map(([k, v]) => `${k}=${v}`).join("; ");
  }
}

async function req(jar, method, path, opts = {}) {
  const url = path.startsWith("http") ? path : `${BASE}${path}`;
  const headers = { ...(opts.headers || {}) };
  const cookie = jar.header();
  if (cookie) headers.Cookie = cookie;
  const res = await fetch(url, {
    method,
    headers,
    body: opts.body,
    redirect: opts.redirect ?? "manual",
  });
  jar.ingest(res);
  const text = await res.text();
  let json = null;
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    try { json = JSON.parse(text); } catch { /* ignore */ }
  }
  return { status: res.status, text, json, headers: res.headers };
}

async function login(email, password) {
  const jar = new CookieJar();
  const csrfRes = await req(jar, "GET", "/api/auth/csrf");
  const csrfToken = csrfRes.json?.csrfToken;
  if (!csrfToken) {
    throw new Error(`CSRF failed: ${csrfRes.status} ${csrfRes.text.slice(0, 200)}`);
  }
  const body = new URLSearchParams({
    csrfToken,
    email,
    password,
    json: "true",
  });
  const loginRes = await req(jar, "POST", "/api/auth/callback/credentials", {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    redirect: "manual",
  });
  const ok = loginRes.status === 200 && (loginRes.json?.url || loginRes.json?.ok !== false);
  const sessionError = loginRes.json?.error;
  if (loginRes.status >= 400 || sessionError) {
    throw new Error(`Login failed ${email}: status=${loginRes.status} error=${sessionError} body=${loginRes.text.slice(0, 300)}`);
  }
  return { jar, loginRes };
}

function issuesFromApi(label, res, validate) {
  const issues = [];
  if (res.status !== 200) issues.push(`${label} HTTP ${res.status}`);
  else if (validate) {
    const v = validate(res);
    if (v) issues.push(v);
  }
  return issues;
}

function issuesFromPage(label, res) {
  const issues = [];
  const ok = res.status === 200 || res.status === 307 || res.status === 308;
  if (!ok) issues.push(`${label} page HTTP ${res.status}`);
  else if (res.status !== 200) issues.push(`${label} redirect ${res.status} (may need follow)`);
  if (res.status === 200 && res.text.includes("Application error")) issues.push(`${label} contains Application error`);
  if (res.status === 200 && /error digest/i.test(res.text)) issues.push(`${label} possible RSC error in HTML`);
  return issues;
}

const results = [];

function record(route, status, issues, extra = "") {
  results.push({
    route,
    status: extra ? `${status} (${extra})` : String(status),
    issues: issues.length ? issues.join("; ") : "—",
  });
}

async function testOrganizer() {
  const email = "organizer@connectiq.test";
  const password = "ConnectIQ2024!";
  let jar;
  try {
    ({ jar } = await login(email, password));
    record("POST /api/auth/callback/credentials (organizer)", 200, []);
  } catch (e) {
    record("POST /api/auth/callback/credentials (organizer)", "FAIL", [String(e.message)]);
    return null;
  }

  const eventsRes = await req(jar, "GET", "/api/events");
  const evIssues = issuesFromApi("GET /api/events", eventsRes, (r) => {
    const d = r.json?.data ?? r.json;
    if (!d?.events || !Array.isArray(d.events)) return "missing events array in response";
    if (!d.stats || typeof d.stats !== "object") return "missing stats object";
    if (d.events.length === 0) return "events list empty for organizer";
    const first = d.events[0];
    if (first._count == null && first.participantCount == null) return "event missing count/stats fields";
    return null;
  });
  record("GET /api/events", eventsRes.status, evIssues);

  const payload = eventsRes.json?.data ?? eventsRes.json;
  const eventId = payload?.events?.[0]?.id;
  if (!eventId) {
    record("organizer event discovery", "—", ["no event id from /api/events"]);
    return null;
  }

  const tests = [
    { page: "/events", api: null },
    { page: `/events/${eventId}`, api: `/api/events/${eventId}/dashboard` },
    { page: `/events/${eventId}/participants`, api: `/api/events/${eventId}/participants` },
    { page: `/events/${eventId}/checkin`, api: `/api/events/${eventId}/checkin` },
    { page: `/events/${eventId}/interactions`, api: `/api/events/${eventId}/polls` },
    { page: `/events/${eventId}/tickets`, api: null },
    { page: `/events/${eventId}/reports`, api: `/api/events/${eventId}/reports/summary` },
    { page: `/events/${eventId}/exhibitors/map`, api: `/api/events/${eventId}/booths`, note: "conference" },
    { page: `/events/${eventId}/exhibitors/form-config`, api: null, note: "conference page only" },
    { page: `/events/${eventId}/bigscreen`, api: null },
    { page: `/events/${eventId}/checkin/bigscreen`, api: `/api/events/${eventId}/bigscreen/current` },
  ];

  for (const t of tests) {
    const pageRes = await req(jar, "GET", t.page);
    const pIssues = issuesFromPage(t.page, pageRes);
    let combined = [...pIssues];
    let status = pageRes.status;
    if (t.api) {
      const apiRes = await req(jar, "GET", t.api);
      combined.push(...issuesFromApi(`GET ${t.api}`, apiRes, (r) => {
        if (r.json?.success === false) return r.json?.message || "API success=false";
        const d = r.json?.data ?? r.json;
        if (d == null && r.status === 200) return "200 but no parseable data";
        return null;
      }));
      status = `${pageRes.status} / api ${apiRes.status}`;
      if (t.note === "conference" && (pageRes.status === 404 || apiRes.status === 404)) {
        combined = combined.filter(i => !i.includes("404"));
        combined.push("expected limitation for CONFERENCE (noted)");
      }
    }
    record(t.page + (t.api ? ` + ${t.api}` : ""), status, combined, t.note || "");
  }

  // POST checkin if exists
  const postCheckin = await req(jar, "POST", `/api/events/${eventId}/checkin`, {
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  if (postCheckin.status === 405) {
    record(`POST /api/events/${eventId}/checkin`, 405, ["no POST handler (GET only)"]);
  } else {
    record(`POST /api/events/${eventId}/checkin`, postCheckin.status, postCheckin.status >= 400 ? [`HTTP ${postCheckin.status}`] : []);
  }

  return eventId;
}

async function testExpo() {
  const email = "expo@connectiq.test";
  const password = "ConnectIQ2024!";
  let jar;
  try {
    ({ jar } = await login(email, password));
    record("POST /api/auth/callback/credentials (expo)", 200, []);
  } catch (e) {
    record("POST /api/auth/callback/credentials (expo)", "FAIL", [String(e.message)]);
    return;
  }

  const eventsRes = await req(jar, "GET", "/api/events");
  const evPayload = eventsRes.json?.data ?? eventsRes.json;
  let expoEventId = evPayload?.events?.[0]?.id;
  const listIssues = [];
  if (!expoEventId) {
    listIssues.push("GET /api/events returned no EXPO events (API filters type=CONFERENCE only)");
    const rolesRes = await req(jar, "GET", "/api/me/roles");
    const roles = rolesRes.json?.data?.roles ?? rolesRes.json?.roles;
    const expoRole = roles?.find(r => r.role === "EXPO_ORGANIZER" && r.entityId);
    expoEventId = expoRole?.entityId;
    if (expoEventId) listIssues.push(`fallback event id from GET /api/me/roles: ${expoEventId}`);
    else listIssues.push("could not resolve expo event id");
  }
  record("GET /api/events (expo user)", eventsRes.status, listIssues);

  if (!expoEventId) return;

  const mapPage = await req(jar, "GET", `/events/${expoEventId}/exhibitors/map`);
  const boothsRes = await req(jar, "GET", `/api/events/${expoEventId}/booths`);
  const mapIssues = [
    ...issuesFromPage(`/events/${expoEventId}/exhibitors/map`, mapPage),
    ...issuesFromApi(`GET /api/events/${expoEventId}/booths`, boothsRes, (r) => {
      const d = r.json?.data ?? r.json;
      const booths = d?.booths ?? d;
      if (Array.isArray(booths) && booths.length === 0) return "booths array empty";
      if (Array.isArray(d?.booths) === false && !Array.isArray(booths)) return "unexpected booths shape";
      return null;
    }),
  ];
  record(`expo: /events/${expoEventId}/exhibitors/map + booths API`, `${mapPage.status} / api ${boothsRes.status}`, mapIssues, "EXPO");

  const formPage = await req(jar, "GET", `/events/${expoEventId}/exhibitors/form-config`);
  const formIssues = [...issuesFromPage(`/events/${expoEventId}/exhibitors/form-config`, formPage)];
  const boothList = boothsRes.json?.data?.booths ?? boothsRes.json?.booths;
  const boothId = Array.isArray(boothList) && boothList[0]?.id;
  if (boothId) {
    const fcRes = await req(jar, "GET", `/api/events/${expoEventId}/booths/${boothId}/form-config`);
    formIssues.push(...issuesFromApi(`GET .../booths/${boothId}/form-config`, fcRes, (r) => {
      if (r.status === 200 && r.json?.data == null && r.json?.fields == null && !r.json?.schema) {
        return "form-config 200 but no recognizable config payload";
      }
      return null;
    }));
    record(`expo: form-config page + API booth ${boothId}`, `${formPage.status} / api ${fcRes?.status ?? "—"}`, formIssues, "EXPO");
  } else {
    formIssues.push("no booth id for form-config API test");
    record(`expo: /events/${expoEventId}/exhibitors/form-config`, formPage.status, formIssues, "EXPO");
  }
}

(async () => {
  console.log("ConnectIQ HTTP Test Report");
  console.log("Base URL:", BASE);
  console.log("Time:", new Date().toISOString());
  console.log("");
  await testOrganizer();
  await testExpo();
  console.log("\n| Route | Status | Issues found |");
  console.log("| --- | --- | --- |");
  for (const r of results) {
    const issues = r.issues.replace(/\|/g, "\\|");
    console.log(`| ${r.route} | ${r.status} | ${issues} |`);
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
