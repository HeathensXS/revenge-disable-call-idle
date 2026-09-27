import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const root = process.cwd();
const srcPath = path.join(root, "src", "index.js");
const manifestTemplatePath = path.join(root, "manifest.template.json");
const outDir = path.join(root, "dist");

if (!fs.existsSync(srcPath)) {
  console.error(`ERROR: Missing source file: ${srcPath}`);
  process.exit(1);
}

if (!fs.existsSync(manifestTemplatePath)) {
  console.error(`ERROR: Missing manifest template: ${manifestTemplatePath}`);
  process.exit(1);
}

const source = fs.readFileSync(srcPath, "utf8");

if (!source.startsWith("(")) {
  console.error("ERROR: src/index.js must begin with '(' for the Revenge Classic/Vendetta loader.");
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(manifestTemplatePath, "utf8"));
manifest.main = "index.js";
manifest.hash = crypto.createHash("sha256").update(source).digest("hex").slice(0, 16);

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

fs.writeFileSync(path.join(outDir, "index.js"), source, "utf8");
fs.writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n", "utf8");

console.log("");
console.log("Build complete.");
console.log(`Output: ${outDir}`);
console.log(`Hash:   ${manifest.hash}`);
console.log("");
console.log("Upload BOTH files from dist/ to the ROOT of your GitHub Pages repository:");
console.log("  dist/index.js");
console.log("  dist/manifest.json");
