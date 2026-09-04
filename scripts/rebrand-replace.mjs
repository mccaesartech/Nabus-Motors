import { readFileSync, writeFileSync, readdirSync, statSync } from "fs";
import { join, extname } from "path";

const root = join(import.meta.dirname, "..");
const targets = [join(root, "src"), join(root, "DEPLOY.md"), join(root, ".env.example")];

const replacements = [
  ["True Goshen Company Limited", "Nabus Motors and Trading"],
  ["True Goshen Auto", "Nabus Motors"],
  ["True Goshen Freight", "Nabus Motors"],
  ["True Goshen Admin", "Nabus Motors Admin"],
  ["True Goshen Platform", "Nabus Motors Platform"],
  ["TRUE GOSHEN", "NABUS MOTORS"],
  ["True Goshen", "Nabus Motors"],
  ["truegoshengh.com", "nabusmotors.com"],
  ["truegoshenauto.com", "nabusmotors.com"],
  ["auth.truegoshengh.com", "auth.nabusmotors.com"],
  ["truegoshen.vercel.app", "nabus-motors.vercel.app"],
  ["truegoshenauto.vercel.app", "nabus-motors.vercel.app"],
  ["233244876784", "233279940200"],
  ["+233244876784", "+233279940200"],
  ["+233 24 487 6784", "+233 27 994 0200"],
  ["info@truegoshenauto.com", "info@nabusmotors.com"],
  ["owner@truegoshenauto.com", "owner@nabusmotors.com"],
  ["noreply@truegoshengh.com", "noreply@nabusmotors.com"],
  ["true-goshen-auto", "nabus-motors"],
  ["true-goshen-customer", "nabus-motors-customer"],
  ["true-goshen-admin", "nabus-motors-admin"],
  ["tg-pwa-", "nm-pwa-"],
  ["tg_admin", "nm_admin"],
];

function walk(dir, files = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name === "node_modules" || name === ".next") continue;
      walk(p, files);
    } else {
      files.push(p);
    }
  }
  return files;
}

function shouldProcess(file) {
  const ext = extname(file);
  return [".ts", ".tsx", ".md", ".example", ".mjs"].includes(ext);
}

let changed = 0;
for (const target of targets) {
  const files = statSync(target).isDirectory() ? walk(target) : [target];
  for (const file of files) {
    if (!shouldProcess(file)) continue;
    let content = readFileSync(file, "utf8");
    let next = content;
    for (const [from, to] of replacements) {
      next = next.split(from).join(to);
    }
    if (next !== content) {
      writeFileSync(file, next, "utf8");
      changed++;
      console.log("Updated:", file.replace(root + "\\", "").replace(root + "/", ""));
    }
  }
}
console.log(`Done. ${changed} files updated.`);
