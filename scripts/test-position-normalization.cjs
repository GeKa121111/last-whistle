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
assert.equal(window.LWCareer.normalizeCareerPosition("CM"), "وسط");
assert.equal(window.LWCareer.normalizeCareerPosition("CDM"), "وسط دفاعي");
assert.equal(window.LWMatch.normalizePosition("CAM"), "وسط مهاجم");
assert.equal(window.LWMatch.normalizePosition("MF"), "وسط");

const footballAI = read("football-world-ai.js");
const transferAwards = read("transfer-awards-engine.js");
const worker = read("football-world-worker.js");
assert.match(footballAI, /store\.normalizePosition/);
assert.match(transferAwards, /store\.normalizePosition/);
assert.match(worker, /career-state-store\.js\?v=2/,
  "the worker must load the same normalizer before world simulation starts");
assert.match(read("index.html"), /career-state-store\.js\?v=2/);
console.log("PASS: shared position aliases and selector-aware state subscriptions remain consistent across career and match engines.");
