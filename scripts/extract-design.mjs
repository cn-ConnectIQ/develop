import fs from "fs";
import path from "path";

const src = "c:/Users/qiand/Downloads/Connect-admin.html";
const outDir = "c:/Users/qiand/Desktop/connectIQ/develop/connectiq/design";
const raw = fs.readFileSync(src, "utf8");

const start = raw.indexOf('"<!DOCTYPE html');
const end = raw.lastIndexOf('</html>"');
if (start === -1 || end === -1) {
  console.error("Could not find embedded HTML");
  process.exit(1);
}

let html = raw.slice(start + 1, end + 7);
html = html
  .replace(/\\u002F/g, "/")
  .replace(/\\n/g, "\n")
  .replace(/\\"/g, '"')
  .replace(/\\t/g, "\t");

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "extracted-admin.html"), html);

const classNames = [
  ...new Set([...html.matchAll(/class="([^"]+)"/g)].map((m) => m[1])),
].slice(0, 60);
const texts = [
  ...new Set(
    [...html.matchAll(/>([^<]{2,50})</g)]
      .map((m) => m[1].trim())
      .filter((t) => /[\u4e00-\u9fa5A-Za-z]/.test(t) && !t.startsWith("{")),
  ),
].slice(0, 100);

const cssVars = [
  ...new Set([...html.matchAll(/--([a-z0-9-]+):\s*([^;]+);/gi)].map((m) => m[0])),
].slice(0, 40);

console.log("HTML length:", html.length);
console.log("\n=== CSS vars ===");
console.log(cssVars.join("\n"));
console.log("\n=== Sample classes ===");
console.log(classNames.join("\n"));
console.log("\n=== Sample text ===");
console.log(texts.join("\n"));
