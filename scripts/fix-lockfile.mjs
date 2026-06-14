import fs from "node:fs";

const text = fs.readFileSync("pnpm-lock.yaml", "utf8");
const marker = "lockfileVersion: '9.0'\n\nsettings:";
const idx = text.indexOf(marker);
if (idx < 0) {
  console.error("Valid lockfile section not found");
  process.exit(1);
}
const fixed = `---\n${text.slice(idx)}`;
fs.writeFileSync("pnpm-lock.yaml", fixed, "utf8");
console.log(
  "Fixed lockfile:",
  fixed.length,
  "bytes, documents:",
  (fixed.match(/^---$/gm) ?? []).length,
);
