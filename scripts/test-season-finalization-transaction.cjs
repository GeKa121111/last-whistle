"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const publicHtml = fs.readFileSync(path.join(root, "public", "index.html"), "utf8");
assert.equal(html, publicHtml, "root and public app shells must remain synchronized");

function extractFunction(source, marker) {
  const start = source.indexOf(marker);
  assert.ok(start >= 0, "missing function marker: " + marker);
  const brace = source.indexOf("{", start);
  let depth = 0, quote = null, escaped = false, lineComment = false, blockComment = false;
  for (let i = brace; i < source.length; i++) {
    const c = source[i], n = source[i + 1];
    if (lineComment) { if (c === "\n") lineComment = false; continue; }
    if (blockComment) { if (c === "*" && n === "/") { blockComment = false; i++; } continue; }
    if (quote) {
      if (escaped) { escaped = false; continue; }
      if (c === "\\") { escaped = true; continue; }
      if (c === quote) quote = null;
      continue;
    }
    if (c === "/" && n === "/") { lineComment = true; i++; continue; }
    if (c === "/" && n === "*") { blockComment = true; i++; continue; }
    if (c === "'" || c === '"' || c === "`") { quote = c; continue; }
    if (c === "{") depth++;
    else if (c === "}" && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error("unterminated function: " + marker);
}

const transactionSource = [
  extractFunction(html, "function cloneSeasonTransitionState("),
  extractFunction(html, "function restoreSeasonTransitionState("),
  extractFunction(html, "async function finishSeason(")
].join("\n");

function makeHarness(options = {}) {
  const state = {
    season: 4, age: 22, seasonApps: 10, seasonFinished: false,
    money: 5000, trophies: 2, seasonSummary: "previous season",
    worldSimulation: { lastAdvancedTo: 4, players: [{ id: "existing-player", age: 28 }] }
  };
  if (options.circular) state.circular = state;
  if (options.alreadyFinished) state.seasonFinished = true;
  if (options.incomplete) state.seasonApps = 9;
  const events = { internalCalls: 0, logs: [], toasts: [], renders: 0, saves: 0, flushes: 0, flushOptions: [] };
  const sandbox = {
    state, console,
    seasonMatchTotal: () => 10,
    finishSeasonInternal: async skipAnnualTraining => {
      events.internalCalls++;
      events.skipFlags = [skipAnnualTraining];
      if (options.fail === false) {
        state.seasonFinished = true;
        state.seasonSummary = "completed";
        return { ok: true };
      }
      // Simulate the dangerous partial commit: the season flag and world/award
      // state have already changed before world-season completion throws.
      state.seasonFinished = true;
      state.money += 1000;
      state.trophies++;
      state.worldSimulation.lastAdvancedTo = 5;
      state.worldSimulation.players[0].age = 29;
      state.worldSimulation.players.push({ id: "temporary-player", age: 19 });
      state.seasonSummary = "partial finalization";
      throw new Error("simulated world season completion failure");
    },
    log: message => events.logs.push(String(message)),
    toast: message => events.toasts.push(String(message)),
    render: () => { events.renders++; },
    closeModal: () => { events.modalCloses = (events.modalCloses || 0) + 1; },
    saveGame: silent => { assert.equal(silent, true); events.saves++; },
    flushQueuedSave: async optionsArg => {
      events.flushes++;
      events.flushOptions.push(optionsArg);
      return options.flushResult !== false;
    },
    events
  };
  vm.createContext(sandbox);
  new vm.Script(transactionSource + "\nthis.runFinishSeason = finishSeason;", {
    filename: "season-finalization-transaction.js"
  }).runInContext(sandbox);
  return { sandbox, state, events };
}

(async () => {
  {
    const h = makeHarness();
    const before = JSON.stringify(h.state);
    const originalState = h.state;
    const result = await h.sandbox.runFinishSeason(false);
    assert.equal(result, false, "a failed world-season commit must be reported as a failed finalization");
    assert.equal(h.state, originalState, "rollback must preserve the live save object identity");
    assert.equal(JSON.stringify(h.state), before,
      "season flag, trophies, money, world-player ages, world rows and summary must all roll back");
    assert.equal(h.events.internalCalls, 1);
    assert.equal(h.events.renders, 1, "the restored season must be rendered");
    assert.equal(h.events.saves, 1, "the restored season must be queued for persistence");
    assert.equal(h.events.flushes, 1, "rollback must confirm the backup flush before reporting success");
    assert.equal(h.events.flushOptions[0].backupFirst, true);
    assert.ok(h.events.logs.some(message => message.includes("تمت استعادة حالة المسيرة بالكامل")));
    assert.ok(h.events.logs.some(message => message.includes("simulated world season completion failure")));
    assert.ok(h.events.toasts.some(message => message.includes("تم استعادة بيانات المسيرة؛ تقدر تحاول مرة تانية")));
  }

  {
    const h = makeHarness({ flushResult: false });
    const before = JSON.stringify(h.state);
    const result = await h.sandbox.runFinishSeason(false);
    assert.equal(result, false);
    assert.equal(JSON.stringify(h.state), before, "an unavailable backup store must not undo the in-memory rollback");
    assert.equal(h.events.flushes, 1);
    assert.ok(h.events.logs.some(message => message.includes("تعذر تأكيد حفظ النسخة الاحتياطية")));
    assert.ok(h.events.toasts.some(message => message.includes("لا تغلق اللعبة")));
    assert.ok(!h.events.toasts.some(message => message.includes("تم استعادة بيانات المسيرة؛ تقدر تحاول مرة تانية")),
      "the UI must not claim a durable rollback when the backup flush failed");
  }

  {
    const h = makeHarness({ fail: false });
    const result = await h.sandbox.runFinishSeason(true);
    assert.deepEqual(result, { ok: true }, "a successful finalization must return its underlying result");
    assert.equal(h.state.seasonFinished, true);
    assert.equal(h.state.seasonSummary, "completed");
    assert.deepEqual(h.events.skipFlags, [true]);
    assert.equal(h.events.saves, 0, "successful finalization must not run rollback persistence");
    assert.equal(h.events.flushes, 0);
  }

  {
    const h = makeHarness({ circular: true });
    const result = await h.sandbox.runFinishSeason(false);
    assert.equal(result, false, "an unsafe save snapshot must stop finalization before mutations");
    assert.equal(h.events.internalCalls, 0);
    assert.equal(h.state.seasonFinished, false);
    assert.equal(h.events.saves, 0);
    assert.equal(h.events.flushes, 0);
    assert.ok(h.events.toasts.some(message => message.includes("تعذر تأمين نسخة من المسيرة")));
  }

  for (const options of [{ alreadyFinished: true }, { incomplete: true }]) {
    const h = makeHarness(options);
    assert.equal(await h.sandbox.runFinishSeason(false), false,
      "completed or incomplete seasons must not start a second finalization");
    assert.equal(h.events.internalCalls, 0);
  }

  const sw = fs.readFileSync(path.join(root, "sw.js"), "utf8");
  const publicSw = fs.readFileSync(path.join(root, "public", "sw.js"), "utf8");
  assert.equal(sw, publicSw, "root and public service workers must stay synchronized");
  require("./assert-static-cache-version.cjs")(sw, 408);

  console.log("PASS: season finalization rolls back awards, world simulation, season flags and history after partial failures.");
})().catch(error => {
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
