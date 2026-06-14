import fs from "fs";

const raw = fs.readFileSync("c:/Users/qiand/Downloads/Connect-admin.html", "utf8");

const manifestMatch = raw.match(
  /<script type="__bundler\/manifest">\s*([\s\S]*?)\s*<\/script>/,
);
const templateMatch = raw.match(
  /<script type="__bundler\/template">\s*([\s\S]*?)\s*<\/script>/,
);

if (manifestMatch) {
  const manifest = JSON.parse(manifestMatch[1]);
  console.log("=== MANIFEST ===");
  console.log(JSON.stringify(manifest, null, 2).slice(0, 8000));
}

if (templateMatch) {
  const tpl = templateMatch[1];
  fs.mkdirSync("c:/Users/qiand/Desktop/connectIQ/develop/connectiq/design", {
    recursive: true,
  });
  fs.writeFileSync(
    "c:/Users/qiand/Desktop/connectIQ/develop/connectiq/design/template.json",
    tpl.slice(0, 500000),
  );
  console.log("\n=== TEMPLATE length ===", tpl.length);

  const names = [
    ...tpl.matchAll(/"name"\s*:\s*"([^"]+)"/g),
  ].map((m) => m[1]);
  console.log("\n=== Frame names ===");
  console.log([...new Set(names)].join("\n"));

  const zh = [
    ...tpl.matchAll(/[\u4e00-\u9fa5]{2,20}/g),
  ].map((m) => m[0]);
  console.log("\n=== Chinese labels (unique) ===");
  console.log([...new Set(zh)].slice(0, 120).join("\n"));
}
