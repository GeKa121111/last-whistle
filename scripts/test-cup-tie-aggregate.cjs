const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const publicHtml = fs.readFileSync(path.join(root, "public", "index.html"), "utf8");
assert.equal(html, publicHtml, "root and public app shells must stay synchronized");

const helper = html.match(/function parseCupTieAggregate\(value\)\s*\{[\s\S]*?\n\}/);
assert.ok(helper, "the cup tie aggregate parser must exist in the shipped app shell");
const sandbox = {};
vm.runInNewContext(helper[0] + "\nglobalThis.parse = parseCupTieAggregate;", sandbox);
const parse = value => sandbox.parse(value);

for (const value of [undefined, null, 0, 3, -2, "0", "1", "-2", " 3 "]) {
  const result = parse(value);
  assert.equal(result.valid, true, "valid legacy cup aggregate must remain readable: " + String(value));
  assert.equal(result.value, value == null ? 0 : Number(value),
    "valid cup aggregate must normalize to its integer value: " + String(value));
}
for (const value of [
  true, false, "", " ", "Infinity", "1.5", 1.5, Infinity, -Infinity, NaN,
  9007199254740992, [], {}, Object(1), Symbol("invalid")
]) {
  const result = parse(value);
  assert.equal(result.valid, false, "malformed cup aggregate must be rejected: " + String(value));
}

const playMatch = html.match(/function playCupMatch\(\)\s*\{[\s\S]*?\n\}/);
assert.ok(playMatch, "the cup match action must exist");
const playBody = playMatch[0];
const validationIndex = playBody.indexOf("parseCupTieAggregate(c.tieAggregate)");
const actionIndex = playBody.indexOf("checkAction('cup',20)");
assert.ok(validationIndex >= 0 && actionIndex > validationIndex,
  "second-leg aggregate validation must happen before consuming the cup match action");
assert.match(playBody, /aggregateOffset:isTwoLegTie&&tieLegAtKickoff===2\?parsedTieAggregate\.value:0/,
  "the match engine must receive only the validated aggregate offset");

const sw = fs.readFileSync(path.join(root, "sw.js"), "utf8");
const publicSw = fs.readFileSync(path.join(root, "public", "sw.js"), "utf8");
assert.equal(sw, publicSw, "root and public service workers must stay synchronized");
assert.match(sw, /last-whistle-static-v210/, "the app shell cache must advance after the embedded UI fix");

console.log("PASS: malformed second-leg cup aggregates are rejected before match actions, while legacy integer values remain compatible.");
