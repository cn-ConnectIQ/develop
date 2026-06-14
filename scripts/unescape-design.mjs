import fs from "fs";

const tpl = fs.readFileSync(
  "c:/Users/qiand/Desktop/connectIQ/develop/connectiq/design/template.json",
  "utf8",
);

let html = tpl;
if (tpl.startsWith('"')) {
  html = JSON.parse(tpl);
}

fs.writeFileSync(
  "c:/Users/qiand/Desktop/connectIQ/develop/connectiq/design/admin-design.html",
  html,
);

const styles = [...html.matchAll(/\.([a-zA-Z0-9_-]+)\s*\{[^}]{0,200}\}/g)]
  .map((m) => m[0])
  .slice(0, 80);

const zh = [...new Set([...html.matchAll(/[\u4e00-\u9fa5]{2,30}/g)].map((m) => m[0]))];
const colors = [
  ...new Set([...html.matchAll(/#[0-9A-Fa-f]{3,8}/g)].map((m) => m[0])),
].slice(0, 30);

console.log("html length", html.length);
console.log("\ncolors:", colors.join(", "));
console.log("\nzh labels:\n", zh.join("\n"));
console.log("\nstyles sample:\n", styles.slice(0, 15).join("\n\n"));
