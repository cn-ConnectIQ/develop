import pg from "pg";

const url =
  process.env.DATABASE_URL ||
  "postgresql://connectiq:ConnectIQ99%3F@sh-postgres-1xnkcmum.sql.tencentcdb.com:28409/postgres?sslmode=disable";

const client = new pg.Client({
  connectionString: url,
  ssl: url.includes("sslmode=disable") ? false : { rejectUnauthorized: false },
});

await client.connect();
await client.query("SET search_path TO public");
await client.query(
  `ALTER TYPE "LotteryEntrySource" ADD VALUE IF NOT EXISTS 'SCAN'`,
);
console.log("LotteryEntrySource.SCAN ok");
await client.end();
