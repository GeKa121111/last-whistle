"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const window = { console };
const sandbox = { window, console, Promise, Date };
vm.createContext(sandbox);
vm.runInContext(read("career-state-store.js"), sandbox, { filename: "career-state-store.js" });

const store = window.LWStateStore;
assert.equal(typeof store.normalizePosition, "function", "the state store must export the canonical position normalizer");
assert.equal(store.version, 3, "the shared state-store API version must identify the expanded canonical alias map");
for (const [alias, expected] of [
  ["CM", "وسط"], ["RCM", "وسط"], ["LCM", "وسط"], ["MF", "وسط"], ["CDM", "وسط دفاعي"],
  ["DM", "وسط دفاعي"], ["CAM", "وسط مهاجم"], ["AM", "وسط مهاجم"], ["GK", "حارس مرمى"],
  ["CB", "قلب دفاع"], ["ST", "رأس حربة"]
]) {
  assert.equal(store.normalizePosition(alias), expected, "canonical position alias: " + alias);
}
assert.equal(store.normalizePosition("central_midfielder"), "وسط");
assert.equal(store.normalizePosition("مركز غير معروف"), "مركز غير معروف");
assert.equal(store.normalizePosition(""), "");
const hostilePosition = JSON.parse('{"toString":1,"valueOf":1}');
assert.doesNotThrow(() => store.normalizePosition(hostilePosition),
  "a JSON object with shadowed coercion methods must not crash position normalization");
assert.equal(store.normalizePosition(hostilePosition), "",
  "an object-valued legacy position must be treated as an invalid label without mutating the save");
assert.equal(store.normalizePosition(["CM"]), "",
  "array-valued legacy positions must not be coerced into a valid squad role");
assert.equal(store.normalizePosition(42), "42",
  "safe numeric legacy position values remain non-throwing and backward-compatible");
for (const inheritedKey of ["constructor", "toString", "hasOwnProperty", "__proto__"]) {
  assert.equal(store.normalizePosition(inheritedKey), inheritedKey,
    "unknown position labels that match Object.prototype keys must remain plain strings: " + inheritedKey);
}
assert.equal(read("career-state-store.js"), read("public/career-state-store.js"),
  "root and public state-store modules must remain byte-identical");
assert.equal(read("sw.js"), read("public/sw.js"),
  "root and public service workers must remain byte-identical");

const extendedPositionAliases = [
  ["left wing back", "ظهير"], ["right wing back", "ظهير"],
  ["left winger", "جناح"], ["right winger", "جناح"],
  ["left midfielder", "جناح"], ["right midfielder", "جناح"]
];
for (const [alias, expected] of extendedPositionAliases) {
  assert.equal(store.normalizePosition(alias), expected,
    "the shared normalizer must cover every alias supported by the career/match engines: " + alias);
}

let allNotifications = 0;
const selectedNotifications = [];
store.subscribe(() => { allNotifications++; });
store.subscribeSelector(state => state && state.money, (event, next, previous) => {
  selectedNotifications.push({ next, previous });
});
const save = { money: 100, energy: 70 };
store.publish(save, { source: "test" });
save.energy = 40;
store.publish(save, { source: "test" });
save.money = 125;
store.publish(save, { source: "test" });
assert.equal(allNotifications, 3, "legacy subscribers must still receive every publish");
assert.deepEqual(selectedNotifications.map(item => item.next), [100, 125],
  "slice subscribers must ignore unrelated state changes and detect in-place mutations");
assert.deepEqual(selectedNotifications.map(item => item.previous), [null, 100]);

vm.runInContext(read("data/career-engine.js"), sandbox, { filename: "data/career-engine.js" });
vm.runInContext(read("data/match-engine.js"), sandbox, { filename: "data/match-engine.js" });
assert.doesNotThrow(() => window.LWCareer.normalizeCareerPosition(hostilePosition));
assert.equal(window.LWCareer.normalizeCareerPosition(hostilePosition), "",
  "career engine must reject hostile position objects even when the shared normalizer is installed");
assert.doesNotThrow(() => window.LWMatch.normalizePosition(hostilePosition));
assert.equal(window.LWMatch.normalizePosition(hostilePosition), "",
  "match engine must reject hostile position objects even when the shared normalizer is installed");
assert.equal(window.LWMatch.normalizePosition(["CM"]), "",
  "match engine must not coerce array-valued legacy positions");
assert.equal(window.LWMatch.normalizePosition(42), "42",
  "match engine must preserve finite numeric legacy labels");
for (const inheritedKey of ["constructor", "toString", "hasOwnProperty", "__proto__"]) {
  assert.equal(window.LWMatch.normalizePosition(inheritedKey), inheritedKey,
    "match engine must not resolve inherited object-prototype aliases: " + inheritedKey);
}
assert.equal(JSON.stringify(window.LWMatch.positionProfile("constructor")), JSON.stringify({ shooter: 0.2, creator: 0.2, defender: 0.15 }),
  "prototype property names must use the neutral fallback position profile");
assert.equal(JSON.stringify(window.LWMatch.positionProfile("__proto__")), JSON.stringify({ shooter: 0.2, creator: 0.2, defender: 0.15 }),
  "the prototype key must not be mistaken for a match position profile");
assert.equal(window.LWCareer.normalizeCareerPosition("CM"), "وسط");
assert.equal(window.LWCareer.normalizeCareerPosition("CDM"), "وسط دفاعي");
assert.equal(window.LWMatch.normalizePosition("CAM"), "وسط مهاجم");
assert.equal(window.LWMatch.normalizePosition("MF"), "وسط");
for (const [alias, expected] of extendedPositionAliases) {
  assert.equal(window.LWCareer.normalizeCareerPosition(alias), expected,
    "career engine must receive the canonical shared alias: " + alias);
  assert.equal(window.LWCareer.positionDevelopmentPlan(alias).position, expected,
    "career development plan must use the canonical shared role: " + alias);
  assert.equal(window.LWMatch.normalizePosition(alias), expected,
    "match engine must receive the canonical shared alias: " + alias);
  assert.equal(JSON.stringify(window.LWMatch.positionProfile(alias)),
    JSON.stringify(window.LWMatch.positionProfile(expected)),
    "match profile must stay identical between alias and canonical role: " + alias);
}

const footballAI = read("football-world-ai.js");
const transferAwards = read("transfer-awards-engine.js");
const worker = read("football-world-worker.js");
assert.match(footballAI, /store\.normalizePosition/);
assert.match(transferAwards, /store\.normalizePosition/);
assert.match(worker, /career-state-store\.js\?v=8/,
  "the worker must load the same normalizer before world simulation starts");
assert.match(read("index.html"), /career-state-store\.js\?v=8/);
console.log("PASS: shared position aliases and selector-aware state subscriptions remain consistent across career and match engines.");
