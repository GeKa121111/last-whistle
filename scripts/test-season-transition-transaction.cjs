"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const publicHtml = fs.readFileSync(path.join(root, "public", "index.html"), "utf8");
assert.equal(html, publicHtml, "root and public app shells must remain synchronized");

const start = html.indexOf("function cloneSeasonTransitionState(");
const end = html.indexOf("\nasync function startNewSeasonInternalUnsafe", start);
assert.ok(start >= 0 && end > start, "the season transition transaction wrapper must exist");
const transactionSource = html.slice(start, end);

function makeSandbox(initialState, flushResult = true, saveBehavior = "queued") {
  const events = { logs: [], toasts: [], renders: 0, saves: 0, flushes: 0 };
  const sandbox = {
    state: initialState,
    console,
    log: message => events.logs.push(String(message)),
    toast: message => events.toasts.push(String(message)),
    render: () => { events.renders++; },
    saveGame: silent => {
      assert.equal(silent, true);
      events.saves++;
      if (saveBehavior === "throws") throw new Error("simulated rollback queue failure");
      return saveBehavior === "false" ? false : true;
    },
    flushQueuedSave: async options => {
      assert.equal(options.backupFirst, true);
      await Promise.resolve();
      events.flushes++;
      return flushResult;
    },
    events,
    startNewSeasonInternalUnsafe: async () => undefined
  };
  vm.createContext(sandbox);
  new vm.Script(transactionSource + "\nthis.runSeasonTransition = startNewSeasonInternal;", {
    filename: "season-transition-transaction.js"
  }).runInContext(sandbox);
  return sandbox;
}

(async () => {
  const initial = {
    season: 4, age: 22, seasonFinished: true, contractSeasons: 2,
    loan: { parentClub: "Original FC", parentContractSeasons: 2 },
    currentCompetitions: ["League", "Cup"],
    worldSimulation: { lastAdvancedTo: 4, players: [{ id: "existing-player", age: 28 }] },
    seasonLog: [{ matchId: "season-4-final", minutes: 90, goals: 1 }]
  };
  const sandbox = makeSandbox(initial);
  sandbox.startNewSeasonInternalUnsafe = async () => {
    sandbox.state.season++;
    sandbox.state.age++;
    sandbox.state.contractSeasons--;
    sandbox.state.loan = null;
    sandbox.state.currentCompetitions.length = 0;
    sandbox.state.worldSimulation.lastAdvancedTo = 5;
    sandbox.state.worldSimulation.players[0].age = 29;
    sandbox.state.worldSimulation.players.push({ id: "temporary-player", age: 19 });
    sandbox.state.partialTransitionMarker = true;
    delete sandbox.state.seasonLog;
    await Promise.resolve();
    throw new Error("simulated world worker failure after partial mutation");
  };

  const rolledBack = await sandbox.runSeasonTransition(true);
  assert.equal(rolledBack, false, "a failed season transition should be handled without an unhandled rejection");
  assert.equal(sandbox.state, initial, "rollback must preserve the live state object identity");
  assert.equal(sandbox.state.season, 4, "season number must roll back");
  assert.equal(sandbox.state.age, 22, "player age must roll back");
  assert.equal(sandbox.state.contractSeasons, 2, "contract duration must not be deducted on a failed transition");
  assert.equal(sandbox.state.loan.parentClub, "Original FC",
    "the parent-club loan must be restored if the transition fails");
  assert.equal(sandbox.state.loan.parentContractSeasons, 2,
    "the original parent-contract term must survive a failed transition");
  assert.equal(Array.from(sandbox.state.currentCompetitions).join("|"), "League|Cup",
    "the previous season's competitions must be restored");
  assert.equal(sandbox.state.worldSimulation.lastAdvancedTo, 4,
    "a partially merged world-season marker must be rolled back");
  assert.equal(sandbox.state.worldSimulation.players.length, 1,
    "partial world-simulation rows must not leak into the restored save");
  assert.equal(sandbox.state.worldSimulation.players[0].age, 28,
    "existing world-player data must be restored");
  assert.equal(JSON.stringify(sandbox.state.seasonLog),
    JSON.stringify([{ matchId: "season-4-final", minutes: 90, goals: 1 }]),
    "season history must survive a failed transition");
  assert.equal(Object.prototype.hasOwnProperty.call(sandbox.state, "partialTransitionMarker"), false,
    "new partial-transition fields must be removed during rollback");
  assert.equal(sandbox.events.renders, 1, "the restored career must be rendered");
  assert.equal(sandbox.events.saves, 1, "the restored career must be queued for saving");
  assert.equal(sandbox.events.flushes, 1, "rollback must flush a durable backup before returning");
  assert.ok(sandbox.events.logs.some(message => message.includes("تمت استعادة حالة المسيرة بالكامل")),
    "the failure must be recorded in the career log");
  assert.ok(sandbox.events.toasts.some(message => message.includes("تم استعادة بيانات المسيرة")),
    "the player must be told that the previous save was restored");

  const persistenceFailure = makeSandbox({ season: 6, age: 24, seasonFinished: true }, false);
  persistenceFailure.startNewSeasonInternalUnsafe = async () => {
    persistenceFailure.state.season = 7;
    throw new Error("simulated season transition failure with unavailable persistence");
  };
  const restoredButNotSaved = await persistenceFailure.runSeasonTransition(true);
  assert.equal(restoredButNotSaved, false, "a failed transition must still report failure when rollback persistence is unavailable");
  assert.equal(persistenceFailure.state.season, 6, "the previous season must remain restored in memory");
  assert.equal(persistenceFailure.events.flushes, 1, "the rollback persistence result must be checked");
  assert.ok(persistenceFailure.events.logs.some(message => message.includes("تعذر تأكيد حفظ النسخة الاحتياطية")),
    "the career log must distinguish an in-memory rollback from a durable save");
  assert.ok(persistenceFailure.events.toasts.some(message => message.includes("تعذر حفظ النسخة الاحتياطية")),
    "the player must be warned not to close the game when rollback persistence fails");
  assert.ok(!persistenceFailure.events.toasts.some(message => message.includes("تم استعادة بيانات المسيرة؛ تقدر تحاول مرة تانية")),
    "the UI must not claim that rollback was durably saved when flushQueuedSave returned false");

  for (const saveBehavior of ["throws", "false"]) {
    const queueFailure = makeSandbox({ season: 8, age: 26, seasonFinished: true }, true, saveBehavior);
    queueFailure.startNewSeasonInternalUnsafe = async () => {
      queueFailure.state.season = 9;
      throw new Error("simulated transition failure before rollback queue");
    };
    const restored = await queueFailure.runSeasonTransition(true);
    assert.equal(restored, false);
    assert.equal(queueFailure.state.season, 8, "the in-memory state must still roll back when queuing the save fails");
    assert.equal(queueFailure.events.saves, 1);
    assert.equal(queueFailure.events.flushes, 0,
      "a stale successful flush must not be mistaken for persistence of a rollback that was never queued");
    assert.ok(queueFailure.events.logs.some(message => message.includes("تعذر تأكيد حفظ النسخة الاحتياطية")));
    assert.ok(queueFailure.events.toasts.some(message => message.includes("تعذر حفظ النسخة الاحتياطية")));
  }

  const success = makeSandbox({ season: 7, age: 25, seasonFinished: true });
  success.startNewSeasonInternalUnsafe = async () => {
    success.state.season++;
    success.state.age++;
    return { ok: true };
  };
  const committed = await success.runSeasonTransition(true);
  assert.deepEqual(committed, { ok: true }, "successful transitions must return the underlying result");
  assert.equal(success.state.season, 8, "successful season advancement must be retained");
  assert.equal(success.state.age, 26, "successful player aging must be retained");
  assert.equal(success.events.saves, 0, "successful transitions must not run rollback persistence");
  assert.equal(success.events.flushes, 0, "successful transitions must not run rollback flush");

  const unsafe = { season: 2 };
  unsafe.circular = unsafe;
  const serializationFailure = makeSandbox(unsafe);
  let unsafeCalls = 0;
  serializationFailure.startNewSeasonInternalUnsafe = async () => { unsafeCalls++; };
  const refused = await serializationFailure.runSeasonTransition(true);
  assert.equal(refused, false, "an unserializable save must stop before transition mutations");
  assert.equal(unsafeCalls, 0, "the transition must not start unless its rollback snapshot is available");
  assert.equal(serializationFailure.state.season, 2, "snapshot failure must leave the existing save untouched");
  assert.ok(serializationFailure.events.toasts.length > 0,
    "the player must receive a clear message when a safe snapshot cannot be created");

  console.log("PASS: season transitions roll back player, contract, loan, history and world-save mutations after async failures.");
})().catch(error => {
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
