const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const publicHtml = fs.readFileSync(path.join(root, "public", "index.html"), "utf8");
assert.equal(html, publicHtml, "root and public app shells must stay synchronized");

const helper = html.match(/function parseCupTieAggregate\\(value\\)\\s*\\{[\\s\\S]*?\\n\\}/);
const legHelper = html.match(/function parseCupTieLeg\\(value\\)\\s*\\{[\\s\\S]*?\\n\\}/);
const opponentHelper = html.match(/function parseCupTieOpponent\\(value,fallback,teams,clubName\\)\\s*\\{[\\s\\S]*?\\n\\}/);
assert.ok(helper, "the cup tie aggregate parser must exist in the shipped app shell");
assert.ok(legHelper, "the cup tie leg parser must exist in the shipped app shell");
assert.ok(opponentHelper, "the cup tie opponent parser must exist in the shipped app shell");
const sandbox = {};
vm.runInNewContext([
  helper[0], legHelper[0], opponentHelper[0],
  "globalThis.parseAggregate = parseCupTieAggregate;",
  "globalThis.parseLeg = parseCupTieLeg;",
  "globalThis.parseOpponent = parseCupTieOpponent;"
].join("\\n"), sandbox);
const parse = value => sandbox.parseAggregate(value);
const parseLeg = value => sandbox.parseLeg(value);
const parseOpponent = (value,fallback,teams,clubName) => sandbox.parseOpponent(value,fallback,teams,clubName);

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

for (const value of [undefined, null, 1, 2, "1", "2", " 2 "]) {
  const result = parseLeg(value);
  assert.equal(result.valid, true, "valid or legacy cup tie leg must remain readable: " + String(value));
  assert.equal(result.value, value == null ? 1 : Number(value));
}
for (const value of [true, false, 0, 3, -1, "", " ", "3", 1.5, [], {}, Symbol("invalid")]) {
  assert.equal(parseLeg(value).valid, false, "malformed cup tie leg must be rejected: " + String(value));
}
const cupTeams = ["Home Club", "Away Club", "Other Club"];
for (const [value,fallback,expected] of [
  ["Away Club","Other Club","Away Club"],
  ["","Away Club","Away Club"],
  [null,"Away Club","Away Club"]
]) {
  const result = parseOpponent(value,fallback,cupTeams,"Home Club");
  assert.equal(result.valid,true);
  assert.equal(result.value,expected);
}
for (const [value,fallback] of [
  [true,"Away Club"], [123,"Away Club"], [{},"Away Club"], [" ","Away Club"],
  ["Missing Club","Away Club"], ["Home Club","Away Club"], [null,"Home Club"]
]) {
  assert.equal(parseOpponent(value,fallback,cupTeams,"Home Club").valid,false,
    "invalid or wrong-side second-leg opponent must be rejected: "+String(value));
}
assert.equal(parseOpponent(null,"Away Club",null,"Home Club").valid,false,
  "a second-leg opponent must belong to a persisted club list");

const playMatch = html.match(/function playCupMatch\(\)\s*\{[\s\S]*?\n\}/);
assert.ok(playMatch, "the cup match action must exist");
const playBody = playMatch[0];
const aggregateValidationIndex = playBody.indexOf("parseCupTieAggregate(c.tieAggregate)");
const legValidationIndex = playBody.indexOf("parseCupTieLeg(c.tieLeg)");
const opponentValidationIndex = playBody.indexOf("parseCupTieOpponent(c.tieOpponent,c.opponent,c.teams,clubNameForLeague())");
const twoLegShapeIndex = playBody.indexOf("!Array.isArray(rawTwoLegs)");
const actionIndex = playBody.indexOf("checkAction('cup',20)");
assert.ok(aggregateValidationIndex >= 0 && actionIndex > aggregateValidationIndex,
  "second-leg aggregate validation must happen before consuming the cup match action");
assert.ok(legValidationIndex >= 0 && actionIndex > legValidationIndex,
  "invalid tie-leg state must be rejected before consuming the cup match action");
assert.ok(opponentValidationIndex >= 0 && actionIndex > opponentValidationIndex,
  "an invalid or mismatched second-leg opponent must be rejected before consuming the cup match action");
assert.ok(twoLegShapeIndex >= 0 && actionIndex > twoLegShapeIndex,
  "malformed twoLegs metadata must be rejected before consuming the cup match action");
assert.match(playBody, /aggregateOffset:isTwoLegTie&&tieLegAtKickoff===2\\?parsedTieAggregate\\.value:0/,
  "the match engine must receive only the validated aggregate offset");
assert.match(playBody, /parsedTieOpponent\\.value/,
  "the second leg must use the validated first-leg opponent");
assert.doesNotMatch(playBody, /Number\\(c\\.tieLeg\\)===2/,
  "raw tieLeg coercion must not decide whether this is the return leg");

const sw = fs.readFileSync(path.join(root, "sw.js"), "utf8");
const publicSw = fs.readFileSync(path.join(root, "public", "sw.js"), "utf8");
assert.equal(sw, publicSw, "root and public service workers must stay synchronized");
assert.match(sw, /last-whistle-static-v211/, "the app shell cache must advance after the embedded UI fix");

console.log("PASS: malformed second-leg cup aggregates are rejected before match actions, while legacy integer values remain compatible.");
