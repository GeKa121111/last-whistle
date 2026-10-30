const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const publicHtml = fs.readFileSync(path.join(root, "public", "index.html"), "utf8");
assert.equal(html, publicHtml, "root and public app shells must stay synchronized");

const helperMatch = html.match(/function matchOutcomeForCareerRecord\([^)]*\)\s*\{[\s\S]*?\n\}/);
assert.ok(helperMatch, "the career-record outcome resolver must exist in the shipped app shell");
assert.match(html, /const outcome=matchOutcomeForCareerRecord\(result,meta\),participated=minutes>0;/,
  "applyMatchResult must use the fixture outcome when recording career stats");

const sandbox = {};
vm.runInNewContext(helperMatch[0] + "\nglobalThis.resolveOutcome = matchOutcomeForCareerRecord;", sandbox);
assert.equal(sandbox.resolveOutcome({ outcome: "فوز", matchOutcome: "تعادل" }), "تعادل",
  "a drawn second leg that wins the tie on aggregate must remain a draw in the match record");
assert.equal(sandbox.resolveOutcome({ outcome: "فوز", matchOutcome: "خسارة" }), "خسارة",
  "a fixture loss must not become a match-record win just because the aggregate tie was won");
assert.equal(sandbox.resolveOutcome({ outcome: "فوز" }), "فوز",
  "legacy match results without matchOutcome must remain compatible");
assert.equal(sandbox.resolveOutcome({ outcome: "خسارة", matchOutcome: "تعادل" }, { outcome: "فوز" }), "فوز",
  "an explicit caller-provided outcome must retain precedence");

const sw = fs.readFileSync(path.join(root, "sw.js"), "utf8");
const publicSw = fs.readFileSync(path.join(root, "public", "sw.js"), "utf8");
assert.equal(sw, publicSw, "root and public service workers must stay synchronized");
require("./assert-static-cache-version.cjs")(sw, 175);
require("./assert-static-cache-version.cjs").assertAssetVersionAtLeast(sw, "match-engine.js", 58);

console.log("PASS: cup aggregate outcomes no longer overwrite the individual fixture result in career records.");
