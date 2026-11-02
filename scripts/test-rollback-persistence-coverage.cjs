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
    if (quote) { if (escaped) { escaped = false; continue; } if (c === "\\") { escaped = true; continue; } if (c === quote) quote = null; continue; }
    if (c === "/" && n === "/") { lineComment = true; i++; continue; }
    if (c === "/" && n === "*") { blockComment = true; i++; continue; }
    if (c === "'" || c === '"' || c === "`") { quote = c; continue; }
    if (c === "{") depth++; else if (c === "}" && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error("unterminated function: " + name);
}
const helper = extractFunction(html, "persistRollbackSnapshot");
for (const name of ["withManualLeagueTransaction", "playCupMatch", "applyMatchResult"]) {
  const wrapper = extractFunction(html, name);
  assert.match(wrapper, /persistRollbackSnapshot\(/, name + " must verify durable rollback persistence");
  assert.doesNotMatch(wrapper, /saveGame\(true\)/, name + " must not bypass rollback flush verification");
}
const warningOrderCases = [
  { name: "withManualLeagueTransaction", notice: 'try{toast("تعذر اعتماد المباراة اليدوية.', persist: 'persistRollbackSnapshot("manual league rollback");' },
  { name: "playCupMatch", notice: 'try{toast("تعذر اعتماد مباراة الكأس.', persist: 'persistRollbackSnapshot("cup-match rollback");' },
  { name: "applyMatchResult", notice: 'try{toast("تعذر اعتماد نتيجة المباراة.', persist: 'persistRollbackSnapshot("match settlement rollback");' }
];
for (const item of warningOrderCases) {
  const wrapper = extractFunction(html, item.name);
  assert.ok(wrapper.lastIndexOf(item.notice) >= 0
    && wrapper.lastIndexOf(item.persist) > wrapper.lastIndexOf(item.notice),
    item.name + " must leave a synchronous rollback-persistence warning visible instead of overwriting it with a generic toast");
}
assert.match(helper, /saveGame\(true\)/);
assert.match(helper, /flushQueuedSave\(\{backupFirst:true\}\)/);
assert.match(helper, /saved!==true/);
function makeHarness(saveGame, flushQueuedSave) {
  const events = { warnings: [], toasts: [], flushes: 0 };
  const sandbox = { console: { warn: (...args) => events.warnings.push(args) }, saveGame,
    flushQueuedSave: options => { events.flushes++; return flushQueuedSave(options); },
    toast: message => events.toasts.push(String(message)) };
  vm.createContext(sandbox);
  vm.runInContext(helper + "\nglobalThis.persist = persistRollbackSnapshot;", sandbox);
  return { sandbox, events };
}
(async () => {
  {
    const h = makeHarness(() => false, () => true);
    assert.equal(h.sandbox.persist("queue-false"), false);
    assert.equal(h.events.flushes, 0);
    assert.equal(h.events.toasts.length, 1);
  }
  {
    const h = makeHarness(() => { throw new Error("queue failed"); }, () => true);
    assert.equal(h.sandbox.persist("queue-throws"), false);
    assert.equal(h.events.flushes, 0);
    assert.equal(h.events.toasts.length, 1);
  }
  {
    const h = makeHarness(() => true, () => { throw new Error("flush failed"); });
    assert.equal(h.sandbox.persist("flush-throws"), false);
    assert.equal(h.events.toasts.length, 1);
  }
  {
    const h = makeHarness(() => true, () => false);
    assert.equal(h.sandbox.persist("flush-false"), false);
    assert.equal(h.events.toasts.length, 1);
  }
  {
    const h = makeHarness(() => true, () => Promise.resolve(false));
    assert.equal(h.sandbox.persist("async-flush-false"), true);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(h.events.toasts.length, 1);
  }
  {
    const h = makeHarness(() => true, () => Promise.reject(new Error("async flush failed")));
    assert.equal(h.sandbox.persist("async-flush-rejected"), true);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(h.events.toasts.length, 1);
  }
  {
    const h = makeHarness(() => true, () => Promise.resolve(true));
    assert.equal(h.sandbox.persist("async-flush-success"), true);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(h.events.toasts.length, 0);
  }
  console.log("PASS: manual, cup, and generic match rollbacks verify queued saves and warn when durable fallback cannot be confirmed.");
})().catch(error => { console.error(error); process.exitCode = 1; });
