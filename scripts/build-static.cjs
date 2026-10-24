const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const source = path.join(root, "public");
const output = path.join(root, "dist");

if (!fs.existsSync(path.join(source, "index.html"))) {
  throw new Error("public/index.html is missing");
}
fs.rmSync(output, { recursive: true, force: true });
fs.cpSync(source, output, { recursive: true });
console.log("Static build ready at dist/");
