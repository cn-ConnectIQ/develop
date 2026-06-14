import { execFileSync } from "node:child_process";
import fs from "node:fs";

const sourceCommit = process.argv[2] ?? "0b4d0fd";
const text = execFileSync("git", ["show", `${sourceCommit}:pnpm-lock.yaml`], {
  encoding: "utf8",
});

const marker = "lockfileVersion: '9.0'\n\nsettings:";
const idx = text.indexOf(marker);
if (idx < 0) {
  console.error(`No valid lockfile section in ${sourceCommit}`);
  process.exit(1);
}

const fixed = `---\n${text.slice(idx)}`;
const docCount = (fixed.match(/^---$/gm) ?? []).length;
if (docCount !== 1) {
  console.error(`Expected 1 YAML document, found ${docCount}`);
  process.exit(1);
}

fs.writeFileSync("pnpm-lock.yaml", fixed, "utf8");
console.log(
  `Restored pnpm-lock.yaml from ${sourceCommit}: ${fixed.split(/\r?\n/).length} lines`,
);
