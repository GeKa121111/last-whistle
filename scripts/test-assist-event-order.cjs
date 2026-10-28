#!/usr/bin/env node
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const rootEngineSource = fs.readFileSync(path.join(root, "data", "match-engine.js"), "utf8");
const publicEngineSource = fs.readFileSync(path.join(root, "public", "data", "match-engine.js"), "utf8");
const sourcePublicEngineSource = fs.readFileSync(path.join(root, "source", "public", "data", "match-engine.js"), "utf8");
assert.equal(rootEngineSource, publicEngineSource, "root and public match engines must stay synchronized");
assert.equal(rootEngineSource, sourcePublicEngineSource, "source/public match engine must stay synchronized");

const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const publicHtml = fs.readFileSync(path.join(root, "public", "index.html"), "utf8");
assert.equal(html, publicHtml, "root and public HTML must stay synchronized");
const inlineScripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)].map(match => match[1]);
const matchBundle = inlineScripts.find(script => script.includes("window.LWMatch ="));
assert.ok(matchBundle, "published HTML must contain the match engine");
const browserContext = { window: {} };
vm.createContext(browserContext);
vm.runInContext(matchBundle, browserContext, { filename: "index.html match engine" });
const browserEngine = browserContext.window.LWMatch;
assert.ok(browserEngine, "published match engine must initialize");

global.window = global;
require(path.join(root, "public", "data", "match-engine.js"));
const engine = global.LWMatch;
const baseOptions = {
  teamPower: 72, opponentPower: 64, tactic: "attack", opponentTactic: "balanced",
  player: {
    name: "Assist ordering regression", position: "وسط مهاجم", role: "بديل",
    shooting: 45, passing: 99, vision: 99, composure: 80, fitness: 100,
    trust: 100, energy: 100, fatigue: 0
  }
};

let checkedAssists = 0;
let foundEntryMinuteAssist = false;
let foundSameMinuteAssist = false;
let checkedBrowserParity = false;
let wrongSideAssistProbe = null;
for (let seed = 610000; seed < 635000 && !(foundEntryMinuteAssist && foundSameMinuteAssist && wrongSideAssistProbe); seed += 1) {
  const options = { ...baseOptions, seed };
  const result = engine.simulateMatch(options);
  assert.equal(engine.validateResult(result).ok, true,
    "assist-order regression sample must have a valid match ledger at seed " + seed);
  const entry = result.events.find(event => event.type === "substitution-on" && event.side === "player");
  assert.ok(entry, "assist-order regression requires an actual bench entry");
  const entryIndex = result.events.indexOf(entry);
  for (const assist of result.events.filter(event => event.type === "assist" && event.creditedToPlayer === true)) {
    checkedAssists += 1;
    const goalMinute = Number(assist.goalMinute);
    assert.ok(assist.goalEventId, "a credited assist must link to an exact goal at seed " + seed);
    const assistIndex = result.events.indexOf(assist);
    const laterOpponentGoal = result.events.find((event, index) => index > assistIndex
      && event.type === "goal" && event.side === "opponent");
    if (!wrongSideAssistProbe && laterOpponentGoal) {
      wrongSideAssistProbe = { result, assistGoalEventId: assist.goalEventId, opponentGoalEventId: laterOpponentGoal.goalEventId };
    }
    const goalIndex = result.events.findIndex(event => event.type === "goal" && event.goalEventId === assist.goalEventId);
    assert.ok(goalIndex >= 0, "the credited assist must reference an existing goal at seed " + seed);
    const goal = result.events[goalIndex];
    assert.equal(Number(goal.minute), goalMinute, "the linked goal minute must match the assist record at seed " + seed);
    assert.ok(Number(assist.minute) <= Number(goal.minute),
      "an assist cannot be timestamped after its exact goal at seed " + seed);
    assert.ok(assistIndex < goalIndex,
      "the credited pass must appear before its exact teammate goal at seed " + seed);
    if (Number(assist.minute) === Number(goal.minute)) foundSameMinuteAssist = true;
    if (Number(assist.minute) === Number(entry.minute)) {
      assert.ok(entryIndex < assistIndex,
        "a substitute must enter before receiving credit for a same-minute assist at seed " + seed);
      foundEntryMinuteAssist = true;
    }
    if (!checkedBrowserParity && (Number(assist.minute) === goalMinute
        || Number(assist.minute) === Number(entry.minute))) {
      assert.equal(JSON.stringify(browserEngine.simulateMatch(options)), JSON.stringify(result),
        "published and source engines must order same-minute assists identically");
      checkedBrowserParity = true;
    }
  }
}
assert.ok(checkedAssists > 0, "the deterministic sweep must exercise player assists");
assert.ok(foundEntryMinuteAssist, "the sweep must cover an assist at the substitute's entry minute");
assert.ok(foundSameMinuteAssist, "the sweep must cover an assist and goal sharing a minute");
assert.ok(checkedBrowserParity, "the inline browser engine must be checked for assist-order parity");

assert.ok(wrongSideAssistProbe, "the deterministic sweep must find a credited assist followed by an opponent goal");
const corruptedAssistResult = JSON.parse(JSON.stringify(wrongSideAssistProbe.result));
const corruptedAssist = corruptedAssistResult.events.find(event => event.type === "assist"
  && event.goalEventId === wrongSideAssistProbe.assistGoalEventId);
const opponentGoal = corruptedAssistResult.events.find(event => event.type === "goal"
  && event.goalEventId === wrongSideAssistProbe.opponentGoalEventId);
assert.ok(corruptedAssist && opponentGoal, "the corruption fixture must retain both linked events");
corruptedAssist.goalEventId = opponentGoal.goalEventId;
corruptedAssist.goalMinute = opponentGoal.minute;
const corruptedAssistValidation = engine.validateResult(corruptedAssistResult);
assert.equal(corruptedAssistValidation.assistGoalLinksValid, false,
  "an assist must not be credited to an opponent goal even when that goal is later in the event timeline");
assert.equal(corruptedAssistValidation.ok, false, "the ledger validator must reject an assist linked to an opponent goal");
assert.equal(browserEngine.validateResult(corruptedAssistResult).assistGoalLinksValid, false,
  "the embedded browser validator must reject the same corrupted assist link");

const sw = fs.readFileSync(path.join(root, "sw.js"), "utf8");
const publicSw = fs.readFileSync(path.join(root, "public", "sw.js"), "utf8");
assert.equal(sw, publicSw, "root and public service workers must stay synchronized");
assert.match(sw, /last-whistle-static-v116/, "PWA cache must advance with the match-engine fix");
assert.match(sw, /match-engine\.js\?v=18/, "PWA must request the revised match engine");

console.log("PASS: assists precede their goals, substitute entry-minute activity is ordered correctly, and source/browser assets stay synchronized.");
