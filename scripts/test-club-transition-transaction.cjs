"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const publicHtml = fs.readFileSync(path.join(root, "public", "index.html"), "utf8");
assert.equal(html, publicHtml, "root and public app shells must remain synchronized");

function extractFunction(source, name) {
  const marker = "function " + name + "(";
  const start = source.indexOf(marker);
  assert.ok(start >= 0, "missing function: " + name);
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
    if (c === "'" || c === '"' || c.charCodeAt(0) === 96) { quote = c; continue; }
    if (c === "{") depth++;
    else if (c === "}" && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error("unterminated function: " + name);
}

const loanTo = extractFunction(html, "loanTo");
const transferTo = extractFunction(html, "transferTo");
assert.ok(loanTo.includes('return withCareerStateTransaction("الإعارة"'),
  "loan activation must run inside the career-state transaction");
assert.ok(transferTo.includes('return withCareerStateTransaction("الانتقال"'),
  "permanent transfer activation must run inside the career-state transaction");
assert.ok(loanTo.includes('if(saveGame(true)===false)throw new Error('),
  "a loan must not report success when its save queue rejects the change");
assert.ok(transferTo.includes('if(saveGame(true)===false)throw new Error('),
  "a permanent transfer must not report success when its save queue rejects the change");
assert.ok(loanTo.indexOf("withCareerStateTransaction(") < loanTo.indexOf('archiveLeagueSegment("loan")'),
  "the loan snapshot must exist before the parent club is archived");
assert.ok(transferTo.indexOf("withCareerStateTransaction(") < transferTo.indexOf("archiveCupForTransfer()"),
  "the transfer snapshot must exist before cup and league archives are mutated");
assert.ok(transferTo.indexOf("withCareerStateTransaction(") < transferTo.indexOf('archiveLeagueSegment("transfer")'),
  "the transfer snapshot must cover the old league segment archive");

const sources = [
  extractFunction(html, "cloneSeasonTransitionState"),
  extractFunction(html, "restoreSeasonTransitionState"),
  extractFunction(html, "withCareerStateTransaction")
].join("\n") + "\nglobalThis.runTransition = withCareerStateTransaction;";

function makeHarness(options = {}) {
  const state = {
    season: 3,
    clubName: "Host FC",
    leagueCountry: "Egypt",
    money: 850,
    loan: null,
    transferHistory: [{ season: 2, text: "previous move" }],
    leagueArchives: [{ id: "existing-archive", club: "Old FC" }],
    league: [{ name: "Host FC", played: 4, pts: 7 }]
  };
  const events = { logs: [], toasts: [], renders: 0, persisted: [] };
  const sandbox = {
    state,
    console,
    log: message => events.logs.push(String(message)),
    toast: message => events.toasts.push(String(message)),
    render: () => { events.renders++; },
    persistRollbackSnapshot: label => {
      events.persisted.push(String(label));
      return options.persistResult !== false;
    },
    saveGame: () => options.saveResult === undefined ? true : options.saveResult
  };
  vm.createContext(sandbox);
  new vm.Script(sources, { filename: "club-transition-transaction.js" }).runInContext(sandbox);
  return { sandbox, state, events };
}

{
  const h = makeHarness();
  const before = JSON.stringify(h.state);
  const originalState = h.state;
  const result = h.sandbox.runTransition("الانتقال", () => {
    h.state.clubName = "Destination FC";
    h.state.money += 2500;
    h.state.transferHistory.unshift({ season: 3, text: "partial transfer" });
    h.state.leagueArchives.push({ id: "partial-archive", club: "Host FC" });
    h.state.loan = { hostClub: "Destination FC" };
    throw new Error("destination schedule construction failed");
  });
  assert.equal(result, false, "a failed destination build must reject the transition");
  assert.equal(h.sandbox.state, originalState, "rollback must preserve the live save object identity");
  assert.equal(JSON.stringify(h.state), before,
    "club, money, loan, transfer history, league archive and standings must all be restored");
  assert.equal(h.events.renders, 1, "the restored club state must be rendered");
  assert.equal(h.events.persisted.length, 1, "the restored career must be queued for durable persistence");
  assert.ok(h.events.logs.some(message => message.includes("destination schedule construction failed")));
  assert.ok(h.events.toasts.some(message => message.includes("تمت استعادة بيانات المسيرة")));
}

{
  const h = makeHarness({ saveResult: false });
  const before = JSON.stringify(h.state);
  const result = h.sandbox.runTransition("الإعارة", () => {
    h.state.clubName = "Loan Host FC";
    h.state.loan = { hostClub: "Loan Host FC" };
    if (h.sandbox.saveGame(true) === false) throw new Error("loan save queue rejected the transition");
    return true;
  });
  assert.equal(result, false);
  assert.equal(JSON.stringify(h.state), before,
    "a rejected save queue must restore the original club and loan contract");
  assert.ok(h.events.logs.some(message => message.includes("loan save queue rejected")));
  assert.equal(h.events.persisted.length, 1);
}

{
  const h = makeHarness();
  const before = JSON.stringify(h.state);
  const result = h.sandbox.runTransition("الإعارة", () => {
    h.state.clubName = "Uncommitted FC";
    return false;
  });
  assert.equal(result, false, "an explicitly rejected transition must roll back");
  assert.equal(JSON.stringify(h.state), before);
  assert.equal(h.events.persisted.length, 1);
}

{
  const h = makeHarness();
  const result = h.sandbox.runTransition("الانتقال", () => {
    h.state.clubName = "New Club";
    h.state.money += 1000;
    h.state.transferHistory.unshift({ season: 3, text: "committed transfer" });
    return true;
  });
  assert.equal(result, true);
  assert.equal(h.state.clubName, "New Club");
  assert.equal(h.state.money, 1850);
  assert.equal(h.state.transferHistory[0].text, "committed transfer");
  assert.equal(h.events.persisted.length, 0, "a successful transition must not run rollback persistence");
  assert.equal(h.events.renders, 0);
}

{
  const h = makeHarness();
  const result = h.sandbox.runTransition("الإعارة", () => {
    h.state.loan = { hostClub: "Loan Host FC" };
  });
  assert.equal(result, true, "an operation with no explicit return must still commit normally");
  assert.equal(h.state.loan.hostClub, "Loan Host FC");
}

{
  const h = makeHarness();
  h.state.circular = h.state;
  let called = false;
  const result = h.sandbox.runTransition("الانتقال", () => { called = true; });
  assert.equal(result, false, "an unsafe save snapshot must stop a transition before mutation");
  assert.equal(called, false);
  assert.equal(h.events.persisted.length, 0);
  assert.ok(h.events.toasts.some(message => message.includes("تعذر تأمين بيانات المسيرة")));
}

const sw = fs.readFileSync(path.join(root, "sw.js"), "utf8");
const publicSw = fs.readFileSync(path.join(root, "public", "sw.js"), "utf8");
assert.equal(sw, publicSw, "root and public service workers must stay synchronized");
require("./assert-static-cache-version.cjs")(sw, 414);

console.log("PASS: loan and permanent club transitions roll back partial archives, destination setup and rejected saves without losing the live career object.");
